import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE, endpoints } from '@/constants/env';
import { clearAdminToken, getAdminToken } from '@/lib/admin-auth';

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminArticle = {
  id: string;
  title: string;
  category: string | null;
  coverUrl: string | null;
  author?: { name?: string };
  createdAt?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

function normalizeArticle(raw: Record<string, unknown>): AdminArticle {
  const author = raw.author as Record<string, unknown> | undefined;
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    category: (raw.category as string) ?? null,
    coverUrl: resolveUrl(raw.cover_url),
    author: author ? { name: String(author.name ?? '') } : undefined,
    createdAt: (raw.created_at as string) ?? undefined,
  };
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return iso; }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminJournalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');

  const fetchArticles = useCallback(async (pageNum = 1, append = false, searchTerm = search) => {
    const token = await getAdminToken();
    if (!token) { router.replace('/admin/login'); return; }
    try {
      setError('');
      const params = new URLSearchParams({ page: String(pageNum), per_page: '20' });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      const res = await fetch(`${endpoints.adminArticles}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { await clearAdminToken(); router.replace('/admin/login'); return; }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.message ?? `Ошибка (${res.status})`);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : [];
      const items = list.map((r: any) => normalizeArticle(r));
      const total = typeof data?.pagination?.total === 'number' ? data.pagination.total : items.length;
      setHasMore(pageNum * 20 < total);
      setArticles(append ? (prev) => [...prev, ...items] : items);
      setPage(pageNum);
    } catch {
      setError('Не удалось загрузить материалы');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [router, search]);

  useEffect(() => {
    setLoading(true);
    fetchArticles(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = () => { setLoading(true); fetchArticles(1, false, search); };

  const renderItem = ({ item }: { item: AdminArticle }) => (
    <Pressable style={styles.card} onPress={() => router.push(`/admin/journal-detail?id=${item.id}` as any)}>
      {item.coverUrl ? (
        <Image source={{ uri: item.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]} />
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title || '—'}</Text>
        {item.author?.name ? <Text style={styles.cardMeta}>{item.author.name}</Text> : null}
        <View style={styles.cardFooter}>
          {item.category ? (
            <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{item.category}</Text></View>
          ) : null}
          <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>ЖУРНАЛ</Text>
        <Pressable style={styles.createBtn} onPress={() => router.push('/admin/journal-detail' as any)}>
          <Text style={styles.createBtnText}>+ Создать</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Поиск по названию"
          placeholderTextColor="#9B9B9B"
          onSubmitEditing={runSearch}
          returnKeyType="search"
        />
        <Pressable style={styles.searchBtn} onPress={runSearch}>
          <Text style={styles.searchBtnText}>Найти</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); fetchArticles(1, false); }}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchArticles(1, false); }} />}
          onEndReached={() => { if (hasMore && !loadingMore) { setLoadingMore(true); fetchArticles(page + 1, true); } }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>Материалов нет</Text></View>}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color="#181818" /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#1E1E1E', gap: 12 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 28, lineHeight: 30, color: '#181818', marginTop: -2 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818' },
  createBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#181818' },
  createBtnText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#fff' },

  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#E5E5E5' },
  searchInput: { flex: 1, borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  searchBtn: { borderWidth: 1, borderColor: '#181818', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818' },

  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  card: { flexDirection: 'row', borderWidth: 1, borderColor: '#1E1E1E', marginBottom: 10, backgroundColor: '#fff' },
  cover: { width: 72, height: 72 },
  coverPlaceholder: { backgroundColor: '#E5E5E5' },
  cardBody: { flex: 1, paddingVertical: 8, paddingHorizontal: 10 },
  cardTitle: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', fontWeight: '600', color: '#181818', marginBottom: 2 },
  cardMeta: { fontSize: 11, lineHeight: 15, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryBadge: { backgroundColor: '#E5E5E5', paddingHorizontal: 7, paddingVertical: 2 },
  categoryBadgeText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#181818' },
  cardDate: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#9B9B9B' },

  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 12 },
  retryBtn: { borderWidth: 1, borderColor: '#181818', paddingVertical: 10, paddingHorizontal: 24 },
  retryText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
});
