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

// Карточки в строке "События наставника" — 3 на ряд, каждая со своим
// соотношением сторон картинки (та же сетка 403/365/340, что в rowThree на
// /events, но со своими колонками-зазорами — см. mentorEventsRow).
const MENTOR_ROW_ASPECTS: [number, number, number] = [403 / 285, 365 / 211, 340 / 232];
const MENTOR_ROW_COLUMNS: [string, string, string] = ['1', '3', '5'];

function formatEventDate(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
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
          if (!isNaN(rate) && rate > 0) setDisplayPrice(`${rate.toLocaleString('ru-RU')} Р в час`);
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

  // Сетка "События наставника"/"Прошедшие события" по референсу — не внутри
  // 2-колоночного desktopGrid (текст/фото), а отдельная полноширинная
  // 3-колоночная сетка: 403fr 75fr 365fr 266fr 340fr (карточки в колонках
  // 1/3/5, 2 и 4 — зазоры). Строки по 3 карточки, две строки образуют
  // повторяющийся блок: во второй строке каждой пары третья карточка уже
  // (84.4% вместо 100% по ширине) — см. MENTOR_ROW_ASPECTS/renderMentorGridCard.
  function buildMentorEventRows(events: MentorEvent[]): MentorEvent[][] {
    const rows: MentorEvent[][] = [];
    for (let i = 0; i < events.length; i += 3) rows.push(events.slice(i, i + 3));
    return rows;
  }

  // Mobile: одно событие — одна полноширинная строка (миниатюра слева,
  // текст справа, дата/цена прижаты к низу справа) — не карточка в сетке
  // 2 в ряд, см. референс мобильной страницы наставника.
  // Прошедшие события — полностью осветлённые (тот же opacity:0.5, что у
  // глобального hover-затемнения любого Pressable, см. app/_layout.tsx
  // HoverDimCalibrator, но здесь — постоянно, не по hover) и некликабельные
  // (disabled снимает курсор/hover у Pressable, см. тот же _layout.tsx).
  function renderEventCardMobile(ev: MentorEvent, isPast = false) {
    return (
      <Pressable
        key={ev.id}
        style={[styles.eventRowMobile, isPast && styles.eventDimmed]}
        disabled={isPast}
        onPress={isPast ? undefined : () => router.push(`/(tabs)/events/${ev.id}` as any)}
      >
        {ev.coverUrl ? <Image source={{ uri: ev.coverUrl }} style={styles.eventThumbMobile} resizeMode="cover" /> : <View style={[styles.eventThumbMobile, styles.eventCoverPlaceholder]} />}
        <View style={styles.eventRowBodyMobile}>
          <View>
            {ev.format ? <Text style={styles.eventFormatMobile}>{ev.format}</Text> : null}
            <Text style={styles.eventCardTitleMobile}>{ev.title}</Text>
          </View>
          <Text style={styles.eventRowMetaMobile}>
            {formatEventDate(ev.datetimeStart)}
            {ev.price != null ? `    ${ev.price.toLocaleString('ru-RU')} Р` : ''}
          </Text>
        </View>
      </Pressable>
    );
  }

  function renderEventCard(ev: MentorEvent, widthVariant: 'grid3' | 'half' | 'full' = 'grid3', isPast = false) {
    return (
      <Pressable
        key={ev.id}
        style={[
          styles.eventCard,
          isMobile && styles.eventCardMobile,
          !isMobile && widthVariant === 'half' && styles.eventCardHalf,
          !isMobile && widthVariant === 'full' && styles.eventCardFull,
          isPast && styles.eventDimmed,
        ]}
        disabled={isPast}
        onPress={isPast ? undefined : () => router.push(`/(tabs)/events/${ev.id}` as any)}
      >
        {ev.coverUrl ? <Image source={{ uri: ev.coverUrl }} style={styles.eventCover} resizeMode="cover" /> : <View style={[styles.eventCover, styles.eventCoverPlaceholder]} />}
        <View style={styles.eventCardBody}>
          {ev.format ? <Text style={styles.eventFormat}>{ev.format}</Text> : null}
          <Text style={styles.eventCardTitle}>{ev.title}</Text>
          <Text style={styles.eventCardMeta}>
            {formatEventDate(ev.datetimeStart)}
            {isMobile && ev.price != null ? ` · ${ev.price.toLocaleString('ru-RU')} Р` : ''}
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
            <View style={styles.eventsListMobile}>{pastEvents.map((e) => renderEventCardMobile(e, true))}</View>
          ) : (
            <View style={styles.eventsGrid}>{pastEvents.map((e) => renderEventCard(e, 'grid3', true))}</View>
          )}
        </View>
      ) : null}
    </>
  );

  function renderMentorGridCard(ev: MentorEvent, posInRow: 0 | 1 | 2, narrowImage: boolean, isPast = false) {
    return (
      <Pressable
        key={ev.id}
        style={[{ gridColumn: MENTOR_ROW_COLUMNS[posInRow] } as any, isPast && styles.eventDimmed]}
        disabled={isPast}
        onPress={isPast ? undefined : () => router.push(`/(tabs)/events/${ev.id}` as any)}
      >
        {ev.coverUrl ? (
          <Image
            source={{ uri: ev.coverUrl }}
            style={[styles.mentorGridImage, { aspectRatio: MENTOR_ROW_ASPECTS[posInRow] }, narrowImage && styles.mentorGridImageNarrow]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.mentorGridImage, styles.eventCoverPlaceholder, { aspectRatio: MENTOR_ROW_ASPECTS[posInRow] }, narrowImage && styles.mentorGridImageNarrow]} />
        )}
        <View style={styles.eventCardBody}>
          {ev.format ? <Text style={styles.eventFormat}>{ev.format}</Text> : null}
          <Text style={styles.eventCardTitle}>{ev.title}</Text>
          <Text style={styles.eventCardMeta}>{formatEventDate(ev.datetimeStart)}</Text>
        </View>
      </Pressable>
    );
  }

  function renderMentorEventsGrid(title: string, events: MentorEvent[], isPast = false) {
    if (events.length === 0) return null;
    const rows = buildMentorEventRows(events);
    return (
      <View style={styles.mentorEventsSection}>
        <Text style={styles.eventsSectionTitle}>{title}</Text>
        {rows.map((row, rowIdx) => {
          // Вторая строка каждой пары — та, где у третьей карточки узкая
          // картинка (card--d на референсе).
          const narrowLast = rowIdx % 2 === 1;
          return (
            <View key={row.map((r) => r.id).join('-')} style={[styles.mentorEventsRow, rowIdx > 0 && styles.mentorEventsRowSpacing]}>
              {row.map((ev, pos) => renderMentorGridCard(ev, pos as 0 | 1 | 2, narrowLast && pos === 2, isPast))}
            </View>
          );
        })}
      </View>
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
      <ScrollView contentContainerStyle={isMobile ? styles.scrollContentMobile : styles.scrollContent}>
      <View style={styles.pageContent}>
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
          // columnGap между двумя колонками грида. Сетка событий наставника
          // — отдельная полноширинная сетка ниже, не часть этого грида, см.
          // renderMentorEventsGrid.
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
            <View style={styles.avatarLargeBox}>
              <Image source={imageSource} style={styles.avatarLarge} resizeMode="cover" />
            </View>
          </View>
        )}

        {!isMobile ? (
          <>
            {renderMentorEventsGrid('События наставника', upcomingEvents)}
            {renderMentorEventsGrid('Прошедшие события', pastEvents, true)}
          </>
        ) : null}
      </View>

        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 0, paddingBottom: 24,     marginTop: 106 },
  scrollContentMobile: { paddingTop: 0, paddingBottom: 24,     marginTop: 30 },
  pageContent: { paddingHorizontal: 32 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },

  // Desktop: настоящий CSS Grid, а не два независимых flex-столбца — нужно,
  // чтобы строка карточек справа (под фото) совпадала по высоте со строкой
  // карточек слева (см. eventsGridRow). columnGap — та самая пустая полоса
  // между текстом/фото по референсу (не баг). display:'grid' — не входит в
  // типы RN ViewStyle, но RN Web пропускает произвольные CSS-свойства как
  // есть (то же самое уже используется для outlineStyle в plus-field.tsx).
  desktopGrid: { display: 'grid', gridTemplateColumns: '659px 285px', columnGap: 271, alignItems: 'start', position: 'relative' } as any,
  // 339×409 по референсу (339/1512 от общей ширины страницы = 22.42%) —
  // прямоугольное портретное фото вместо квадратного. paddingBottom-в-%
  // вместо aspectRatio — тот ломается для RN Image с локальным
  // плейсхолдером (react-native-web подставляет inline height по
  // натуральным пикселям самой картинки, игнорируя aspectRatio; та же
  // проблема и тот же фикс, что и на /explore, см. комментарий там).
  avatarLargeBox: { width: '100%', position: 'relative', backgroundColor: '#E5E5E5', paddingBottom: 0,     height: 345,  },
  // avatarLargeBox: { width: '100%', position: 'relative', backgroundColor: '#E5E5E5', paddingBottom: `${(409 / 339) * 100}%` },
  avatarLarge: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },

  // Mobile: имя/роль слева, небольшой квадратный аватар справа.
  // Mobile: имя отдельной строкой сверху, ниже — портретное фото слева и
  // роль/цена справа от него (см. референс мобильной страницы наставника).
  headerRowMobile: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', marginTop: 16, marginBottom: 16 },
  headerInfoMobile: { flex: 1, gap: 16 },
  avatarMobile: { width: 110, height: 132, backgroundColor: '#E5E5E5', flexShrink: 0 },
  priceTextMobile: { fontSize: 16, lineHeight: 22, fontFamily: 'Gramatika-Regular', color: '#010101' },

  name: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
  nameMobile: { fontSize: 25, lineHeight: 28 },
  role: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#000', marginTop: 18 },
  roleMobile: { fontSize: 16, lineHeight: 22, marginTop: 0 },
  bio: { fontSize: 18, lineHeight: 18, fontFamily: 'Gramatika-Regular', color: '#010101', marginVertical: 16 },
  // Стоимость — на отдельной строке под подписью (не в один ряд).
  priceRow: { flexDirection: 'column', gap: 2, marginBottom: 24 },
  priceLabel: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#000000', lineHeight: 18 },
  priceValue: { fontSize: 18, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#000', lineHeight: 18 },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginBottom: 8,     position: 'absolute',
    bottom: 0,     width: '100%',
    justifyContent: 'space-between' },
  actionLink: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 18, color: '#E02D2D', lineHeight: 18 },
  actionsRowContainer: { position: 'relative', height: '100%' },

  // Мобильные экшн-кнопки — два чипа в ряд, а не колонка на всю ширину.
  actionsRowMobile: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  chipHalf: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#F0F5FB', paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  chipHalfText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 14, color: '#68717A' },

  instagramDisclaimer: { fontSize: 11, lineHeight: 15, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginTop: 8, marginBottom: 8 },

  eventsSection: { marginTop: 40 },
  eventsSectionTitle: { fontSize: 40, lineHeight: 23, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 93 },
  eventsSectionTitleMobile: { fontSize: 25, lineHeight: 28, marginBottom: 24 },
  eventsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20},

  // Полноширинная сетка "События наставника"/"Прошедшие события" — своя,
  // отдельная от 2-колоночного desktopGrid выше (текст/фото), см.
  // renderMentorEventsGrid/renderMentorGridCard. Колонки 1/3/5 — карточки
  // (см. MENTOR_ROW_COLUMNS), 2/4 — зазоры.
  mentorEventsSection: { marginTop: 273 },
  mentorEventsRow: { display: 'grid', gridTemplateColumns: '403fr 75fr 365fr 266fr 340fr' } as any,
  mentorEventsRowSpacing: { marginTop: 113 },
  mentorGridImage: { width: '100%', backgroundColor: '#E5E5E5' },
  // card--d по референсу — третья карточка каждой второй строки уже
  // остальных (84.4% вместо 100%), только картинка, не весь блок карточки.
  mentorGridImageNarrow: { width: '84.4%' },

  eventCard: { width: '31%' },
  eventCardMobile: { width: '47%' },
  eventCardHalf: { width: '47%' },
  eventCardFull: { width: '100%' },
  eventCover: { width: '100%', aspectRatio: 1.2, backgroundColor: '#E5E5E5' },
  eventCoverPlaceholder: { backgroundColor: '#E5E5E5' },
  // Прошедшие события наставника — постоянно в том же затемнении, что и
  // hover-эффект любого кликабельного блока сайта (opacity:0.5, см.
  // app/_layout.tsx), но навсегда, не только при наведении.
  eventDimmed: { opacity: 0.5 },
  eventCardBody: { paddingTop: 10 },
  eventFormat: { fontSize: 18, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#687076', marginBottom: 4, marginTop: 12, lineHeight: 0.9 },
  eventCardTitle: { fontSize: 25, fontFamily: 'Gramatika-Regular', fontWeight: 'regular', color: '#010101', marginBottom: 4, marginTop: 12, lineHeight: 25 },
  eventCardMeta: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#000000', marginTop: 27, lineHeight: 1, textAlign: 'right' },

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
