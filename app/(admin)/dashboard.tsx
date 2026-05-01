import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE, endpoints } from '@/constants/env';
import { clearAdminToken, getAdminToken } from '@/lib/admin-auth';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppStatus = 'pending' | 'approved' | 'rejected';

type TutorApplication = {
  id: string;
  status: AppStatus;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    bio?: string;
    avatarUrl?: string | null;
    specialization?: string;
  };
  rejectionReason?: string;
};

type FilterTab = 'all' | AppStatus;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

function normalizeApplication(raw: Record<string, unknown>): TutorApplication {
  const user = (raw.user ?? raw.applicant ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.id ?? ''),
    status: ((raw.status as string) ?? 'pending') as AppStatus,
    createdAt: (raw.createdAt ?? raw.created_at ?? raw.submittedAt ?? raw.submitted_at ?? '') as string,
    user: {
      id: String(user.id ?? ''),
      fullName: String(user.fullName ?? user.full_name ?? user.name ?? ''),
      email: String(user.email ?? ''),
      phone: (user.phone as string) ?? undefined,
      bio: (user.bio ?? user.description as string) ?? undefined,
      specialization: (user.specialization as string) ?? undefined,
      avatarUrl: resolveUrl(user.avatarUrl ?? user.avatar_url),
    },
    rejectionReason: (raw.rejectionReason ?? raw.rejection_reason as string) ?? undefined,
  };
}

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
}

const STATUS_LABEL: Record<AppStatus, string> = {
  pending: 'На рассмотрении',
  approved: 'Одобрена',
  rejected: 'Отклонена',
};

const STATUS_COLOR: Record<AppStatus, string> = {
  pending: '#856404',
  approved: '#155724',
  rejected: '#721c24',
};

