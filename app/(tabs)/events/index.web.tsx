import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PromoBanner } from '@/components/web/promo-banner';
import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { API_BASE, endpoints } from '@/constants/env';
import { getAuthRole, getAuthToken } from '@/lib/auth';
import { parseFeedItems } from '@/lib/event-feed';

function resolveUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

// На карточках — только дата (без времени, см. страницу события — там оно есть).
function formatEventDate(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  } catch {
    return '';
  }
}

type EventFeedItem = {
  id: string;
  title: string;
  description?: string;
  datetimeStart?: string;
  coverUrl?: string | null;
  format?: string;
  topic?: string;
  tags?: string[];
  mentor?: { id: string; name: string; avatarUrl?: string | null };
  [key: string]: unknown;
};

const FORMATS = ['Трансляция', 'Лекция', 'Практика', 'Встреча'];

/**
 * Событие хранит формат в поле category (enum EventCategory на бэкенде —
 * см. backend/src/events/entities/event.entity.ts), не format/type — фид
 * отдаёт английский слаг ('lecture', 'practices', ...), переводим в те же
 * подписи, что в фильтрах выше. r.format/r.type — старый фолбэк на случай,
 * если где-то на бэкенде эти поля всё же присылаются вместо category.
 */
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

const PER_PAGE = 20;

// Точные пропорции блоков и отступы — с vladyakunin.ru/projects/ (.proj-featured,
// .proj-row): 2 крупные карточки сверху (649:84:716, у второй картинка+текст
// уже, 72.8% от своей колонки — 716*0.728≈521), дальше строки по 3 карточки —
// тот же приём: CSS grid 403:75:365:76:340:191 (последняя колонка пустая),
// карточки стоят в колонках 1/3/5 (.proj-row .card:nth-child(1/2/3)). Отступ
// сверху чередуется: 254 у нечётных по счёту строк троек (.proj-row--2),
// 120 у чётных (.proj-row--3).
const FEATURED_ASPECT: [number, number] = [649 / 360, 521 / 294];
const ROW_ASPECTS: [number, number, number] = [403 / 285, 365 / 211, 340 / 232];
const ROW_GRID_COLUMNS: [string, string, string] = ['1', '3', '5'];

