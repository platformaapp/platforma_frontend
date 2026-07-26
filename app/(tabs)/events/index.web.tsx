import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  price?: number;
  coverUrl?: string | null;
  category?: string;
  mentor?: { id: string; name: string; avatarUrl?: string | null };
  [key: string]: unknown;
};

/**
 * Категории — пока чисто фронтенд-фильтр: бэкенд `/api/events/feed` не отдаёт
 * поле категории. Если у события нет `category`, оно попадёт только в "ВСЕ".
 * Нужно бэкенду: добавить category (design|theatre|music|poetry) в ответ фида.
 */
const CATEGORIES: { label: string; value: string | null }[] = [
  { label: 'ВСЕ', value: null },
  { label: 'ДИЗАЙН', value: 'design' },
  { label: 'ТЕАТР', value: 'theatre' },
  { label: 'МУЗЫКА', value: 'music' },
  { label: 'ПОЭЗИЯ', value: 'poetry' },
];

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
  const [events, setEvents] = useState<EventFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);
      let res: Response;
      try {
        res = await fetch(endpoints.eventsFeed, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? body?.error ?? `Ошибка загрузки событий (${res.status})`);
        setEvents([]);
        return;
      }
      const data = await res.json();
      const rawList = parseFeedItems(data) as Record<string, unknown>[];
      const normalized: EventFeedItem[] = rawList.map((r) => ({
        id: String(r.id ?? ''),
        title: String(r.title ?? ''),
        description: (r.description as string) ?? undefined,
        datetimeStart: (r.datetimeStart ?? r.datetime_start ?? r.startAt ?? r.start_at) as string | undefined,
        price: typeof r.price === 'number' ? r.price : typeof r.price === 'string' ? parseFloat(r.price as string) || undefined : undefined,
        coverUrl: resolveUrl(r.coverUrl ?? r.cover_url ?? r.imageUrl ?? r.image_url ?? r.cover ?? r.thumbnail ?? r.photo ?? r.photoUrl ?? r.photo_url),
        category: (r.category as string) ?? (r.type as string) ?? (r.tag as string) ?? undefined,
        mentor: r.mentor ? {
          id: String((r.mentor as any).id ?? ''),
          name: String((r.mentor as any).name ?? (r.mentor as any).fullName ?? (r.mentor as any).full_name ?? ''),
          avatarUrl: resolveUrl((r.mentor as any).avatarUrl ?? (r.mentor as any).avatar_url) as string | null,
        } : undefined,
      }));

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

      const now = Date.now();
      setEvents(normalized.filter((item) => {
        if (registeredIds.has(item.id)) return false;
        if (!item.datetimeStart) return true;
        return new Date(item.datetimeStart).getTime() > now;
      }));
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить события');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const filtered = category ? events.filter((e) => e.category === category) : events;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.logo}>p(34)</Text>
          <View style={styles.headerNav}>
            <Pressable onPress={() => router.push('/journal' as any)}>
              <Text style={styles.headerNavItem}>Ж</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/profile' as any)}>
              <Text style={styles.headerNavItem}>ЛК</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.headerTagline}>
          <Text style={styles.headerText}>
            Мы — платформа для свободных городских разговоров и художественных высказываний.
          </Text>
          <Text style={styles.headerText}>
            Здесь можно найти себе классного наставника, который поможет сделать первые шаги в
            искусстве, кино, литературе, музыке и всему тому новому, что появляется в вашей жизни —
            и все никак не хочет уходить
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.tabsRow}>
          <View style={styles.tabActive}><Text style={styles.tabActiveText}>СОБЫТИЯ</Text></View>
          <Pressable style={styles.tab} onPress={() => router.push('/explore' as any)}>
            <Text style={styles.tabText}>НАСТАВНИКИ</Text>
          </Pressable>
          <Pressable style={styles.tab} onPress={() => router.push('/myevents' as any)}>
            <Text style={styles.tabText}>МОИ ЗАПИСИ</Text>
          </Pressable>
        </View>

        <View style={styles.filtersRow}>
          {CATEGORIES.map((c) => {
            const active = c.value === category;
            return (
              <Pressable key={c.label} style={[styles.filterPill, active && styles.filterPillActive]} onPress={() => setCategory(c.value)}>
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => { setLoading(true); load(); }}>
              <Text style={styles.retryButtonText}>Повторить</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centered}><Text style={styles.emptyText}>Событий в этой категории пока нет</Text></View>
        ) : (
          <ScrollView contentContainerStyle={styles.grid}>
            {filtered.map((item) => (
              <Pressable key={item.id} style={styles.card} onPress={() => router.push(`/(tabs)/events/${item.id}` as any)}>
                {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.image} resizeMode="cover" /> : null}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitleText} numberOfLines={3}>{item.title}</Text>
                  {item.description ? <Text style={styles.description} numberOfLines={3}>{item.description}</Text> : null}
                </View>
                <View style={styles.footer}>
                  <Text style={styles.footerTime}>{formatEventTime(item.datetimeStart)}</Text>
                  {typeof item.price === 'number' ? (
                    <View style={styles.priceContainer}><Text style={styles.footerPrice}>{item.price.toLocaleString('ru-RU')} ₽</Text></View>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' },
  header: { backgroundColor: '#111', paddingHorizontal: 32, paddingTop: 24, paddingBottom: 32 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  logo: { fontFamily: 'Inter-Bold', fontSize: 28, color: '#FAFAFA' },
  headerNav: { flexDirection: 'row', gap: 24 },
  headerNavItem: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#FAFAFA' },
  headerTagline: { flexDirection: 'row', flexWrap: 'wrap', gap: 32 },
  headerText: { flexBasis: 320, flexGrow: 1, fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 19, color: '#CFCFCF' },
  body: { flex: 1, paddingHorizontal: 32, paddingTop: 24 },
  tabsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  tab: { paddingVertical: 8, paddingHorizontal: 16 },
  tabText: { fontFamily: 'Inter-Medium', fontSize: 13, color: '#687076' },
  tabActive: { paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E02D2D', borderRadius: 20 },
  tabActiveText: { fontFamily: 'Inter-Medium', fontSize: 13, color: '#E02D2D' },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  filterPill: { paddingVertical: 6, paddingHorizontal: 16, borderWidth: 1, borderColor: '#181818', borderRadius: 20 },
  filterPillActive: { backgroundColor: '#181818' },
  filterPillText: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#181818' },
  filterPillTextActive: { color: '#FAFAFA' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 16 },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#687076' },
  retryButton: { borderWidth: 1, borderColor: '#181818', paddingVertical: 10, paddingHorizontal: 32 },
  retryButtonText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingBottom: 48 },
  card: { flexBasis: 320, flexGrow: 1, minWidth: 280, borderWidth: 1, borderColor: '#1E1E1E', backgroundColor: '#fff' },
  image: { width: '100%', height: 200, borderBottomWidth: 1, borderColor: '#1E1E1E' },
  cardBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  cardTitleText: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 6 },
  description: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#181818' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch', borderTopWidth: 1, borderColor: '#1E1E1E' },
  footerTime: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#FFFFFF', backgroundColor: '#1E1E1E', paddingHorizontal: 16, paddingVertical: 10 },
  priceContainer: { borderLeftWidth: 1, borderColor: '#1E1E1E', paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  footerPrice: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#1E1E1E' },
});
