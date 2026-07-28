import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell } from '@/components/web/site-shell';
import { API_BASE, endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';
import { isRegisteredOnEventItem, unwrapApiData } from '@/lib/event-feed';
import { getPaymentMethods, type PaymentMethod } from '@/lib/api/student-payments';

function resolveUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

type EventDetail = {
  id: string;
  title: string;
  description?: string;
  datetimeStart?: string;
  price?: number;
  coverUrl?: string | null;
  mentor?: { id: string; name: string; avatarUrl?: string | null; bio?: string; shortBio?: string };
  isRegistered?: boolean;
};

function normalizeEvent(raw: Record<string, unknown>): EventDetail {
  const r = (unwrapApiData<Record<string, unknown>>(raw) ?? raw) as Record<string, unknown>;
  const datetimeStart = (r.datetimeStart ?? r.datetime_start ?? r.startAt ?? r.start_at) as string | undefined;
  const price = typeof r.price === 'number' ? r.price : typeof r.price === 'string' ? parseFloat(r.price as string) : undefined;
  const mentorRaw = (r.mentor ?? r.teacher ?? r.tutor) as Record<string, unknown> | undefined;
  const mentor = mentorRaw ? {
    id: String(mentorRaw.id ?? mentorRaw.userId ?? mentorRaw.user_id ?? ''),
    name: String(mentorRaw.name ?? mentorRaw.fullName ?? mentorRaw.full_name ?? ''),
    avatarUrl: resolveUrl(mentorRaw.avatarUrl ?? mentorRaw.avatar_url ?? mentorRaw.photo),
    bio: (mentorRaw.bio ?? mentorRaw.description ?? '') as string,
    shortBio: (mentorRaw.shortBio ?? mentorRaw.short_bio ?? '') as string,
  } : undefined;
  const cupRaw = (r.currentUserParticipation ?? r.current_user_participation) as Record<string, unknown> | undefined;
  const cupStatus = (cupRaw?.status as string | undefined)?.toLowerCase();
  const registeredFromCup = cupStatus ? ['registered', 'confirmed', 'active', 'paid', 'attended', 'completed', 'pending'].includes(cupStatus) : false;

  return {
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    description: (r.description as string) ?? undefined,
    datetimeStart,
    price,
    coverUrl: resolveUrl(r.coverUrl ?? r.cover_url ?? r.imageUrl ?? r.image_url ?? r.cover),
    mentor,
    isRegistered: isRegisteredOnEventItem(r) || registeredFromCup,
  };
}

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function formatDatetime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTHS_GEN[d.getMonth()];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${hh}:${mm}`;
  } catch {
    return iso ?? '';
  }
}

function formatPrice(price?: number): string {
  if (price == null) return 'Бесплатно';
  return `${price.toLocaleString('ru-RU')} ₽`;
}

/**
 * Веб-версия страницы события. Регистрация на платное событие реализована по
 * той же схеме, что и в нативном app/(tabs)/events/[id].tsx (POST /register,
 * редирект на confirmation_url при payment_required) — но без модалки выбора
 * карты, прогресс-бара ожидания оплаты и авто-отмены зависших платежей: эта
 * логика продублирована из нативного экрана, а не вынесена в общий хук,
 * чтобы не рисковать регрессией в уже работающей нативной оплате.
 */
export default function EventDetailScreenWeb() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const token = await getAuthToken();
        const res = await fetch(`${endpoints.events}/${id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (active) setError(body?.message ?? body?.error ?? `Не удалось загрузить событие (${res.status})`);
          return;
        }
        const data = await res.json();
        if (active) setEvent(normalizeEvent(data));
      } catch (e: any) {
        if (active) setError(e?.message ?? 'Не удалось загрузить событие');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  async function handleRegister() {
    if (!event || isRegistering) return;
    setIsRegistering(true);
    setRegisterError('');
    try {
      const [token, cards] = await Promise.all([getAuthToken(), getPaymentMethods().catch(() => [] as PaymentMethod[])]);
      if (!token) { router.push(`/login?redirect=/events/${event.id}` as any); return; }

      const defaultCard = cards.find((c) => c.isDefault) ?? cards[0] ?? null;
      const body: Record<string, unknown> = {};
      if (defaultCard) body.payment_method_id = defaultCard.id;

      const res = await fetch(`${endpoints.events}/${event.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) { setEvent((prev) => prev ? { ...prev, isRegistered: true } : prev); return; }
        throw new Error(data?.message ?? `Ошибка регистрации (${res.status})`);
      }

      if (!data?.payment_required) {
        setEvent((prev) => prev ? { ...prev, isRegistered: true } : prev);
        return;
      }

      const confirmUrl: string | null = data?.confirmation_url ?? data?.confirmationUrl ?? data?.redirect_url ?? null;
      if (confirmUrl) {
        const w = (globalThis as any).window;
        if (w) w.location.href = confirmUrl;
        return;
      }
      throw new Error(data?.payment_error ?? data?.message ?? 'Не получена ссылка для оплаты');
    } catch (e: any) {
      setRegisterError(e?.message ?? 'Не удалось зарегистрироваться');
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleShare() {
    const w = (globalThis as any).window;
    if (w) await Clipboard.setStringAsync(w.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View>
        ) : error || !event ? (
          <View style={styles.centered}><Text style={styles.errorText}>{error || 'Событие не найдено'}</Text></View>
        ) : (
          <View style={styles.layout}>
            <View style={styles.main}>
              {event.coverUrl ? <Image source={{ uri: event.coverUrl }} style={styles.cover} resizeMode="cover" /> : null}
              <Text style={styles.title}>{event.title}</Text>
              {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

              <View style={styles.metaRow}>
                <View>
                  <Text style={styles.metaLabel}>Дата:</Text>
                  <Text style={styles.metaValue}>{formatDatetime(event.datetimeStart)}</Text>
                </View>
                <View>
                  <Text style={styles.metaLabel}>Стоимость:</Text>
                  <Text style={styles.metaValue}>{formatPrice(event.price)}</Text>
                </View>
              </View>

              {registerError ? <Text style={styles.errorText}>{registerError}</Text> : null}

              <View style={styles.actionsRow}>
                {event.isRegistered ? (
                  <View style={[styles.registerButton, styles.registerButtonDisabled]}>
                    <Text style={styles.registerButtonText}>Вы зарегистрированы</Text>
                  </View>
                ) : (
                  <Pressable style={[styles.registerButton, isRegistering && styles.btnDisabled]} onPress={handleRegister} disabled={isRegistering}>
                    <Text style={styles.registerButtonText}>{isRegistering ? 'Регистрируем…' : 'Зарегистрироваться'}</Text>
                  </Pressable>
                )}
                <Pressable style={styles.shareButton} onPress={handleShare}>
                  <Text style={styles.shareButtonText}>{shareCopied ? 'Ссылка скопирована' : 'Поделиться событием'}</Text>
                </Pressable>
              </View>
            </View>

            {event.mentor ? (
              <View style={styles.mentorCard}>
                {event.mentor.avatarUrl ? <Image source={{ uri: event.mentor.avatarUrl }} style={styles.mentorAvatar} /> : null}
                <Text style={styles.mentorName}>{event.mentor.name}</Text>
                {event.mentor.shortBio ? <Text style={styles.mentorBio}>{event.mentor.shortBio}</Text> : null}
                <Pressable style={styles.mentorWriteButton} onPress={() => router.push(`/(tabs)/explore/${event.mentor!.id}` as any)}>
                  <Text style={styles.mentorWriteButtonText}>Написать</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}

        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 24 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 16 },
  layout: { flexDirection: 'row', flexWrap: 'wrap', gap: 32 },
  main: { flexBasis: 480, flexGrow: 1 },
  cover: { width: '100%', height: 320, marginBottom: 24, backgroundColor: '#E5E5E5' },
  title: { fontSize: 28, lineHeight: 34, fontFamily: 'Inter-Bold', color: '#181818', marginBottom: 16 },
  description: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 24 },
  metaRow: { flexDirection: 'row', gap: 48, marginBottom: 24 },
  metaLabel: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#687076', marginBottom: 4 },
  metaValue: { fontSize: 16, fontFamily: 'Inter-Medium', color: '#181818' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  registerButton: { backgroundColor: '#E02D2D', paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center' },
  registerButtonDisabled: { backgroundColor: '#9B9B9B' },
  btnDisabled: { opacity: 0.6 },
  registerButtonText: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#FFFFFF' },
  shareButton: { paddingVertical: 14, paddingHorizontal: 24, borderWidth: 1, borderColor: '#181818', alignItems: 'center', justifyContent: 'center' },
  shareButtonText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
  mentorCard: { flexBasis: 260, flexGrow: 1, maxWidth: 320, borderWidth: 1, borderColor: '#E5E5E5', padding: 24, alignSelf: 'flex-start' },
  mentorAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E5E5E5', marginBottom: 12 },
  mentorName: { fontSize: 16, fontFamily: 'Inter-Medium', color: '#181818', marginBottom: 4 },
  mentorBio: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#687076', marginBottom: 16 },
  mentorWriteButton: { borderWidth: 1, borderColor: '#181818', paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  mentorWriteButtonText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
});