export default function EventsScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();
  // ?tag=... — переход по клику на хэштег на странице события (см.
  // TagList/onTagPress там) — список событий с этим тегом. Фильтрует
  // только уже загруженную страницу фида (как и обычный фильтр по
  // формату ниже — сервер по тегам не фильтрует).
  const { tag: tagParam } = useLocalSearchParams<{ tag?: string }>();
  const activeTag = typeof tagParam === 'string' ? tagParam : Array.isArray(tagParam) ? tagParam[0] : null;
  const [events, setEvents] = useState<EventFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [format, setFormat] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isAuthedTutor, setIsAuthedTutor] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [token, role] = await Promise.all([getAuthToken(), getAuthRole()]);
      if (active) setIsAuthedTutor(Boolean(token) && role === 'tutor');
    })();
    return () => { active = false; };
  }, []);

  // Авторизованного наставника "Создать событие" ведёт сразу в попап
  // создания на его личной странице (как "Создать событие"/"Написать
  // статью" там же), а не на анкету регистрации наставника — она нужна
  // только тем, кто ещё не наставник.
  function handleCreateEventPress() {
    router.push((isAuthedTutor ? '/profile?open=event' : '/register-tutor') as any);
  }

  const fetchRegisteredIds = useCallback(async (): Promise<Set<string>> => {
    const registeredIds = new Set<string>();
    try {
      const token = await getAuthToken();
      if (token) {
        const myRes = await fetch(`${endpoints.eventsMy}?role=student&filter=all&time=all&page=1&per_page=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (myRes.ok) {
          const myData = await myRes.json();
          const myList = parseFeedItems(myData) as Record<string, unknown>[];
          myList.forEach((e) => { const eid = String(e.id ?? ''); if (eid) registeredIds.add(eid); });
        }
      }
    } catch { /* ignore — show all events if fetch fails */ }
    return registeredIds;
  }, []);

  const fetchPage = useCallback(async (pageToLoad: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(`${endpoints.eventsFeed}?page=${pageToLoad}&per_page=${PER_PAGE}`, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message ?? body?.error ?? `Ошибка загрузки событий (${res.status})`);
    }
    const data = await res.json();
    const rawList = parseFeedItems(data) as Record<string, unknown>[];
    const normalized: EventFeedItem[] = rawList.map((r) => ({
      id: String(r.id ?? ''),
      title: String(r.title ?? ''),
      description: (r.description as string) ?? undefined,
      datetimeStart: (r.datetimeStart ?? r.datetime_start ?? r.startAt ?? r.start_at) as string | undefined,
      coverUrl: resolveUrl(r.coverUrl ?? r.cover_url ?? r.imageUrl ?? r.image_url ?? r.cover ?? r.thumbnail ?? r.photo ?? r.photoUrl ?? r.photo_url),
      format: resolveFormat(r),
      topic: (r.topic as string) ?? undefined,
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      mentor: r.mentor ? {
        id: String((r.mentor as any).id ?? ''),
        name: String((r.mentor as any).name ?? (r.mentor as any).fullName ?? (r.mentor as any).full_name ?? ''),
        avatarUrl: resolveUrl((r.mentor as any).avatarUrl ?? (r.mentor as any).avatar_url) as string | null,
      } : undefined,
    }));

    // Пагинация: используем total из ответа, если бэкенд его отдаёт (как в
    // /api/events/my), иначе считаем, что есть ещё страницы, пока страница
    // приходит полной (эвристика на случай отсутствия поля total/meta).
    const root = data as Record<string, unknown>;
    const pag = (root.pagination ?? root.meta) as Record<string, unknown> | undefined;
    const total = typeof pag?.total === 'number' ? pag.total : undefined;
    const more = total != null ? pageToLoad * PER_PAGE < total : normalized.length === PER_PAGE;

    return { items: normalized, hasMore: more };
  }, []);

  const load = useCallback(async () => {
    try {
      setError('');
      const [{ items, hasMore: more }, registeredIds] = await Promise.all([fetchPage(1), fetchRegisteredIds()]);
      const now = Date.now();
      setEvents(items.filter((item) => {
        if (registeredIds.has(item.id)) return false;
        if (!item.datetimeStart) return true;
        return new Date(item.datetimeStart).getTime() > now;
      }));
      setPage(1);
      setHasMore(more);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить события');
      setEvents([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchPage, fetchRegisteredIds]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const [{ items, hasMore: more }, registeredIds] = await Promise.all([fetchPage(nextPage), fetchRegisteredIds()]);
      const now = Date.now();
      const fresh = items.filter((item) => {
        if (registeredIds.has(item.id)) return false;
        if (!item.datetimeStart) return true;
        return new Date(item.datetimeStart).getTime() > now;
      });
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...fresh.filter((e) => !seen.has(e.id))];
      });
      setPage(nextPage);
      setHasMore(more);
    } catch {
      // Оставляем hasMore как есть — пользователь может нажать "Показать ещё" снова.
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, fetchPage, fetchRegisteredIds]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const filtered = events
    .filter((e) => !format || e.format === format)
    .filter((e) => !activeTag || e.tags?.includes(activeTag));

  function clearTagFilter() {
    router.replace('/events' as any);
  }

  // variant: 'A' — первая пара цикла (pairA), 'B' — третья строка цикла
  // (pairB) — у неё свои классы, не переиспользует стили pairA: второй
  // блок pairA — 72.8% ширины колонки, второй блок pairB — 100%.
  function renderFeaturedCard(item: EventFeedItem, index: 0 | 1, variant: 'A' | 'B') {
    const isSecond = index === 1;
    const cardStyle = variant === 'B'
      ? (isSecond ? styles.featuredCardTwoB : styles.featuredCardOneB)
      : (isSecond ? styles.featuredCardTwo : styles.featuredCardOne);
    const innerStyle = isSecond
      ? (variant === 'B' ? styles.featuredInnerTwoB : styles.featuredInnerTwo)
      : undefined;
    const labelStyle = variant === 'B'
      ? (isSecond ? styles.featuredLabelTwoB : styles.featuredLabelOneB)
      : (isSecond ? styles.featuredLabelTwo : styles.featuredLabelOne);
    const titleStyle = variant === 'B'
      ? (isSecond ? styles.featuredTitleTwoB : styles.featuredTitleOneB)
      : (isSecond ? styles.featuredTitleTwo : styles.featuredTitleOne);
    return (
      <Pressable
        key={item.id}
        style={cardStyle}
        onPress={() => router.push(`/(tabs)/events/${item.id}` as any)}
      >
        <View style={innerStyle}>
          {item.coverUrl ? (
            <Image source={{ uri: item.coverUrl }} style={[styles.featuredImage, isSecond ? styles.featuredImageTwo : { aspectRatio: FEATURED_ASPECT[index] }]} resizeMode="cover" />
          ) : (
            <View style={[styles.featuredImage, isSecond ? styles.featuredImageTwo : { aspectRatio: FEATURED_ASPECT[index] }]} />
          )}
          <View style={labelStyle}>
            {item.mentor?.name ? <Text style={styles.cardAuthor} numberOfLines={1}>{item.mentor.name}</Text> : null}
          </View>
          <Text style={[styles.cardTitleText, titleStyle]}>{item.title}</Text>
          {item.datetimeStart ? <Text style={styles.cardDate}>{formatEventDate(item.datetimeStart)}</Text> : null}
        </View>
      </Pressable>
    );
  }

  function renderRowCard(item: EventFeedItem, posInRow: 0 | 1 | 2) {
    return (
      <Pressable key={item.id} style={{ gridColumn: ROW_GRID_COLUMNS[posInRow] } as any} onPress={() => router.push(`/(tabs)/events/${item.id}` as any)}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={[styles.rowImage, { aspectRatio: ROW_ASPECTS[posInRow] }]} resizeMode="cover" />
        ) : (
          <View style={[styles.rowImage, { aspectRatio: ROW_ASPECTS[posInRow] }]} />
        )}
        <View style={styles.rowLabel}>
          {item.mentor?.name ? <Text style={styles.cardAuthor} numberOfLines={1}>{item.mentor.name}</Text> : null}
        </View>
        <Text style={[styles.cardTitleText, styles.rowTitle]}>{item.title}</Text>
        {item.datetimeStart ? <Text style={styles.cardDate}>{formatEventDate(item.datetimeStart)}</Text> : null}
      </Pressable>
    );
  }

  // Повторяющийся цикл из 4 строк (как на /journal — см. комментарий там):
  // 1) пара 649:84:716 ("pairA", бывший featured), 2) тройка
  // 403:75:365:76:340:191, 3) пара 481:165:611:193 ("pairB"), 4) снова
  // тройка — и цикл начинается заново с 1). Баннер — после каждой 3-й
  // строки этого цикла (считая строки любого типа подряд).
  const rows: { type: 'pairA' | 'triple' | 'pairB'; items: EventFeedItem[] }[] = [];
  {
    const cycle: ('pairA' | 'triple' | 'pairB')[] = ['pairA', 'triple', 'pairB', 'triple'];
    let i = 0;
    let cycleIdx = 0;
    while (i < filtered.length) {
      const type = cycle[cycleIdx % cycle.length];
      const count = type === 'triple' ? 3 : 2;
      const items = filtered.slice(i, i + count);
      if (items.length === 0) break;
      rows.push({ type, items });
      i += items.length;
      cycleIdx++;
    }
  }

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={[styles.scrollContent, isMobile && styles.scrollContentMobile]}>
      <View style={[styles.pageContent, isMobile && styles.pageContentMobile]}>
        <View style={[styles.titleRow, isMobile && styles.titleRowMobile]}>
          <Pressable onPress={() => setFormat(null)}>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>Ближайшие события</Text>
          </Pressable>
          {isMobile ? (
            <Pressable onPress={() => router.push('/about' as any)}>
              <Text style={styles.aboutLink}>О сервисе</Text>
            </Pressable>
          ) : null}
        </View>

        {activeTag ? (
          <Pressable style={styles.activeTagChip} onPress={clearTagFilter}>
            <Text style={styles.activeTagChipText}>#{activeTag}</Text>
          </Pressable>
        ) : null}

        {!isMobile ? (
          <View style={styles.filtersRow}>
            <View style={styles.filtersGroup}>
              {FORMATS.map((f) => {
                const active = f === format;
                return (
                  <Pressable key={f} style={styles.filterPill} onPress={() => setFormat(active ? null : f)}>
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{f}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={[styles.filterPill, styles.filterPillRight]}
              onPress={handleCreateEventPress}
            >
              <Text style={styles.createEventPillText}>Создать событие</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#010101" /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={[styles.retryButton, isMobile && styles.chipButton]} onPress={() => { setLoading(true); load(); }}>
              <Text style={[styles.retryButtonText, isMobile && styles.chipButtonText]}>Повторить</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centered}><Text style={styles.emptyText}>Событий пока нет</Text></View>
        ) : isMobile ? (
          <View style={styles.mobileList}>
            {filtered.map((item) => (
              <Pressable key={item.id} style={styles.mobileRow} onPress={() => router.push(`/(tabs)/events/${item.id}` as any)}>
                {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.mobileThumb} resizeMode="cover" /> : <View style={styles.mobileThumb} />}
                <View style={styles.mobileInfo}>
                  <View>
                    {item.mentor?.name ? <Text style={styles.mobileAuthor} numberOfLines={1}>{item.mentor.name}</Text> : null}
                    <Text style={styles.mobileTitleText}>{item.title}</Text>
                  </View>
                  {item.datetimeStart ? <Text style={styles.mobileDate}>{formatEventDate(item.datetimeStart)}</Text> : null}
                </View>
              </Pressable>
            ))}
            <Pressable
              style={styles.createEventButton}
              onPress={handleCreateEventPress}
            >
              <Text style={styles.createEventButtonText}>Создать событие</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            {rows.map((row, rowIdx) => {
              // Отступ сверху — одинаковый для ВСЕХ строк подряд (не только
              // троек): первая строка — 80 (отступ от фильтров), дальше 120
              // между каждой следующей парой строк.
              const marginTop = rowIdx === 0 ? 80 : 120;
              const rowEl = row.type === 'triple' ? (
                <View style={[styles.rowThree, { marginTop }]}>
                  {row.items.map((item, pos) => renderRowCard(item, pos as 0 | 1 | 2))}
                </View>
              ) : (
                <View style={[row.type === 'pairA' ? styles.featuredRow : styles.pairBRow, { marginTop }]}>
                  {renderFeaturedCard(row.items[0], 0, row.type === 'pairB' ? 'B' : 'A')}
                  {row.items.length > 1 ? <View /> : null}
                  {row.items.length > 1 ? renderFeaturedCard(row.items[1], 1, row.type === 'pairB' ? 'B' : 'A') : null}
                </View>
              );
              return (
                <React.Fragment key={row.items.map((r) => r.id).join('-')}>
                  {rowEl}
                  {(rowIdx + 1) % 3 === 0 ? (
                    // Баннер после каждой 3-й строки (любого типа) — та же
                    // сетка rowThree, колонки 1..5 (без пустой 6-й), чтобы
                    // правый край совпадал с карточками.
                    <View style={styles.rowThree}>
                      <View style={styles.promoBannerCell}>
                        <PromoBanner />
                      </View>
                    </View>
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>
        )}

        {!loading && !error && hasMore ? (
          <Pressable style={[styles.loadMoreButton, isMobile && styles.chipButton]} onPress={loadMore} disabled={loadingMore}>
            {loadingMore ? <ActivityIndicator color="#010101" /> : <Text style={[styles.loadMoreButtonText, isMobile && styles.chipButtonText]}>Показать ещё</Text>}
          </Pressable>
        ) : null}
      </View>

        <SiteFooter showPartners />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  // Отступы страницы — как .container/.page-head на vladyakunin.ru/projects/
  // (--pad:31px, заголовок 106px от шапки).
  scrollContent: { paddingTop: 63, paddingBottom: 24 },
  scrollContentMobile: { paddingTop: 0 },
  pageContent: { paddingHorizontal: 31, paddingRight: 31 },
  // paddingRight:240 у десктопной версии — оставляет поле под decor справа
  // (.proj-mosaic), на мобильном экране просто съедает всю ширину контента.
  pageContentMobile: { paddingHorizontal: 20, paddingRight: 20 },
  titleRow: {},
  // Активный фильтр по тегу (переход по клику на #хэштег на странице
  // события, см. TagList/onTagPress) — чип с крестиком сбрасывает фильтр.
  activeTagChip: { alignSelf: 'flex-start', marginTop: 12 },
  activeTagChipText: { fontFamily: 'Gramatika-Regular', fontSize: 16, color: '#687076' },
  // Напротив заголовка — «О сервисе» тем же приёмом, что в нативном
  // приложении (app/(tabs)/events/index.tsx: titleRow + aboutLink).
  titleRowMobile: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'regular', color: '#010101', marginTop: 23 },
  titleMobile: { fontSize: 25, lineHeight: 28 },
  aboutLink: {
    fontSize: 13, lineHeight: 28, fontFamily: 'Gramatika-Regular', color: '#010101',
    textDecorationLine: 'underline',
  },
  // .proj-tabs: margin-top:68, gap:46 от заголовка.
  filtersRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 68 },
  filtersGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 46, flexShrink: 1 },
  filterPill: { paddingVertical: 4 },
  // margin-right:13.4% — как .page-projects .proj-tabs > :last-child на
  // vladyakunin.ru/projects/: последняя пилюля не прижата к самому краю
  // контента, а слегка утоплена, вровень с более узкой второй картинкой.
  filterPillRight: { marginLeft: 'auto', marginRight: '13.4%', paddingLeft: 24 },
  filterPillText: { fontFamily: 'Gramatika-Regular', fontSize: 30, lineHeight: 27, color: '#838383' },
  filterPillTextActive: { color: '#010101', fontFamily: 'Gramatika-Regular', fontWeight: 'normal' },
  // Вариант А (сравниваем с вариантом Б на /journal, см. writeTextButtonText
  // там): красный текст всегда — автоматически получает подчёркивание без
  // затемнения при наведении через общий механизм детекции "красного" цвета
  // в app/_layout.tsx (HoverDimCalibrator), ничего больше делать не нужно.
  createEventPillText: { fontFamily: 'Gramatika-Regular', fontSize: 30, lineHeight: 27, color: '#E02D2D' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 16 },
  emptyText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#687076' },
  retryButton: { borderWidth: 1, borderColor: '#010101', paddingVertical: 10, paddingHorizontal: 32 },
  retryButtonText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101' },
  loadMoreButton: { alignSelf: 'center', borderWidth: 1, borderColor: '#010101', paddingVertical: 12, paddingHorizontal: 40, marginTop: 24 },
  loadMoreButtonText: { fontSize: 14, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
  // Мобильные экшн-кнопки — заливка вместо обводки, см. мобильные макеты.
  chipButton: { backgroundColor: '#F0F5FB', borderWidth: 0 },
  chipButtonText: { color: '#68717A' },

  // Имя наставника — тип события (формат) здесь не показываем (только на
  // странице события и в рубрикаторе). Цвет — как .card__label на
  // vladyakunin.ru (чёрный текст, opacity:0.5), а не отдельный серый тон.
  cardAuthor: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#010101', opacity: 0.5, lineHeight: 18 },
  // .card__title: font-size:25, line-height:0.9 (22.5px) на vladyakunin.ru/projects/.
  cardTitleText: { fontSize: 25, lineHeight: 25, fontFamily: 'Gramatika-Regular', color: '#010101' },
  cardDate: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#000000', lineHeight: 1, textAlign: 'right', marginTop: 13  },
  // Полный повторяющийся цикл строк (см. rows/cycle выше): пара A — CSS grid
  // 649fr:84fr:716fr, пара B — 481fr:165fr:611fr:193fr (у обеих — пустая
  // колонка-спейсер после первой карточки, и у второй карточки картинка+текст
  // занимают только 72.8% её колонки). Тройка — CSS grid
  // 403fr:75fr:365fr:76fr:340fr:191fr, карточки в колонках 1/3/5 (см.
  // ROW_GRID_COLUMNS). Отступ сверху всех строк подряд — 80 (первая), затем
  // 254/120/254/120... (см. marginTop в рендере).
  featuredRow: { display: 'grid', gridTemplateColumns: '649fr 84fr 716fr' } as any,
  pairBRow: { display: 'grid', gridTemplateColumns: '481fr 165fr 611fr 193fr' } as any,
  // pairA (строка 1).
  featuredCardOne: { width: '100%' },
  featuredCardTwo: { width: '100%' },
  featuredInnerTwo: { width: '72.8%' },
  featuredLabelOne: { marginTop: 20 },
  featuredLabelTwo: { marginTop: 23 },
  featuredTitleOne: { marginTop: 13, fontSize: 25, lineHeight: 25},
  featuredTitleTwo: { marginTop: 15, lineHeight: 25 },
  // pairB (строка 3) — отдельные классы, не переиспользуют стили pairA:
  // второй блок строки 3 — на всю ширину колонки (100%), а не 72.8%, как
  // у второго блока строки 1.
  featuredCardOneB: { width: '100%' },
  featuredCardTwoB: { width: '100%' },
  featuredInnerTwoB: { width: '100%' },
  featuredLabelOneB: { marginTop: 20 },
  featuredLabelTwoB: { marginTop: 23 },
  featuredTitleOneB: { marginTop: 13, fontSize: 25, lineHeight: 25 },
  featuredTitleTwoB: { marginTop: 15, lineHeight: 25 },
  featuredImage: { width: '100%', backgroundColor: '#E5E5E5' },
  // Высота второй картинки фиксированная (248px), а не по aspect-ratio. У
  // пары B отдельных размеров картинок не дано — переиспользуем те же, что
  // и у пары A, чтобы не выдумывать новые числа.
  featuredImageTwo: { height: 248 },

  // .proj-row: CSS grid 403fr:75fr:365fr:76fr:340fr:191fr — карточки занимают
  // колонки 1/3/5 (см. ROW_GRID_COLUMNS), 2/4 — зазоры, 6 (191fr) — пустая
  // правая граница, специально не занята.
  rowThree: { display: 'grid', gridTemplateColumns: '403fr 75fr 365fr 76fr 340fr 191fr' } as any,
  // Баннер между тройками — только колонки 1..5 той же сетки (не заезжает
  // в пустую 6-ю), чтобы его правый край совпадал с правым краем карточек.
  promoBannerCell: { gridColumn: '1 / 6', marginTop: 120 } as any,
  rowImage: { width: '100%', backgroundColor: '#E5E5E5' },
  rowLabel: { marginTop: 18 },
  rowTitle: { marginTop: 12 },
  // Мобильный список — обложка слева (aspect-ratio 649/360, ~45% ширины
  // строки), текст справа: автор+заголовок сверху, дата — снизу и вправо
  // (см. моб. макет), а не по центру колонки, как раньше.
  mobileList: { gap: 28, marginTop: 30 },
  mobileRow: { flexDirection: 'row', gap: 20 },
  mobileThumb: { height: 120, width: 165, aspectRatio: 649 / 360, backgroundColor: '#E5E5E5' },
  mobileInfo: { flex: 1, justifyContent: 'space-between' },
  mobileAuthor: { fontSize: 10, fontFamily: 'Gramatika-Regular', color: '#010101', opacity: 0.5, marginBottom: 0, lineHeight: 10 },
  mobileTitleText: {  fontFamily: 'Gramatika-Regular', color: '#010101', marginTop: 8, fontSize: 13, lineHeight: 25 },
  mobileDate: { fontSize: 8, fontFamily: 'Gramatika-Regular', color: '#687076', alignSelf: 'flex-end' },
  // Та же заливка, что у «Создать событие» в нативном профиле наставника
  // (app/(tabs)/profile/[id].tsx: actionPrimary/actionPrimaryText) — чёрная
  // кнопка на всю ширину в конце списка, как «Все советы в Сетке» на референсе.
  createEventButton: { backgroundColor: '#111', alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  createEventButtonText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#FAFAFA' },
});
