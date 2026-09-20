import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PromoBanner } from '@/components/web/promo-banner';
import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { API_BASE, endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';
import { parseFeedItems } from '@/lib/event-feed';

function resolveUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

type EventFeedItem = {
  id: string;
  title: string;
  description?: string;
  datetimeStart?: string;
  coverUrl?: string | null;
  format?: string;
  mentor?: { id: string; name: string; avatarUrl?: string | null };
  [key: string]: unknown;
};

/**
 * Формат события — пока читаем из поля type/format, если бэкенд его отдаёт.
 * Нужно бэкенду: подтвердить/добавить поле формата события с этими значениями
 * (или прислать маппинг) — иначе фильтры кроме "Трансляция" будут пустыми.
 */
const FORMATS = ['Трансляция', 'Лекция', 'Практика', 'Встреча'];
// "Обсуждение" визуально отделён от остальных фильтров (см. макет — большой
// отступ, пилюля прижата к правому краю), но работает как обычный фильтр.
const DISCUSSION_FORMAT = 'Обсуждение';

const PER_PAGE = 20;

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function formatEventTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTHS_GEN[d.getMonth()];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${hh}:${mm}`;
  } catch {
    return '';
  }
}

export default function EventsScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();
  const [events, setEvents] = useState<EventFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [format, setFormat] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

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
      format: (r.format as string) ?? (r.type as string) ?? undefined,
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

  const filtered = format ? events.filter((e) => e.format === format) : events;

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          <Pressable onPress={() => setFormat(null)}>
            <Text style={styles.title}>Ближайшие события</Text>
          </Pressable>
        </View>

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
              onPress={() => setFormat(format === DISCUSSION_FORMAT ? null : DISCUSSION_FORMAT)}
            >
              <Text style={[styles.filterPillText, format === DISCUSSION_FORMAT && styles.filterPillTextActive]}>{DISCUSSION_FORMAT}</Text>
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
                  <Text style={styles.cardAuthor} numberOfLines={1}>{item.mentor?.name ?? ''}</Text>
                  <Text style={styles.mobileTitleText} numberOfLines={3}>{item.title}</Text>
                  <Text style={styles.cardTime}>{formatEventTime(item.datetimeStart)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((item, idx) => {
              const large = idx < 2;
              return (
                <Pressable key={item.id} style={large ? styles.cardLarge : styles.cardSmall} onPress={() => router.push(`/(tabs)/events/${item.id}` as any)}>
                  {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={large ? styles.imageLarge : styles.imageSmall} resizeMode="cover" /> : null}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardAuthor} numberOfLines={1}>{item.mentor?.name ?? ''}</Text>
                    <Text style={styles.cardTitleText} numberOfLines={3}>{item.title}</Text>
                    <Text style={styles.cardTime}>{formatEventTime(item.datetimeStart)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {!loading && !error && filtered.length > 0 ? <PromoBanner /> : null}

        {!loading && !error && hasMore ? (
          <Pressable style={[styles.loadMoreButton, isMobile && styles.chipButton]} onPress={loadMore} disabled={loadingMore}>
            {loadingMore ? <ActivityIndicator color="#010101" /> : <Text style={[styles.loadMoreButtonText, isMobile && styles.chipButtonText]}>Показать ещё</Text>}
          </Pressable>
        ) : null}

        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 24 },
  titleRow: { marginBottom: 16 },
  title: { fontSize: 28, lineHeight: 34, fontFamily: 'Gramatika-Bold', color: '#010101' },
  filtersRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  filtersGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, flexShrink: 1 },
  filterPill: { paddingVertical: 4 },
  filterPillRight: { marginLeft: 'auto', paddingLeft: 24 },
  filterPillText: { fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#687076' },
  filterPillTextActive: { color: '#010101', fontFamily: 'Gramatika-Bold' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 16 },
  emptyText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#687076' },
  retryButton: { borderWidth: 1, borderColor: '#010101', paddingVertical: 10, paddingHorizontal: 32 },
  retryButtonText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101' },
  loadMoreButton: { alignSelf: 'center', borderWidth: 1, borderColor: '#010101', paddingVertical: 12, paddingHorizontal: 40, marginTop: 24 },
  loadMoreButtonText: { fontSize: 14, fontFamily: 'Gramatika-Bold', color: '#010101' },
  // Мобильные экшн-кнопки — заливка вместо обводки, см. мобильные макеты.
  chipButton: { backgroundColor: '#F0F5FB', borderWidth: 0 },
  chipButtonText: { color: '#68717A' },
  // Первые 2 события — крупные карточки в 2 колонки, остальные — мельче, по 3 в ряд (см. макет).
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  cardLarge: { flexBasis: 460, flexGrow: 1, minWidth: 340 },
  cardSmall: { flexBasis: 280, flexGrow: 1, minWidth: 240 },
  imageLarge: { width: '100%', height: 260 },
  imageSmall: { width: '100%', height: 190 },
  cardBody: { paddingTop: 12 },
  cardAuthor: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 6 },
  cardTitleText: { fontSize: 16, lineHeight: 22, fontFamily: 'Gramatika-Regular', color: '#010101' },
  cardTime: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#687076', textAlign: 'right', marginTop: 12 },
  // Мобильный список — маленькая обложка слева, текст справа, без сетки карточек.
  mobileList: { gap: 20 },
  mobileRow: { flexDirection: 'row', gap: 12 },
  mobileThumb: { width: 88, height: 64, backgroundColor: '#E5E5E5' },
  mobileInfo: { flex: 1, justifyContent: 'center' },
  mobileTitleText: { fontSize: 14, lineHeight: 18, fontFamily: 'Gramatika-Regular', color: '#010101', marginBottom: 4 },
});
