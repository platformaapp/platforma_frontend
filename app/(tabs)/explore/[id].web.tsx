import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { API_BASE, endpoints } from '@/constants/env';
import { getPublicTutorList, getPublicTutors } from '@/lib/api/tutor';
import { getAuthRole, getAuthToken, getUserProfile } from '@/lib/auth';

const PLACEHOLDER_AVATAR = require('@/assets/images/avatar.png');

type MentorEvent = { id: string; title: string; datetimeStart?: string; price?: number; coverUrl?: string | null; format?: string };

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
 * Веб-версия профиля наставника. Звонок "Instagram" показывается, только
 * если у наставника реально есть это поле (сейчас его нет в API — бэкенду
 * нужно добавить, если ссылка на Instagram должна отображаться).
 */
export default function TutorCardScreenWeb() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isMobile = useIsMobileWeb();

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
                format: r.format ?? r.type ?? undefined,
              }))
              .filter((e: MentorEvent) => e.id);
            if (active) setMentorEvents(events);
          }
        } catch { /* events section stays empty */ }
      } catch { /* network failure — show empty/placeholder profile instead of crashing */ }
      finally {
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

  const now = Date.now();
  const upcomingEvents = mentorEvents.filter((e) => !e.datetimeStart || new Date(e.datetimeStart).getTime() > now);
  const pastEvents = mentorEvents.filter((e) => e.datetimeStart && new Date(e.datetimeStart).getTime() <= now);

  // Как на референсе: карточки событий распределены между обеими колонками
  // страницы — 2 в узкой левой колонке (под текстом) и 1 в правой (под
  // фото), затем повтор — а не всё в одной колонке. slice/every 3rd matches
  // that 2-left/1-right rhythm.
  function splitForColumns(events: MentorEvent[]): { left: MentorEvent[]; right: MentorEvent[] } {
    const left: MentorEvent[] = [];
    const right: MentorEvent[] = [];
    events.forEach((e, i) => (i % 3 === 2 ? right : left).push(e));
    return { left, right };
  }
  const upcomingSplit = splitForColumns(upcomingEvents);
  const pastSplit = splitForColumns(pastEvents);

  function renderEventCard(ev: MentorEvent, widthVariant: 'grid3' | 'half' | 'full' = 'grid3') {
    return (
      <Pressable
        key={ev.id}
        style={[
          styles.eventCard,
          isMobile && styles.eventCardMobile,
          !isMobile && widthVariant === 'half' && styles.eventCardHalf,
          !isMobile && widthVariant === 'full' && styles.eventCardFull,
        ]}
        onPress={() => router.push(`/(tabs)/events/${ev.id}` as any)}
      >
        {ev.coverUrl ? <Image source={{ uri: ev.coverUrl }} style={styles.eventCover} resizeMode="cover" /> : <View style={[styles.eventCover, styles.eventCoverPlaceholder]} />}
        <View style={styles.eventCardBody}>
          {ev.format ? <Text style={styles.eventFormat}>{ev.format}</Text> : null}
          <Text style={styles.eventCardTitle} numberOfLines={2}>{ev.title}</Text>
          <Text style={styles.eventCardMeta}>
            {formatEventDate(ev.datetimeStart)}
            {isMobile && ev.price != null ? ` · ${ev.price.toLocaleString('ru-RU')} ₽` : ''}
          </Text>
        </View>
      </Pressable>
    );
  }

  const eventsSections = (
    <>
      {upcomingEvents.length > 0 ? (
        <View style={styles.eventsSection}>
          <Text style={styles.eventsSectionTitle}>События наставника</Text>
          <View style={styles.eventsGrid}>{upcomingEvents.map((e) => renderEventCard(e))}</View>
        </View>
      ) : null}

      {pastEvents.length > 0 ? (
        <View style={styles.eventsSection}>
          <Text style={styles.eventsSectionTitle}>Прошедшие события</Text>
          <View style={styles.eventsGrid}>{pastEvents.map((e) => renderEventCard(e))}</View>
        </View>
      ) : null}
    </>
  );

  // Desktop: заголовки секций и бОльшая часть карточек — в leftCol (2 в
  // ряд), остаток — в rightCol под фото (1 в ряд), см. splitForColumns выше.
  const eventsSectionsLeft = (
    <>
      {upcomingSplit.left.length > 0 ? (
        <View style={styles.eventsSection}>
          <Text style={styles.eventsSectionTitle}>События наставника</Text>
          <View style={styles.eventsGridLeft}>{upcomingSplit.left.map((e) => renderEventCard(e, 'half'))}</View>
        </View>
      ) : null}

      {pastSplit.left.length > 0 ? (
        <View style={styles.eventsSection}>
          <Text style={styles.eventsSectionTitle}>Прошедшие события</Text>
          <View style={styles.eventsGridLeft}>{pastSplit.left.map((e) => renderEventCard(e, 'half'))}</View>
        </View>
      ) : null}
    </>
  );

  const eventsSectionsRight = (
    <>
      {upcomingSplit.right.length > 0 ? (
        <View style={[styles.eventsSection, styles.eventsGridRight]}>{upcomingSplit.right.map((e) => renderEventCard(e, 'full'))}</View>
      ) : null}

      {pastSplit.right.length > 0 ? (
        <View style={[styles.eventsSection, styles.eventsGridRight]}>{pastSplit.right.map((e) => renderEventCard(e, 'full'))}</View>
      ) : null}
    </>
  );

  const actions = (
    <>
      {!isOwnProfile && isMentorVerified ? (
        <Pressable
          style={isMobile && styles.chipHalf}
          onPress={() => router.push(`/(tabs)/explore/${id}/slots` as any)}
        >
          <Text style={isMobile ? styles.chipHalfText : styles.actionLink}>Записаться на встречу</Text>
        </Pressable>
      ) : null}
      {!isOwnProfile ? (
        <Pressable style={isMobile && styles.chipHalf} onPress={handleWrite}>
          <Text style={isMobile ? styles.chipHalfText : styles.actionLink}>{isMobile ? 'Связаться' : 'Написать наставнику'}</Text>
        </Pressable>
      ) : null}
      {instagramUrl ? (
        <Pressable style={isMobile && styles.chipHalf} onPress={() => Linking.openURL(instagramUrl)}>
          <Text style={isMobile ? styles.chipHalfText : styles.actionLink}>Instagram</Text>
        </Pressable>
      ) : null}
    </>
  );

  if (loadingProfile) {
    return <SiteShell><View style={styles.centered}><ActivityIndicator size="large" color="#010101" /></View></SiteShell>;
  }

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageContent}>
        <Pressable style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore' as any))} hitSlop={8}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>

        {isMobile ? (
          <View>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text style={styles.name}>{displayName || 'Наставник'}</Text>
                {displayRole ? <Text style={styles.role}>{displayRole}</Text> : null}
              </View>
              <Image source={imageSource} style={styles.avatarMobile} />
            </View>

            {displayBio ? <Text style={styles.bio}>{displayBio}</Text> : null}

            {displayPrice ? (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Стоимость консультации:</Text>
                <Text style={styles.priceValue}>{displayPrice}</Text>
              </View>
            ) : null}

            <View style={styles.actionsRowMobile}>{actions}</View>
            {instagramUrl ? (
              <Text style={styles.instagramDisclaimer}>
                Социальная сеть Instagram, деятельность которой запрещена на территории РФ.
              </Text>
            ) : null}

            {eventsSections}
          </View>
        ) : (
          // Правая колонка — только фото, без содержимого ниже неё. Левая
          // колонка (текст + оба блока событий) уже фиксированной ширины
          // (не на всю доступную ширину ряда), поэтому между ней и фото
          // остаётся пустая полоса, которая тянется через всю страницу —
          // это сделано по референсу, а не баг.
          <View style={styles.desktopLayout}>
            <View style={styles.leftCol}>
              <Text style={styles.name}>{displayName || 'Наставник'}</Text>
              {displayRole ? <Text style={styles.role}>{displayRole}</Text> : null}
              {displayBio ? <Text style={styles.bio}>{displayBio}</Text> : null}

              {displayPrice ? (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Стоимость консультации:</Text>
                  <Text style={styles.priceValue}>{displayPrice}</Text>
                </View>
              ) : null}

              <View style={styles.actionsRow}>{actions}</View>
              {instagramUrl ? (
                <Text style={styles.instagramDisclaimer}>
                  Социальная сеть Instagram, деятельность которой запрещена на территории РФ.
                </Text>
              ) : null}

              {eventsSectionsLeft}
            </View>
            <View style={styles.rightCol}>
              <Image source={imageSource} style={styles.avatarLarge} />
              {eventsSectionsRight}
            </View>
          </View>
        )}
      </View>

        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 24, paddingBottom: 24 },
  pageContent: { paddingHorizontal: 32 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  backButton: { alignSelf: 'flex-start', marginBottom: 16 },
  backArrow: { fontSize: 25, color: '#010101' },

  // Desktop: текст+события слева (в колонке ограниченной ширины — НЕ на
  // всю доступную ширину), большое фото справа сверху. justifyContent:
  // 'space-between' без flexGrow разводит обе колонки по краям ряда, а
  // пустая полоса между ними — по референсу, тянется через весь блок
  // (включая секции событий, они теперь внутри leftCol, а не отдельным
  // полноширинным блоком ниже).
  desktopLayout: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  leftCol: { width: 820, maxWidth: 820 },
  rightCol: { flexBasis: 360, flexShrink: 0, maxWidth: 400 },
  avatarLarge: { width: '100%', aspectRatio: 1, backgroundColor: '#E5E5E5' },

  // Mobile: имя/роль слева, небольшой квадратный аватар справа.
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  headerText: { flex: 1 },
  avatarMobile: { width: 90, height: 90, backgroundColor: '#E5E5E5' },

  name: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101' },
  role: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#687076', marginTop: 4 },
  bio: { fontSize: 19, lineHeight: 26, fontFamily: 'Gramatika-Regular', color: '#010101', marginVertical: 16 },
  priceRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  priceLabel: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#687076' },
  priceValue: { fontSize: 14, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101' },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginBottom: 8 },
  actionLink: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 15, color: '#E02D2D' },

  // Мобильные экшн-кнопки — два чипа в ряд, а не колонка на всю ширину.
  actionsRowMobile: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  chipHalf: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#F0F5FB', paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  chipHalfText: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 14, color: '#68717A' },

  instagramDisclaimer: { fontSize: 11, lineHeight: 15, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginTop: 8, marginBottom: 8 },

  eventsSection: { marginTop: 40 },
  eventsSectionTitle: { fontSize: 25, lineHeight: 23, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101', marginBottom: 16 },
  eventsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  // leftCol — 2 карточки в ряд; rightCol (под фото) — 1 карточка в столбик,
  // см. splitForColumns/renderEventCard(widthVariant) выше — по референсу
  // карточки событий распределены между обеими колонками страницы, а не
  // все сразу в одной.
  eventsGridLeft: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  eventsGridRight: { gap: 32 },
  eventCard: { width: '31%' },
  eventCardMobile: { width: '47%' },
  eventCardHalf: { width: '47%' },
  eventCardFull: { width: '100%' },
  eventCover: { width: '100%', aspectRatio: 1.2, backgroundColor: '#E5E5E5' },
  eventCoverPlaceholder: { backgroundColor: '#E5E5E5' },
  eventCardBody: { paddingTop: 10 },
  eventFormat: { fontSize: 12, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#687076', marginBottom: 4 },
  eventCardTitle: { fontSize: 14, lineHeight: 19, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101', marginBottom: 4 },
  eventCardMeta: { fontSize: 12, fontFamily: 'Gramatika-Regular', color: '#687076' },
});
