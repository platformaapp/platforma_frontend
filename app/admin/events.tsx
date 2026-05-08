import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE, endpoints } from '@/constants/env';
import { clearAdminToken, getAdminToken } from '@/lib/admin-auth';

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminEvent = {
  id: string;
  title: string;
  datetimeStart?: string;
  price?: number;
  coverUrl?: string | null;
  isBlocked: boolean;
  mentor?: { name?: string };
  registeredCount?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

function normalizeEvent(raw: Record<string, unknown>): AdminEvent {
  const mentorRaw = (raw.mentor ?? raw.teacher ?? raw.tutor) as Record<string, unknown> | undefined;
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    datetimeStart: (raw.datetimeStart ?? raw.datetime_start ?? raw.startAt ?? raw.start_at) as string | undefined,
    price: typeof raw.price === 'number' ? raw.price : typeof raw.price === 'string' ? parseFloat(raw.price) : undefined,
    coverUrl: resolveUrl(raw.coverUrl ?? raw.cover_url ?? raw.imageUrl),
    isBlocked: Boolean(raw.isBlocked ?? raw.is_blocked ?? false),
    mentor: mentorRaw ? { name: String(mentorRaw.name ?? mentorRaw.fullName ?? mentorRaw.full_name ?? '') } : undefined,
    registeredCount: typeof raw.registeredCount === 'number' ? raw.registeredCount
      : typeof raw.registered_count === 'number' ? raw.registered_count : undefined,
  };
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [blockTarget, setBlockTarget] = useState<AdminEvent | null>(null);
  const [blockConfirmVisible, setBlockConfirmVisible] = useState(false);
  const [isActioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchEvents = useCallback(async (pageNum = 1, append = false) => {
    const token = await getAdminToken();
    if (!token) { router.replace('/admin/login'); return; }
    try {
      setError('');
      const params = new URLSearchParams({ page: String(pageNum), per_page: '20' });
      const res = await fetch(`${endpoints.adminEventsAdmin}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { await clearAdminToken(); router.replace('/admin/login'); return; }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.message ?? `Ошибка (${res.status})`);
        return;
      }
      const data = await res.json();
      let rawItems: unknown = data.items ?? data.data ?? data;
      if (!Array.isArray(rawItems) && rawItems && typeof rawItems === 'object') {
        const inner = rawItems as Record<string, unknown>;
        rawItems = inner.items ?? inner.data ?? [];
      }
      const list = Array.isArray(rawItems) ? rawItems : [];
      const items = list.map((r: any) => normalizeEvent(r));
      const pag = (data.pagination ?? data.meta) as Record<string, unknown> | undefined;
      const total = typeof pag?.total === 'number' ? pag.total : items.length;
      setHasMore(pageNum * 20 < total);
      setEvents(append ? (prev) => [...prev, ...items] : items);
      setPage(pageNum);
    } catch {
      setError('Не удалось загрузить события');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [router]);

  useEffect(() => {
    setLoading(true);
    fetchEvents(1, false);
  }, [fetchEvents]);

  const openBlockConfirm = (ev: AdminEvent) => {
    setBlockTarget(ev);
    setActionError('');
    setBlockConfirmVisible(true);
  };

  const handleBlockToggle = async () => {
    if (!blockTarget) return;
    const token = await getAdminToken();
    if (!token) return;
    setActioning(true);
    setActionError('');
    try {
      const action = blockTarget.isBlocked ? 'unblock' : 'block';
      const res = await fetch(`${endpoints.adminEventsAdmin}/${blockTarget.id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d?.message ?? `Ошибка (${res.status})`);
        return;
      }
      setEvents((prev) =>
        prev.map((e) => e.id === blockTarget.id ? { ...e, isBlocked: !e.isBlocked } : e)
      );
      setBlockConfirmVisible(false);
    } catch {
      setActionError('Не удалось выполнить действие');
    } finally {
      setActioning(false);
    }
  };

  const renderItem = ({ item }: { item: AdminEvent }) => (
    <View style={styles.card}>
      <Pressable
        style={styles.cardClickable}
        onPress={() => router.push(`/(tabs)/events/${item.id}` as any)}
      >
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]} />
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title || '—'}</Text>
          {item.mentor?.name ? <Text style={styles.cardMeta}>{item.mentor.name}</Text> : null}
          <Text style={styles.cardDate}>{formatDate(item.datetimeStart)}</Text>
          <View style={styles.cardFooter}>
            <View style={[styles.statusBadge, { backgroundColor: item.isBlocked ? '#F8D7DA' : '#D4EDDA' }]}>
              <Text style={[styles.statusText, { color: item.isBlocked ? '#721c24' : '#155724' }]}>
                {item.isBlocked ? 'Заблокировано' : 'Активно'}
              </Text>
            </View>
            {item.price != null && (
              <Text style={styles.priceBadge}>{item.price.toLocaleString('ru-RU')} ₽</Text>
            )}
          </View>
        </View>
      </Pressable>
      <Pressable
        style={[styles.blockBtn, item.isBlocked ? styles.unblockBtnStyle : styles.blockBtnStyle]}
        onPress={() => openBlockConfirm(item)}
      >
        <Text style={[styles.blockBtnText, { color: item.isBlocked ? '#155724' : '#721c24' }]}>
          {item.isBlocked ? 'Разблок.' : 'Блок.'}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>СОБЫТИЯ</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); fetchEvents(1, false); }}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(1, false); }} />}
          onEndReached={() => { if (hasMore && !loadingMore) { setLoadingMore(true); fetchEvents(page + 1, true); } }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>Событий нет</Text></View>}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color="#181818" /> : null}
        />
      )}

      {/* ── Block confirm modal ───────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={blockConfirmVisible} onRequestClose={() => setBlockConfirmVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setBlockConfirmVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {blockTarget?.isBlocked ? 'РАЗБЛОКИРОВАТЬ СОБЫТИЕ?' : 'ЗАБЛОКИРОВАТЬ СОБЫТИЕ?'}
            </Text>
            <Text style={styles.modalSubtitle} numberOfLines={2}>{blockTarget?.title}</Text>
            {!blockTarget?.isBlocked && (
              <Text style={styles.modalNote}>
                Заблокированное событие исчезает из публичного фида автоматически.
              </Text>
            )}
            {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
            <Pressable
              style={[styles.confirmBtn, blockTarget?.isBlocked ? styles.unblockConfirmBtn : styles.blockConfirmBtn, isActioning && styles.btnDisabled]}
              onPress={handleBlockToggle}
              disabled={isActioning}
            >
              {isActioning
                ? <ActivityIndicator color={blockTarget?.isBlocked ? '#155724' : '#fff'} size="small" />
                : <Text style={[styles.confirmBtnText, { color: blockTarget?.isBlocked ? '#155724' : '#fff' }]}>
                    {blockTarget?.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                  </Text>
              }
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setBlockConfirmVisible(false)}>
              <Text style={styles.cancelBtnText}>Отмена</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#1E1E1E', gap: 12 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 28, lineHeight: 30, color: '#181818', marginTop: -2 },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818' },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  card: { flexDirection: 'row', borderWidth: 1, borderColor: '#1E1E1E', marginBottom: 10, backgroundColor: '#fff' },
  cardClickable: { flexDirection: 'row', flex: 1 },
  cover: { width: 72, height: 72 },
  coverPlaceholder: { backgroundColor: '#E5E5E5' },
  cardBody: { flex: 1, paddingVertical: 8, paddingHorizontal: 10 },
  cardTitle: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', fontWeight: '600', color: '#181818', marginBottom: 2 },
  cardMeta: { fontSize: 11, lineHeight: 15, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 2 },
  cardDate: { fontSize: 11, lineHeight: 15, fontFamily: 'Inter-Regular', color: '#555', marginBottom: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2 },
  statusText: { fontSize: 11, fontFamily: 'Inter-Regular', fontWeight: '600' },
  priceBadge: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#181818', backgroundColor: '#E5E5E5', paddingHorizontal: 6, paddingVertical: 2 },
  blockBtn: { width: 60, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderColor: '#1E1E1E' },
  blockBtnStyle: { backgroundColor: '#F8D7DA' },
  unblockBtnStyle: { backgroundColor: '#D4EDDA' },
  blockBtnText: { fontSize: 10, fontFamily: 'Inter-Regular', textAlign: 'center' },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 12 },
  retryBtn: { borderWidth: 1, borderColor: '#181818', paddingVertical: 10, paddingHorizontal: 24 },
  retryText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 22, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 10 },
  modalNote: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#555', marginBottom: 12 },
  actionError: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D', marginBottom: 10 },
  confirmBtn: { height: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  blockConfirmBtn: { backgroundColor: '#E02D2D' },
  unblockConfirmBtn: { borderWidth: 1, borderColor: '#155724' },
  confirmBtnText: { fontSize: 15, fontFamily: 'Inter-Regular' },
  cancelBtn: { height: 48, borderWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 15, fontFamily: 'Inter-Regular', color: '#181818' },
  btnDisabled: { opacity: 0.5 },
});
