import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE, endpoints } from '@/constants/env';
import { parseFeedItems } from '@/lib/event-feed';
import { getAuthToken } from '@/lib/auth';

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
  mentor?: { id: string; name: string; avatarUrl?: string | null };
  status?: string;
  [key: string]: unknown;
};

const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

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

export default function EventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<EventFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

    const load = useCallback(async () => {
    try {
      setError('');
      // Public endpoint — never send auth token; 15 s timeout
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
        const msg = body?.message ?? body?.error ?? `Ошибка загрузки событий (${res.status})`;
        setError(msg);
        setEvents([]);
        return;
      }
      const data = await res.json();
      const rawList = parseFeedItems(data) as Record<string, unknown>[];
      // Нормализуем snake_case → camelCase для картинок и дат
      const normalized: EventFeedItem[] = rawList.map((r) => ({
        id: String(r.id ?? ''),
        title: String(r.title ?? ''),
        description: (r.description as string) ?? undefined,
        datetimeStart: (r.datetimeStart ?? r.datetime_start ?? r.startAt ?? r.start_at) as string | undefined,
        price: typeof r.price === 'number' ? r.price
          : typeof r.price === 'string' ? parseFloat(r.price as string) || undefined
          : undefined,
        coverUrl: resolveUrl(
          r.coverUrl ?? r.cover_url ?? r.imageUrl ?? r.image_url ??
          r.cover ?? r.thumbnail ?? r.photo ?? r.photoUrl ?? r.photo_url ?? r.previewUrl ?? r.preview_url
        ),
        mentor: r.mentor ? {
          id: String((r.mentor as any).id ?? ''),
          name: String((r.mentor as any).name ?? (r.mentor as any).fullName ?? (r.mentor as any).full_name ?? ''),
          avatarUrl: resolveUrl((r.mentor as any).avatarUrl ?? (r.mentor as any).avatar_url) as string | null,
        } : undefined,
        status: (r.status as string) ?? undefined,
      }));
      // Fetch user data: registered events + profile ID (to filter own created events)
      const registeredIds = new Set<string>();
      let currentUserId: string | null = null;
      try {
        const token = await getAuthToken();
        if (token) {
          const [myRes, { getUserProfile }] = await Promise.all([
            fetch(`${endpoints.eventsMy}?role=student&filter=all&time=all&page=1&per_page=50`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            import('@/lib/auth'),
          ]);
          if (myRes.ok) {
            const myData = await myRes.json();
            const myList = parseFeedItems(myData) as Record<string, unknown>[];
            myList.forEach((e) => {
              const eid = String(e.id ?? '');
              if (eid) registeredIds.add(eid);
            });
          }
          const profile = await getUserProfile().catch(() => null);
          currentUserId = profile?.id ?? null;
        }
      } catch { /* ignore — show all events if fetch fails */ }

      const now = Date.now();
      setEvents(
        normalized.filter((item) => {
          if (registeredIds.has(item.id)) return false;
          if (!item.datetimeStart) return true;
          return new Date(item.datetimeStart).getTime() > now;
        })
      );
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить события');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#181818" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.titleRow, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.titleText}>БЛИЖАЙШИЕ СОБЫТИЯ</Text>
        <Pressable onPress={() => router.push('/about' as any)}>
          <Text style={styles.aboutLink}>О сервисе</Text>
        </Pressable>
      </View>
      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.retryButtonText}>Повторить</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/(tabs)/events/${item.id}` as any)}
            >
              {item.coverUrl ? (
                <Image source={{ uri: item.coverUrl }} style={styles.image} resizeMode="cover" />
              ) : null}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitleText}>{item.title}</Text>
                {item.description ? (
                  <Text style={styles.description} numberOfLines={3} ellipsizeMode="tail">
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <View style={styles.footer}>
                <Text style={styles.footerTime}>{formatEventTime(item.datetimeStart)}</Text>
                {typeof item.price === 'number' ? (
                  <View style={styles.priceContainer}>
                    <Text style={styles.footerPrice}>{item.price.toLocaleString('ru-RU')} ₽</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  titleText: {
    fontSize: 20, lineHeight: 26, fontFamily: 'Inter-Regular', color: '#181818',
  },
  aboutLink: {
    fontSize: 13, lineHeight: 26, fontFamily: 'Inter-Regular', color: '#181818',
    textDecorationLine: 'underline',
  },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 16, paddingHorizontal: 24 },
  retryButton: { borderWidth: 1, borderColor: '#181818', paddingVertical: 10, paddingHorizontal: 32 },
  retryButtonText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  card: { borderWidth: 1, borderColor: '#1E1E1E', marginHorizontal: 16, marginBottom: 16, backgroundColor: '#fff' },
  image: { width: '100%', height: 200, borderBottomWidth: 1, borderColor: '#1E1E1E' },
  imagePlaceholder: { backgroundColor: '#E5E5E5' },
  cardBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  cardTitleText: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 6 },
  description: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#181818' },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch',
    borderTopWidth: 1, borderColor: '#1E1E1E',
  },
  footerTime: {
    fontSize: 14, fontFamily: 'Inter-Regular', color: '#FFFFFF',
    backgroundColor: '#1E1E1E', paddingHorizontal: 16, paddingVertical: 10,
  },
  priceContainer: { borderLeftWidth: 1, borderColor: '#1E1E1E', paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  footerPrice: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#1E1E1E' },
});
