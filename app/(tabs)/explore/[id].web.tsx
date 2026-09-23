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

// Формат события хранится в поле category (enum EventCategory на бэкенде) —
// фид отдаёт английский слаг ('lecture', 'practices', ...), те же подписи,
// что и в /events (см. events/index.web.tsx CATEGORY_LABELS).
const CATEGORY_LABELS: Record<string, string> = {
  broadcast: 'Трансляция',
  lecture: 'Лекция',
  mediation: 'Медиация',
  practices: 'Практика',
  meeting: 'Встреча',
  discussion: 'Обсуждение',
};
function resolveFormat(raw: Record<string, unknown>): string | undefined {
  const category = raw.category as string | null | undefined;
  if (category && CATEGORY_LABELS[category]) return CATEGORY_LABELS[category];
  const legacy = (raw.format as string) ?? (raw.type as string) ?? undefined;
  return legacy;
}

function formatEventDate(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, ${d.toLocaleTimeString('ru-RU', { hour: 'numeric', minute: '2-digit' })}`;
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
          const rateRaw = (tutor as any).hourlyRate ?? (tutor as any).hourly_rate ?? (tutor as any).pricePerHour;
          // decimal-колонки в TypeORM/pg нередко приходят строкой ("2500.00"),
          // а не числом — принимаем оба варианта.
          const rate = typeof rateRaw === 'number' ? rateRaw : typeof rateRaw === 'string' ? parseFloat(rateRaw) : NaN;
          if (!isNaN(rate) && rate > 0) setDisplayPrice(`${rate.toLocaleString('ru-RU')} ₽ в час`);
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
                format: resolveFormat(r),
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

  // Mobile: одно событие — одна полноширинная строка (миниатюра слева,
  // текст справа, дата/цена прижаты к низу справа) — не карточка в сетке
  // 2 в ряд, см. референс мобильной страницы наставника.
  function renderEventCardMobile(ev: MentorEvent) {
    return (
      <Pressable key={ev.id} style={styles.eventRowMobile} onPress={() => router.push(`/(tabs)/events/${ev.id}` as any)}>
        {ev.coverUrl ? <Image source={{ uri: ev.coverUrl }} style={styles.eventThumbMobile} resizeMode="cover" /> : <View style={[styles.eventThumbMobile, styles.eventCoverPlaceholder]} />}
        <View style={styles.eventRowBodyMobile}>
          <View>
            {ev.format ? <Text style={styles.eventFormatMobile}>{ev.format}</Text> : null}
            <Text style={styles.eventCardTitleMobile} numberOfLines={3}>{ev.title}</Text>
          </View>
          <Text style={styles.eventRowMetaMobile}>
            {formatEventDate(ev.datetimeStart)}
            {ev.price != null ? `    ${ev.price.toLocaleString('ru-RU')} Р` : ''}
          </Text>
        </View>
      </Pressable>
    );
  }

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
          <Text style={[styles.eventsSectionTitle, isMobile && styles.eventsSectionTitleMobile]}>События наставника</Text>
          {isMobile ? (
            <View style={styles.eventsListMobile}>{upcomingEvents.map((e) => renderEventCardMobile(e))}</View>
          ) : (
            <View style={styles.eventsGrid}>{upcomingEvents.map((e) => renderEventCard(e))}</View>
          )}
        </View>
      ) : null}

      {pastEvents.length > 0 ? (
        <View style={styles.eventsSection}>
          <Text style={[styles.eventsSectionTitle, isMobile && styles.eventsSectionTitleMobile]}>Прошедшие события</Text>
          {isMobile ? (
            <View style={styles.eventsListMobile}>{pastEvents.map((e) => renderEventCardMobile(e))}</View>
          ) : (
            <View style={styles.eventsGrid}>{pastEvents.map((e) => renderEventCard(e))}</View>
          )}
        </View>
      ) : null}
    </>
  );

  // Desktop: настоящий CSS Grid (не два независимых flex-столбца) — иначе
  // строка карточек справа (под фото) не может ровно совпасть по высоте со
  // строкой карточек слева: у каждой "логической строки" (герой/фото,
  // заголовок/пусто, карточки-слева/карточки-справа) обе ячейки — прямые
  // дети грида в одном и том же порядке, поэтому высота строки — это
  // максимум из двух ячеек, и содержимое всегда стартует на одном уровне.
  function eventsGridRow(title: string, left: MentorEvent[], right: MentorEvent[]) {
    if (left.length === 0 && right.length === 0) return null;
    return (
      <>
        <Text style={[styles.eventsSectionTitle, styles.eventsSectionTitleGrid]}>{title}</Text>
        <View />
        <View style={styles.eventsGridLeft}>{left.map((e) => renderEventCard(e, 'half'))}</View>
        <View style={styles.eventsGridRight}>{right.map((e) => renderEventCard(e, 'full'))}</View>
      </>
    );
  }

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
            <Text style={[styles.name, styles.nameMobile]}>{displayName || 'Наставник'}</Text>

            <View style={styles.headerRowMobile}>
              <Image source={imageSource} style={styles.avatarMobile} />
              <View style={styles.headerInfoMobile}>
                {displayRole ? <Text style={[styles.role, styles.roleMobile]}>{displayRole}</Text> : null}
                {displayPrice ? (
                  <Text style={styles.priceTextMobile}>Стоимость консультации {displayPrice}</Text>
                ) : null}
              </View>
            </View>

            {displayBio ? <Text style={styles.bio}>{displayBio}</Text> : null}

            <View style={styles.actionsRowMobile}>{actions}</View>
            {instagramUrl ? (
              <Text style={styles.instagramDisclaimer}>
                Социальная сеть Instagram, деятельность которой запрещена на территории РФ.
              </Text>
            ) : null}

            {eventsSections}
          </View>
        ) : (
          // Пустая полоса между текстом и фото (по референсу, не баг) — это
          // columnGap между двумя колонками грида. Каждая "строка" — пара
          // прямых детей (лево/право), см. eventsGridRow.
          <View style={styles.desktopGrid}>
            <View style={styles.actionsRowContainer}>
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
            </View>
            <Image source={imageSource} style={styles.avatarLarge} />

            {eventsGridRow('События наставника', upcomingSplit.left, upcomingSplit.right)}
            {eventsGridRow('Прошедшие события', pastSplit.left, pastSplit.right)}
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

  // Desktop: настоящий CSS Grid, а не два независимых flex-столбца — нужно,
  // чтобы строка карточек справа (под фото) совпадала по высоте со строкой
  // карточек слева (см. eventsGridRow). columnGap — та самая пустая полоса
  // между текстом/фото по референсу (не баг). display:'grid' — не входит в
  // типы RN ViewStyle, но RN Web пропускает произвольные CSS-свойства как
  // есть (то же самое уже используется для outlineStyle в plus-field.tsx).
  desktopGrid: { display: 'grid', gridTemplateColumns: '659px 360px', columnGap: 308, alignItems: 'start', position: 'relative' } as any,
  avatarLarge: { width: '100%', aspectRatio: 1, backgroundColor: '#E5E5E5' },

  // Mobile: имя/роль слева, небольшой квадратный аватар справа.
  // Mobile: имя отдельной строкой сверху, ниже — портретное фото слева и
  // роль/цена справа от него (см. референс мобильной страницы наставника).
  headerRowMobile: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', marginTop: 16, marginBottom: 16 },
  headerInfoMobile: { flex: 1, gap: 16 },
  avatarMobile: { width: 110, height: 132, backgroundColor: '#E5E5E5', flexShrink: 0 },
  priceTextMobile: { fontSize: 16, lineHeight: 22, fontFamily: 'Gramatika-Regular', color: '#010101' },

  name: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
  nameMobile: { fontSize: 25, lineHeight: 28 },
  role: { fontSize: 20, fontFamily: 'Gramatika-Regular', color: '#000', marginTop: 18 },
  roleMobile: { fontSize: 16, lineHeight: 22, marginTop: 0 },
  bio: { fontSize: 19, lineHeight: 26, fontFamily: 'Gramatika-Regular', color: '#010101', marginVertical: 16 },
  priceRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  priceLabel: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#687076' },
  priceValue: { fontSize: 14, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginBottom: 8,     position: 'absolute',
    bottom: 0 },
  actionLink: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 15, color: '#E02D2D' },
  actionsRowContainer: { position: 'relative', height: '100%' },

  // Мобильные экшн-кнопки — два чипа в ряд, а не колонка на всю ширину.
  actionsRowMobile: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  chipHalf: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#F0F5FB', paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  chipHalfText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 14, color: '#68717A' },

  instagramDisclaimer: { fontSize: 11, lineHeight: 15, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginTop: 8, marginBottom: 8 },

  eventsSection: { marginTop: 40 },
  eventsSectionTitle: { fontSize: 40, lineHeight: 23, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 40 },
  eventsSectionTitleMobile: { fontSize: 25, lineHeight: 28, marginBottom: 24 },
  // Доп. отступ сверху для заголовка-строки грида (сама eventsSectionTitle
  // без него — используется и в мобильной eventsSection, где отступ уже
  // на обёртке).
  eventsSectionTitleGrid: { marginTop: 300 },
  eventsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  // Левая колонка грида — 2 карточки в ряд; правая (под фото) — 1 карточка
  // в столбик, см. splitForColumns/renderEventCard(widthVariant) выше — по
  // референсу карточки событий распределены между обеими колонками
  // страницы, а не все сразу в одной.
  eventsGridLeft: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  eventsGridRight: { gap: 32 },
  eventCard: { width: '31%' },
  eventCardMobile: { width: '47%' },
  eventCardHalf: { width: '47%' },
  eventCardFull: { width: '100%' },
  eventCover: { width: '100%', aspectRatio: 1.2, backgroundColor: '#E5E5E5' },
  eventCoverPlaceholder: { backgroundColor: '#E5E5E5' },
  eventCardBody: { paddingTop: 10 },
  eventFormat: { fontSize: 18, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#687076', marginBottom: 4 },
  eventCardTitle: { fontSize: 25, lineHeight: 19, fontFamily: 'Gramatika-Regular', fontWeight: 'regular', color: '#010101', marginBottom: 4 },
  eventCardMeta: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#687076' },

  // Mobile: полноширинная строка на событие (миниатюра + текст), а не
  // карточки в сетке — см. renderEventCardMobile / референс.
  eventsListMobile: { gap: 24 },
  eventRowMobile: { flexDirection: 'row', gap: 16 },
  eventThumbMobile: { width: 90, height: 90, backgroundColor: '#E5E5E5', flexShrink: 0 },
  eventRowBodyMobile: { flex: 1, minHeight: 90, justifyContent: 'space-between' },
  eventFormatMobile: { fontSize: 12, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginBottom: 4 },
  eventCardTitleMobile: { fontSize: 16, lineHeight: 20, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
  eventRowMetaMobile: { fontSize: 14, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', textAlign: 'right' },
});