const STATUS_BG: Record<AppStatus, string> = {
  pending: '#FFF3CD',
  approved: '#D4EDDA',
  rejected: '#F8D7DA',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [applications, setApplications] = useState<TutorApplication[]>([]);
  const [filter, setFilter] = useState<FilterTab>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Detail modal
  const [selected, setSelected] = useState<TutorApplication | null>(null);
  const [isDetailVisible, setDetailVisible] = useState(false);

  // Reject modal
  const [isRejectVisible, setRejectVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<TutorApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isActioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchApplications = useCallback(async (pageNum = 1, append = false) => {
    const token = await getAdminToken();
    if (!token) { router.replace('/(admin)/login'); return; }

    try {
      setError('');
      const params = new URLSearchParams({ page: String(pageNum), per_page: '20' });
      if (filter !== 'all') params.set('status', filter);

      const res = await fetch(`${endpoints.adminApplications}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        await clearAdminToken();
        router.replace('/(admin)/login');
        return;
      }

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.message ?? `Ошибка загрузки (${res.status})`);
        return;
      }

      const data = await res.json();
      // Handle: array | { items } | { data: [] } | { data: { items: [] } }
      let rawItems: unknown = data.items ?? data.data ?? data;
      if (!Array.isArray(rawItems) && rawItems && typeof rawItems === 'object') {
        const inner = rawItems as Record<string, unknown>;
        rawItems = inner.items ?? inner.data ?? [];
      }
      const list = Array.isArray(rawItems) ? rawItems : [];
      const items = list.map((r) =>
        normalizeApplication(typeof r === 'object' && r !== null ? (r as Record<string, unknown>) : {})
      );

      const pag = (data.pagination ?? data.meta) as Record<string, unknown> | undefined;
      const total = typeof pag?.total === 'number' ? pag.total : items.length;
      setHasMore(pageNum * 20 < total);

      setApplications(append ? (prev) => [...prev, ...items] : items);
      setPage(pageNum);
    } catch {
      setError('Не удалось загрузить заявки');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [filter, router]);

  useEffect(() => {
    setLoading(true);
    setApplications([]);
    fetchApplications(1, false);
  }, [filter, fetchApplications]);

  async function handleApprove(app: TutorApplication) {
    const token = await getAdminToken();
    if (!token) return;
    setActioning(true);
    setActionError('');
    try {
      const res = await fetch(`${endpoints.adminApplications}/${app.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d?.message ?? `Ошибка (${res.status})`);
        return;
      }
      // Optimistic update
      setApplications((prev) =>
        prev.map((a) => a.id === app.id ? { ...a, status: 'approved' } : a)
      );
      if (selected?.id === app.id) setSelected((s) => s ? { ...s, status: 'approved' } : s);
      setDetailVisible(false);
    } catch {
      setActionError('Не удалось выполнить действие');
    } finally {
      setActioning(false);
    }
  }

  function openReject(app: TutorApplication) {
    setRejectTarget(app);
    setRejectReason('');
    setActionError('');
    setRejectVisible(true);
  }

  async function handleRejectConfirm() {
    if (!rejectTarget) return;
    const token = await getAdminToken();
    if (!token) return;
    setActioning(true);
    setActionError('');
    try {
      const res = await fetch(`${endpoints.adminApplications}/${rejectTarget.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d?.message ?? `Ошибка (${res.status})`);
        return;
      }
      setApplications((prev) =>
        prev.map((a) =>
          a.id === rejectTarget.id
            ? { ...a, status: 'rejected', rejectionReason: rejectReason.trim() || undefined }
            : a
        )
      );
      if (selected?.id === rejectTarget.id) {
        setSelected((s) => s ? { ...s, status: 'rejected', rejectionReason: rejectReason.trim() || undefined } : s);
      }
      setRejectVisible(false);
      setDetailVisible(false);
    } catch {
      setActionError('Не удалось выполнить действие');
    } finally {
      setActioning(false);
    }
  }

  async function handleLogout() {
    await clearAdminToken();
    router.replace('/(admin)/login');
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'pending', label: 'На рассмотрении' },
    { key: 'approved', label: 'Одобрены' },
    { key: 'rejected', label: 'Отклонены' },
    { key: 'all', label: 'Все' },
  ];

  const renderItem = ({ item }: { item: TutorApplication }) => (
    <Pressable style={styles.card} onPress={() => { setSelected(item); setDetailVisible(true); }}>
      <View style={styles.cardLeft}>
        {item.user.avatarUrl ? (
          <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {(item.user.fullName || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{item.user.fullName || '—'}</Text>
        <Text style={styles.cardEmail}>{item.user.email}</Text>
        {item.user.specialization ? (
          <Text style={styles.cardMeta}>{item.user.specialization}</Text>
        ) : null}
        <View style={styles.cardFooter}>
          <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[item.status] }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
              {STATUS_LABEL[item.status]}
            </Text>
          </View>
        </View>
      </View>
      {item.status === 'pending' ? (
        <View style={styles.cardActions}>
          <Pressable
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={(e) => { e.stopPropagation?.(); handleApprove(item); }}
          >
            <Text style={styles.approveBtnText}>✓</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={(e) => { e.stopPropagation?.(); openReject(item); }}
          >
            <Text style={styles.rejectBtnText}>✕</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ЗАЯВКИ НАСТАВНИКОВ</Text>
        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Выйти</Text>
        </Pressable>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, filter === t.key && styles.tabActive]}
            onPress={() => setFilter(t.key)}
          >
            <Text style={[styles.tabText, filter === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#181818" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => fetchApplications(1, false)}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchApplications(1, false); }}
            />
          }
          onEndReached={() => {
            if (hasMore && !loadingMore) {
              setLoadingMore(true);
              fetchApplications(page + 1, true);
            }
          }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>Заявок нет</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color="#181818" /> : null
          }
        />
      )}

      {/* ── Detail modal ─────────────────────────────────────────────────── */}
      <Modal
        transparent
        animationType="slide"
        visible={isDetailVisible}
        onRequestClose={() => setDetailVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDetailVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selected ? (
                <>
                  <View style={styles.detailHeader}>
                    {selected.user.avatarUrl ? (
                      <Image source={{ uri: selected.user.avatarUrl }} style={styles.detailAvatar} />
                    ) : (
                      <View style={[styles.detailAvatar, styles.avatarPlaceholder]}>
                        <Text style={styles.detailAvatarInitial}>
                          {(selected.user.fullName || '?')[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailName}>{selected.user.fullName || '—'}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[selected.status], alignSelf: 'flex-start', marginTop: 4 }]}>
                        <Text style={[styles.statusText, { color: STATUS_COLOR[selected.status] }]}>
                          {STATUS_LABEL[selected.status]}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailFields}>
                    <DetailRow label="Email" value={selected.user.email} />
                    {selected.user.phone ? <DetailRow label="Телефон" value={selected.user.phone} /> : null}
                    {selected.user.specialization ? <DetailRow label="Специализация" value={selected.user.specialization} /> : null}
                    <DetailRow label="Дата подачи" value={formatDate(selected.createdAt)} />
                    {selected.user.bio ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>О себе</Text>
                        <Text style={styles.detailValue}>{selected.user.bio}</Text>
                      </View>
                    ) : null}
                    {selected.status === 'rejected' && selected.rejectionReason ? (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: '#721c24' }]}>Причина отклонения</Text>
                        <Text style={[styles.detailValue, { color: '#721c24' }]}>{selected.rejectionReason}</Text>
                      </View>
                    ) : null}
                  </View>

                  {actionError ? <Text style={styles.actionErrorText}>{actionError}</Text> : null}

                  {selected.status === 'pending' ? (
                    <View style={styles.detailBtnRow}>
                      <Pressable
                        style={[styles.detailApproveBtn, isActioning && styles.btnDisabled]}
                        onPress={() => handleApprove(selected)}
                        disabled={isActioning}
                      >
                        {isActioning ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.detailApproveBtnText}>Одобрить</Text>
                        )}
                      </Pressable>
                      <Pressable
                        style={[styles.detailRejectBtn, isActioning && styles.btnDisabled]}
                        onPress={() => openReject(selected)}
                        disabled={isActioning}
                      >
                        <Text style={styles.detailRejectBtnText}>Отклонить</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <Pressable style={styles.detailCloseBtn} onPress={() => setDetailVisible(false)}>
                    <Text style={styles.detailCloseBtnText}>Закрыть</Text>
                  </Pressable>
                </>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Reject reason modal ───────────────────────────────────────────── */}
      <Modal
        transparent
        animationType="fade"
        visible={isRejectVisible}
        onRequestClose={() => setRejectVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRejectVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.rejectModalTitle}>ОТКЛОНИТЬ ЗАЯВКУ</Text>
            <Text style={styles.rejectModalSubtitle}>
              {rejectTarget?.user.fullName}
            </Text>
            <TextInput
              style={styles.rejectInput}
              placeholder="Причина отклонения (необязательно)"
              placeholderTextColor="#9B9B9B"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {actionError ? <Text style={styles.actionErrorText}>{actionError}</Text> : null}
            <Pressable
              style={[styles.detailRejectBtn, isActioning && styles.btnDisabled]}
              onPress={handleRejectConfirm}
              disabled={isActioning}
            >
              {isActioning ? (
                <ActivityIndicator color="#721c24" size="small" />
              ) : (
                <Text style={styles.detailRejectBtnText}>Подтвердить отклонение</Text>
              )}
            </Pressable>
            <Pressable style={styles.detailCloseBtn} onPress={() => setRejectVisible(false)}>
              <Text style={styles.detailCloseBtnText}>Отмена</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderColor: '#1E1E1E',
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818' },
  logoutBtn: { paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#1E1E1E' },
  logoutText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818' },

  tabsScroll: { maxHeight: 48, borderBottomWidth: 1, borderColor: '#1E1E1E' },
  tabsContent: { flexDirection: 'row', alignItems: 'stretch' },
  tab: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderRightWidth: 1, borderColor: '#1E1E1E',
  },
  tabActive: { backgroundColor: '#181818' },
  tabText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#181818', letterSpacing: 0.3 },
  tabTextActive: { color: '#FAFAFA' },

  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },

  card: {
    flexDirection: 'row', borderWidth: 1, borderColor: '#1E1E1E',
    marginBottom: 12, backgroundColor: '#fff',
  },
  cardLeft: { padding: 12 },
  avatar: { width: 56, height: 56 },
  avatarPlaceholder: { backgroundColor: '#E5E5E5', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 20, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  cardBody: { flex: 1, paddingVertical: 10, paddingRight: 8 },
  cardName: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', fontWeight: '600', color: '#181818', marginBottom: 2 },
  cardEmail: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 2 },
  cardMeta: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#555', marginBottom: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  cardDate: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontFamily: 'Inter-Regular', fontWeight: '600' },
  cardActions: { flexDirection: 'column', borderLeftWidth: 1, borderColor: '#1E1E1E' },
  actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  approveBtn: { borderBottomWidth: 1, borderColor: '#1E1E1E', backgroundColor: '#D4EDDA' },
  rejectBtn: { backgroundColor: '#F8D7DA' },
  approveBtnText: { fontSize: 16, color: '#155724', fontFamily: 'Inter-Regular' },
  rejectBtnText: { fontSize: 16, color: '#721c24', fontFamily: 'Inter-Regular' },

  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 12 },
  retryBtn: { borderWidth: 1, borderColor: '#181818', paddingVertical: 10, paddingHorizontal: 24 },
  retryText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#9B9B9B' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff', paddingHorizontal: 16,
    paddingTop: 20, paddingBottom: 32, maxHeight: '90%',
  },
  detailHeader: { flexDirection: 'row', gap: 14, marginBottom: 16, alignItems: 'flex-start' },
  detailAvatar: { width: 72, height: 72 },
  detailAvatarInitial: { fontSize: 28, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  detailName: { fontSize: 18, lineHeight: 24, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818' },
  detailFields: { borderTopWidth: 1, borderColor: '#E5E5E5', marginBottom: 16 },
  detailRow: { borderBottomWidth: 1, borderColor: '#E5E5E5', paddingVertical: 10 },
  detailLabel: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  detailBtnRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  detailApproveBtn: { flex: 1, backgroundColor: '#155724', height: 48, alignItems: 'center', justifyContent: 'center' },
  detailApproveBtnText: { fontSize: 15, fontFamily: 'Inter-Regular', color: '#fff' },
  detailRejectBtn: { flex: 1, borderWidth: 1, borderColor: '#721c24', height: 48, alignItems: 'center', justifyContent: 'center' },
  detailRejectBtnText: { fontSize: 15, fontFamily: 'Inter-Regular', color: '#721c24' },
  detailCloseBtn: { height: 48, borderWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  detailCloseBtnText: { fontSize: 15, fontFamily: 'Inter-Regular', color: '#181818' },
  btnDisabled: { opacity: 0.5 },
  actionErrorText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D', marginBottom: 10 },

  rejectModalTitle: { fontSize: 22, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818', marginBottom: 4 },
  rejectModalSubtitle: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 14 },
  rejectInput: {
    borderWidth: 1, borderColor: '#1E1E1E',
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818',
    minHeight: 96, marginBottom: 14,
  },
});
