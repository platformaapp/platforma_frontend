import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
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
  const isMobile = useIsMobileWeb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [cancelStep, setCancelStep] = useState<'none' | 'confirm' | 'success'>('none');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

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

  async function handleCancelRegistration() {
    if (!event || isCancelling) return;
    setIsCancelling(true);
    setCancelError('');
    try {
      const token = await getAuthToken();
      if (!token) { router.push(`/login?redirect=/events/${event.id}` as any); return; }
      const headers = { Authorization: `Bearer ${token}` };

      let res = await fetch(`${endpoints.events}/${event.id}/registration`, { method: 'DELETE', headers });
      if (res.status === 404 || res.status === 405) {
        res = await fetch(`${endpoints.events}/${event.id}/unregister`, { method: 'POST', headers });
      }
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? `Не удалось отменить запись (${res.status})`);
      }

      setEvent((prev) => (prev ? { ...prev, isRegistered: false } : prev));
      setCancelStep('success');
    } catch (e: any) {
      setCancelError(e?.message ?? 'Не удалось отменить запись');
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleShare() {
    const w = (globalThis as any).window;
    if (w) await Clipboard.setStringAsync(w.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  const metaBlock = (
    <View style={styles.metaRow}>
      <View>
        <Text style={styles.metaLabel}>Дата:</Text>
        <Text style={styles.metaValue}>{formatDatetime(event?.datetimeStart)}</Text>
      </View>
      <View>
        <Text style={styles.metaLabel}>Стоимость:</Text>
        <Text style={styles.metaValue}>{formatPrice(event?.price)}</Text>
      </View>
    </View>
  );

  const mentorRow = event?.mentor ? (
    <View style={styles.mentorRow}>
      <View style={styles.mentorInfo}>
        <Text style={styles.mentorName}>{event.mentor.name}</Text>
        {event.mentor.shortBio ? <Text style={styles.mentorBio}>{event.mentor.shortBio}</Text> : null}
      </View>
      {event.mentor.avatarUrl ? <Image source={{ uri: event.mentor.avatarUrl }} style={styles.mentorAvatar} resizeMode="cover" /> : null}
    </View>
  ) : null;

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageContent}>
        <Pressable style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/events' as any))} hitSlop={8}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#010101" /></View>
        ) : error || !event ? (
          <View style={styles.centered}><Text style={styles.errorText}>{error || 'Событие не найдено'}</Text></View>
        ) : isMobile ? (
          <View>
            <Text style={styles.title}>{event.title}</Text>

            {event.coverUrl ? (
              <View style={styles.mobileHeaderRow}>
                <Image source={{ uri: event.coverUrl }} style={styles.mobileThumb} resizeMode="cover" />
                <View style={styles.mobileMetaCol}>
                  <Text style={styles.metaValue}>{formatDatetime(event.datetimeStart)}</Text>
                  <Text style={styles.metaValue}>{formatPrice(event.price)}</Text>
                </View>
              </View>
            ) : metaBlock}

            {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

            {registerError ? <Text style={styles.errorText}>{registerError}</Text> : null}

            {event.isRegistered ? (
              <Pressable style={styles.chipButton} onPress={() => setCancelStep('confirm')}>
                <Text style={styles.chipButtonText}>Отменить запись</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.chipButton, isRegistering && styles.btnDisabled]} onPress={handleRegister} disabled={isRegistering}>
                <Text style={styles.chipButtonText}>{isRegistering ? 'Регистрируем…' : 'Зарегистрироваться'}</Text>
              </Pressable>
            )}
            <Pressable style={styles.chipButton} onPress={handleShare}>
              <Text style={styles.chipButtonText}>{shareCopied ? 'Ссылка скопирована' : 'Поделиться событием'}</Text>
            </Pressable>

            {event.mentor ? (
              <>
                {mentorRow}
                <Pressable style={styles.chipButton} onPress={() => router.push(`/(tabs)/explore/${event.mentor!.id}` as any)}>
                  <Text style={styles.chipButtonText}>Написать</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : (
          <View style={styles.desktopLayout}>
            <View style={styles.leftCol}>
              <Text style={styles.title}>{event.title}</Text>
              {event.description ? <Text style={styles.description}>{event.description}</Text> : null}
              {metaBlock}

              {registerError ? <Text style={styles.errorText}>{registerError}</Text> : null}

              <View style={styles.actionsRow}>
                {event.isRegistered ? (
                  <Pressable onPress={() => setCancelStep('confirm')}>
                    <Text style={styles.actionLink}>Отменить запись</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={handleRegister} disabled={isRegistering}>
                    <Text style={[styles.actionLink, isRegistering && styles.actionLinkDisabled]}>{isRegistering ? 'Регистрируем…' : 'Зарегистрироваться'}</Text>
                  </Pressable>
                )}
                <Pressable onPress={handleShare}>
                  <Text style={styles.actionLink}>{shareCopied ? 'Ссылка скопирована' : 'Поделиться событием'}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.rightCol}>
              {event.coverUrl ? <Image source={{ uri: event.coverUrl }} style={styles.cover} resizeMode="cover" /> : null}
              {event.mentor ? (
                <View>
                  {mentorRow}
                  <Pressable onPress={() => router.push(`/(tabs)/explore/${event.mentor!.id}` as any)}>
                    <Text style={styles.actionLink}>Перейти в профиль</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </View>

        <SiteFooter />
      </ScrollView>

      <Modal transparent animationType="fade" visible={cancelStep !== 'none'} onRequestClose={() => setCancelStep('none')}>
        <View style={[styles.cancelOverlay, { pointerEvents: 'box-none' }]}>
          <View style={styles.cancelModalCard}>
            <Pressable style={styles.cancelCloseButton} onPress={() => setCancelStep('none')} hitSlop={8}>
              <Text style={styles.cancelCloseText}>✕</Text>
            </Pressable>
            {cancelStep === 'success' ? (
              <Text style={styles.cancelModalTitle}>Запись отменена</Text>
            ) : (
              <>
                <Text style={styles.cancelModalTitle}>Вы действительно хотите отменить запись?</Text>
                <Text style={styles.cancelModalText}>Отменить запись можно не позднее, чем за 24 часа до начала</Text>
                {cancelError ? <Text style={styles.errorText}>{cancelError}</Text> : null}
                <View style={styles.cancelModalActions}>
                  <Pressable onPress={() => setCancelStep('none')}>
                    <Text style={styles.cancelModalLeave}>Оставить</Text>
                  </Pressable>
                  <Pressable onPress={handleCancelRegistration} disabled={isCancelling}>
                    <Text style={[styles.cancelModalConfirm, isCancelling && styles.actionLinkDisabled]}>
                      {isCancelling ? 'Отменяем…' : 'Отменить запись'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 24, paddingBottom: 24 },
  pageContent: { paddingHorizontal: 32 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 16 },
  backButton: { alignSelf: 'flex-start', marginBottom: 16 },
  backArrow: { fontSize: 20, color: '#010101' },

  // Desktop: узкая текстовая колонка слева (заголовок оборачивается в
  // 2-3 строки, как на референсе), картинка (альбомная, не фикс. высота)
  // + карточка наставника — в широкой колонке справа.
  desktopLayout: { flexDirection: 'row', gap: 48, alignItems: 'flex-start' },
  leftCol: { flexBasis: 420, maxWidth: 420, flexShrink: 1 },
  rightCol: { flex: 1, minWidth: 0 },
  cover: { width: '100%', aspectRatio: 1.44, marginBottom: 24, backgroundColor: '#E5E5E5' },

  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101', marginBottom: 16 },
  description: { fontSize: 19, lineHeight: 26, fontFamily: 'Gramatika-Regular', color: '#010101', marginBottom: 24 },
  metaRow: { flexDirection: 'row', gap: 48, marginBottom: 24 },
  metaLabel: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 4 },
  metaValue: { fontSize: 16, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101' },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  actionLink: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 15, color: '#E02D2D' },
  actionLinkDisabled: { color: '#9B9B9B' },
  btnDisabled: { opacity: 0.6 },

  mentorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  mentorInfo: { flex: 1 },
  mentorName: { fontSize: 25, lineHeight: 28, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101', marginBottom: 4 },
  mentorBio: { fontSize: 13, lineHeight: 18, fontFamily: 'Gramatika-Regular', color: '#687076' },
  // Крупный портретный кадр (как на /explore), а не маленький квадратный
  // значок — см. референс страницы события.
  mentorAvatar: { width: 110, height: 132, backgroundColor: '#E5E5E5', flexShrink: 0 },

  // Mobile: маленькая миниатюра рядом с датой/ценой, кнопки — заливка (см. моб. макеты).
  mobileHeaderRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 },
  mobileThumb: { width: 90, height: 90, backgroundColor: '#E5E5E5' },
  mobileMetaCol: { flex: 1, gap: 6 },
  chipButton: { backgroundColor: '#F0F5FB', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  chipButtonText: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 15, color: '#68717A' },

  cancelOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(24,24,24,0.45)', padding: 16 },
  cancelModalCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', padding: 24, position: 'relative' },
  cancelCloseButton: { position: 'absolute', top: 16, right: 16, padding: 4 },
  cancelCloseText: { fontSize: 18, color: '#687076' },
  cancelModalTitle: { fontSize: 18, lineHeight: 24, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101', marginBottom: 8, paddingRight: 24 },
  cancelModalText: { fontSize: 13, lineHeight: 18, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 20 },
  cancelModalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelModalLeave: { fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#687076' },
  cancelModalConfirm: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 14, color: '#E02D2D' },
});
