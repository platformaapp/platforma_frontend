import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
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

type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string | null;
  roles: string[];
  isBlocked: boolean;
  commissionRate?: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

function normalizeUser(raw: Record<string, unknown>): AdminUser {
  return {
    id: String(raw.id ?? ''),
    fullName: String(raw.fullName ?? raw.full_name ?? raw.name ?? ''),
    email: String(raw.email ?? ''),
    phone: (raw.phone as string) ?? undefined,
    avatarUrl: resolveUrl(raw.avatarUrl ?? raw.avatar_url),
    roles: Array.isArray(raw.roles)
      ? raw.roles.map((r: any) => (typeof r === 'string' ? r : r?.name ?? ''))
      : typeof raw.role === 'string' ? [raw.role] : [],
    isBlocked: Boolean(raw.isBlocked ?? raw.is_blocked ?? false),
    commissionRate: (raw.commissionRate ?? raw.commission_rate) as number | null | undefined,
  };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Block/unblock
  const [blockTarget, setBlockTarget] = useState<AdminUser | null>(null);
  const [blockConfirmVisible, setBlockConfirmVisible] = useState(false);
  const [isActioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState('');

  // Commission modal
  const [commissionTarget, setCommissionTarget] = useState<AdminUser | null>(null);
  const [commissionInput, setCommissionInput] = useState('');
  const [commissionVisible, setCommissionVisible] = useState(false);
  const [isSavingCommission, setIsSavingCommission] = useState(false);
  const [commissionError, setCommissionError] = useState('');

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback(async (pageNum = 1, append = false, searchQuery = search) => {
    const token = await getAdminToken();
    if (!token) { router.replace('/admin/login'); return; }
    try {
      setError('');
      const params = new URLSearchParams({ page: String(pageNum), per_page: '20' });
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await fetch(`${endpoints.adminUsers}?${params}`, {
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
      const items = list.map((r: any) => normalizeUser(r));
      const pag = (data.pagination ?? data.meta) as Record<string, unknown> | undefined;
      const total = typeof pag?.total === 'number' ? pag.total : items.length;
      setHasMore(pageNum * 20 < total);
      setUsers(append ? (prev) => [...prev, ...items] : items);
      setPage(pageNum);
    } catch {
      setError('Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [router, search]);

  useEffect(() => {
    setLoading(true);
    setUsers([]);
    fetchUsers(1, false, search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleSearchChange = (text: string) => {
    setSearchInput(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(text), 500);
  };

  // ─── Block / Unblock ────────────────────────────────────────────────────────

  const openBlockConfirm = (user: AdminUser) => {
    setBlockTarget(user);
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
      const res = await fetch(`${endpoints.adminUsers}/${blockTarget.id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d?.message ?? `Ошибка (${res.status})`);
        return;
      }
      setUsers((prev) =>
        prev.map((u) => u.id === blockTarget.id ? { ...u, isBlocked: !u.isBlocked } : u)
      );
      setBlockConfirmVisible(false);
    } catch {
      setActionError('Не удалось выполнить действие');
    } finally {
      setActioning(false);
    }
  };

  // ─── Commission ──────────────────────────────────────────────────────────────

  const openCommission = (user: AdminUser) => {
    setCommissionTarget(user);
    setCommissionInput(user.commissionRate != null ? String(user.commissionRate) : '');
    setCommissionError('');
    setCommissionVisible(true);
  };

  const handleSaveCommission = async () => {
    if (!commissionTarget) return;
    const token = await getAdminToken();
    if (!token) return;
    const raw = commissionInput.trim().replace(',', '.');
    const value = raw === '' ? null : parseFloat(raw);
    if (raw !== '' && (isNaN(value!) || value! < 0 || value! > 100)) {
      setCommissionError('Введите число от 0 до 100 или оставьте пустым (платформенная)');
      return;
    }
    setIsSavingCommission(true);
    setCommissionError('');
    try {
      const res = await fetch(`${endpoints.adminUsers}/${commissionTarget.id}/commission`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commissionRate: value }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setCommissionError(d?.message ?? `Ошибка (${res.status})`);
        return;
      }
      setUsers((prev) =>
        prev.map((u) => u.id === commissionTarget.id ? { ...u, commissionRate: value } : u)
      );
      setCommissionVisible(false);
    } catch {
      setCommissionError('Не удалось сохранить');
    } finally {
      setIsSavingCommission(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const renderItem = ({ item }: { item: AdminUser }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>{(item.fullName || '?')[0].toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{item.fullName || '—'}</Text>
        <Text style={styles.cardEmail}>{item.email}</Text>
        <Text style={styles.cardMeta}>{item.roles.join(', ') || 'без роли'}</Text>
        <View style={styles.cardFooter}>
          <View style={[styles.statusBadge, { backgroundColor: item.isBlocked ? '#F8D7DA' : '#D4EDDA' }]}>
            <Text style={[styles.statusText, { color: item.isBlocked ? '#721c24' : '#155724' }]}>
              {item.isBlocked ? 'Заблокирован' : 'Активен'}
            </Text>
          </View>
          {item.commissionRate != null && (
            <Text style={styles.commissionBadge}>{item.commissionRate}%</Text>
          )}
        </View>
      </View>
      <View style={styles.cardActions}>
        <Pressable
          style={[styles.actionBtn, item.isBlocked ? styles.unblockBtn : styles.blockBtn]}
          onPress={() => openBlockConfirm(item)}
        >
          <Text style={[styles.actionBtnText, { color: item.isBlocked ? '#155724' : '#721c24' }]}>
            {item.isBlocked ? 'Разблок.' : 'Блок.'}
          </Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.commissionBtn]} onPress={() => openCommission(item)}>
          <Text style={styles.commissionBtnText}>%</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>ПОЛЬЗОВАТЕЛИ</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по имени или email..."
          placeholderTextColor="#9B9B9B"
          value={searchInput}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); fetchUsers(1, false); }}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(1, false); }} />}
          onEndReached={() => { if (hasMore && !loadingMore) { setLoadingMore(true); fetchUsers(page + 1, true); } }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>Пользователи не найдены</Text></View>}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color="#181818" /> : null}
        />
      )}

      {/* ── Block confirm modal ───────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={blockConfirmVisible} onRequestClose={() => setBlockConfirmVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setBlockConfirmVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {blockTarget?.isBlocked ? 'РАЗБЛОКИРОВАТЬ?' : 'ЗАБЛОКИРОВАТЬ?'}
            </Text>
            <Text style={styles.modalSubtitle}>{blockTarget?.fullName} ({blockTarget?.email})</Text>
            {!blockTarget?.isBlocked && (
              <Text style={styles.modalWarning}>
                Активные сессии пользователя не инвалидируются немедленно.
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

      {/* ── Commission modal ──────────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={commissionVisible} onRequestClose={() => setCommissionVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCommissionVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>КОМИССИЯ</Text>
            <Text style={styles.modalSubtitle}>{commissionTarget?.fullName}</Text>
            <Text style={styles.commissionLabel}>
              Индивидуальная комиссия (%). Пустое поле = платформенная по умолчанию
            </Text>
            <TextInput
              style={styles.commissionInput}
              placeholder="По умолчанию (платформенная)"
              placeholderTextColor="#9B9B9B"
              value={commissionInput}
              onChangeText={setCommissionInput}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            {commissionError ? <Text style={styles.actionError}>{commissionError}</Text> : null}
            <Pressable
              style={[styles.confirmBtn, styles.saveBtn, isSavingCommission && styles.btnDisabled]}
              onPress={handleSaveCommission}
              disabled={isSavingCommission}
            >
              {isSavingCommission
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={[styles.confirmBtnText, { color: '#fff' }]}>Сохранить</Text>
              }
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setCommissionVisible(false)}>
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
  searchRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#E5E5E5' },
  searchInput: { borderWidth: 1, borderColor: '#1E1E1E', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  card: { flexDirection: 'row', borderWidth: 1, borderColor: '#1E1E1E', marginBottom: 10, backgroundColor: '#fff' },
  cardLeft: { padding: 10 },
  avatar: { width: 52, height: 52 },
  avatarPlaceholder: { backgroundColor: '#E5E5E5', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  cardBody: { flex: 1, paddingVertical: 8, paddingRight: 4 },
  cardName: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', fontWeight: '600', color: '#181818', marginBottom: 1 },
  cardEmail: { fontSize: 11, lineHeight: 15, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 2 },
  cardMeta: { fontSize: 11, lineHeight: 15, fontFamily: 'Inter-Regular', color: '#555', marginBottom: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2 },
  statusText: { fontSize: 11, fontFamily: 'Inter-Regular', fontWeight: '600' },
  commissionBadge: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#181818', backgroundColor: '#E5E5E5', paddingHorizontal: 6, paddingVertical: 2 },
  cardActions: { flexDirection: 'column', borderLeftWidth: 1, borderColor: '#1E1E1E', width: 56 },
  actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockBtn: { backgroundColor: '#F8D7DA', borderBottomWidth: 1, borderColor: '#1E1E1E' },
  unblockBtn: { backgroundColor: '#D4EDDA', borderBottomWidth: 1, borderColor: '#1E1E1E' },
  commissionBtn: { backgroundColor: '#E5E5E5' },
  actionBtnText: { fontSize: 10, fontFamily: 'Inter-Regular', textAlign: 'center' },
  commissionBtnText: { fontSize: 15, fontFamily: 'Inter-Regular', color: '#181818' },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 12 },
  retryBtn: { borderWidth: 1, borderColor: '#181818', paddingVertical: 10, paddingHorizontal: 24 },
  retryText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 22, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 12 },
  modalWarning: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#856404', backgroundColor: '#FFF3CD', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  actionError: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D', marginBottom: 10 },
  confirmBtn: { height: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  blockConfirmBtn: { backgroundColor: '#E02D2D' },
  unblockConfirmBtn: { borderWidth: 1, borderColor: '#155724' },
  saveBtn: { backgroundColor: '#181818' },
  confirmBtnText: { fontSize: 15, fontFamily: 'Inter-Regular' },
  cancelBtn: { height: 48, borderWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 15, fontFamily: 'Inter-Regular', color: '#181818' },
  btnDisabled: { opacity: 0.5 },
  commissionLabel: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#555', marginBottom: 8 },
  commissionInput: { borderWidth: 1, borderColor: '#1E1E1E', paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 8 },
});
