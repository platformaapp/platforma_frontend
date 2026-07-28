import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell } from '@/components/web/site-shell';
import { API_BASE, endpoints } from '@/constants/env';
import { getPublicTutorList, getPublicTutors } from '@/lib/api/tutor';
import { getAuthRole, getAuthToken, getUserProfile } from '@/lib/auth';

const PLACEHOLDER_AVATAR = require('@/assets/images/avatar.png');

type MentorEvent = { id: string; title: string; datetimeStart?: string; price?: number; coverUrl?: string | null };

function resolveCover(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

function formatEventDate(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })}, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return iso;
  }
}

/**
 * Веб-версия профиля наставника. "Избранное" (звёздочка) — только локальная
 * UI-заглушка, бэкенд для избранного не найден; звонок "Instagram" показывается,
 * только если у наставника реально есть это поле (сейчас его нет в API — бэкенду
 * нужно добавить, если ссылка на Instagram должна отображаться).
 */
export default function TutorCardScreenWeb() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [displayName, setDisplayName] = useState('');
  const [displayBio, setDisplayBio] = useState('');
  const [displayRole, setDisplayRole] = useState('');
  const [displayPrice, setDisplayPrice] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isMentorVerified, setIsMentorVerified] = useState(true);
  const [telegramHandle, setTelegramHandle] = useState('');
  const [mentorEvents, setMentorEvents] = useState<MentorEvent[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showFavoriteHint, setShowFavoriteHint] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      try {
        const [viewerRole, profile, authList, publicList] = await Promise.all([
          getAuthRole(), getUserProfile(), getPublicTutorList(), getPublicTutors(),
        ]);
        if (!active) return;
        setIsOwnProfile(profile?.id === id);
        void viewerRole;

        const tutor = authList.find((t) => t.id === id) ?? publicList.find((t) => t.id === id);
        if (tutor) {
          setDisplayName(tutor.fullName ?? '');
          setDisplayRole((tutor as any).shortBio ?? (tutor as any).short_bio ?? '');
          setDisplayBio((tutor as any).bio ?? '');
          setAvatarUrl(tutor.avatarUrl ?? '');
          setInstagramUrl((tutor as any).instagramUrl ?? (tutor as any).instagram_url ?? '');
          const rate = (tutor as any).hourlyRate ?? (tutor as any).hourly_rate ?? (tutor as any).pricePerHour;
          if (typeof rate === 'number' && rate > 0) setDisplayPrice(`${rate.toLocaleString('ru-RU')} ₽ в час`);
          setTelegramHandle(((tutor as any).telegram ?? (tutor as any).telegramUsername ?? '').replace(/^@/, ''));
          setIsMentorVerified((tutor as any).isVerified !== false);
        }

        try {
          const feedRes = await fetch(endpoints.eventsFeed);
          if (feedRes.ok) {
            const data = await feedRes.json();
            let rawItems: unknown = data.items ?? data.data ?? data;
            if (!Array.isArray(rawItems) && rawItems && typeof rawItems === 'object') {
              rawItems = (rawItems as Record<string, unknown>).items ?? (rawItems as Record<string, unknown>).data ?? [];
            }
            const list = Array.isArray(rawItems) ? rawItems : [];
            const events: MentorEvent[] = list
              .filter((r: any) => {
                const mentorRaw = r.mentor ?? r.teacher ?? r.tutor;
                const mId = String(mentorRaw?.id ?? mentorRaw?.userId ?? r.tutorId ?? r.mentorId ?? '');
                return mId === String(id);
              })
              .map((r: any) => ({
                id: String(r.id ?? ''),
                title: String(r.title ?? ''),
                datetimeStart: r.datetimeStart ?? r.datetime_start ?? r.startAt ?? r.start_at ?? undefined,
                price: typeof r.price === 'number' ? r.price : undefined,
                coverUrl: resolveCover(r.coverUrl ?? r.cover_url ?? r.imageUrl ?? r.image_url),
              }))
              .filter((e: MentorEvent) => e.id);
            if (active) setMentorEvents(events);
          }
        } catch { /* events section stays empty */ }
      } finally {
        if (active) setLoadingProfile(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  const imageSource = avatarUrl && !avatarUrl.startsWith('blob:') ? { uri: avatarUrl } : PLACEHOLDER_AVATAR;

  async function handleWrite() {
    const token = await getAuthToken();
    if (!token) { router.push('/login' as any); return; }
    if (telegramHandle) {
      const w = (globalThis as any).window;
      if (w) w.open(`https://t.me/${telegramHandle}`, '_blank', 'noopener,noreferrer');
      else Linking.openURL(`https://t.me/${telegramHandle}`);
    } else {
      Alert.alert('Контакт', 'Наставник пока не указал способ связи');
    }
  }

  function toggleFavorite() {
    setIsFavorite((v) => !v);
    setShowFavoriteHint(true);
    setTimeout(() => setShowFavoriteHint(false), 1500);
  }

  if (loadingProfile) {
    return <SiteShell><View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View></SiteShell>;
  }

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.layout}>
          <View style={styles.main}>
            <View style={styles.headerRow}>
              <Image source={imageSource} style={styles.avatar} />
              <View style={styles.headerText}>
                <Text style={styles.name}>{displayName || 'Наставник'}</Text>
                {displayRole ? <Text style={styles.role}>{displayRole}</Text> : null}
              </View>
              <Pressable onPress={toggleFavorite} hitSlop={12} style={styles.favoriteButton}>
                <Text style={[styles.favoriteStar, isFavorite && styles.favoriteStarActive]}>★</Text>
              </Pressable>
            </View>
            {showFavoriteHint ? (
              <Text style={styles.favoriteHint}>{isFavorite ? 'Добавлено в избранное' : 'Убрано из избранного'}</Text>
            ) : null}

            {displayBio ? <Text style={styles.bio}>{displayBio}</Text> : null}

            {displayPrice ? (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Стоимость консультации:</Text>
                <Text style={styles.priceValue}>{displayPrice}</Text>
              </View>
            ) : null}

            <View style={styles.actionsRow}>
              {!isOwnProfile && isMentorVerified ? (
                <Pressable style={styles.primaryButton} onPress={() => router.push(`/(tabs)/explore/${id}/slots` as any)}>
                  <Text style={styles.primaryButtonText}>Записаться на встречу</Text>
                </Pressable>
              ) : null}
              {!isOwnProfile ? (
                <Pressable style={styles.secondaryButton} onPress={handleWrite}>
                  <Text style={styles.secondaryButtonText}>Написать наставнику</Text>
                </Pressable>
              ) : null}
              {instagramUrl ? (
                <Pressable style={styles.secondaryButton} onPress={() => Linking.openURL(instagramUrl)}>
                  <Text style={styles.secondaryButtonText}>Instagram</Text>
                </Pressable>
              ) : null}
            </View>
            {instagramUrl ? (
              <Text style={styles.instagramDisclaimer}>
                Социальная сеть Instagram, деятельность которой запрещена на территории РФ.
              </Text>
            ) : null}

            {mentorEvents.length > 0 ? (
              <View style={styles.eventsSection}>
                <Text style={styles.eventsSectionTitle}>События наставника</Text>
                {mentorEvents.map((ev) => (
                  <Pressable key={ev.id} style={styles.eventCard} onPress={() => router.push(`/(tabs)/events/${ev.id}` as any)}>
                    {ev.coverUrl ? <Image source={{ uri: ev.coverUrl }} style={styles.eventCover} /> : <View style={[styles.eventCover, styles.eventCoverPlaceholder]} />}
                    <View style={styles.eventBody}>
                      <Text style={styles.eventTitle} numberOfLines={2}>{ev.title}</Text>
                      {ev.datetimeStart ? <Text style={styles.eventDate}>{formatEventDate(ev.datetimeStart)}</Text> : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </View>
        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 24 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  layout: { flexDirection: 'row' },
  main: { flexBasis: 640, maxWidth: 640 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E5E5E5' },
  headerText: { flex: 1 },
  name: { fontSize: 22, fontFamily: 'Inter-Bold', color: '#181818' },
  role: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#687076', marginTop: 2 },
  favoriteButton: { padding: 8 },
  favoriteStar: { fontSize: 22, color: '#CFCFCF' },
  favoriteStarActive: { color: '#E02D2D' },
  favoriteHint: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#687076', marginBottom: 12 },
  bio: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818', marginVertical: 16 },
  priceRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  priceLabel: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#687076' },
  priceValue: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#181818' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  primaryButton: { backgroundColor: '#E02D2D', paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#FFFFFF' },
  secondaryButton: { borderWidth: 1, borderColor: '#181818', paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
  instagramDisclaimer: { fontSize: 11, lineHeight: 15, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 24 },
  eventsSection: { marginTop: 32 },
  eventsSectionTitle: { fontSize: 16, fontFamily: 'Inter-Medium', color: '#181818', marginBottom: 12, borderBottomWidth: 1, borderColor: '#1E1E1E', paddingBottom: 8 },
  eventCard: { flexDirection: 'row', borderWidth: 1, borderColor: '#1E1E1E', marginBottom: 10 },
  eventCover: { width: 80, height: 80, backgroundColor: '#E5E5E5' },
  eventCoverPlaceholder: { backgroundColor: '#E5E5E5' },
  eventBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  eventTitle: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#181818', marginBottom: 4 },
  eventDate: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#687076' },
});
