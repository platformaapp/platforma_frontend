import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE, endpoints } from '@/constants/env';
import { clearAdminToken, getAdminToken } from '@/lib/admin-auth';

type UserDetail = {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  roles: string[];
  avatarUrl?: string | null;
  bio?: string | null;
  shortBio?: string | null;
  specialization?: string | null;
  hourlyRate?: number | string | null;
  groupMeetings?: string | null;
  isBlocked: boolean;
  commissionRate?: number | null;
  defaultPaymentMethodId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  applicationStatus?: string | null;
  rejectionReason?: string | null;
};

function resolveUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('ru-RU'); } catch { return iso; }
}

function fmtBool(v: boolean): string {
  return v ? 'Да' : 'Нет';
}

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  pending: 'На рассмотрении',
  approved: 'Одобрена',
  rejected: 'Отклонена',
};

export default function AdminUserDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let active = true;

    const load = async () => {
      const token = await getAdminToken();
      if (!token) { router.replace('/admin/login'); return; }

      try {
        const res = await fetch(`${endpoints.adminUsers}/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 403) {
          await clearAdminToken();
          router.replace('/admin/login');
          return;
        }
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          if (active) setError(d?.message ?? `Ошибка ${res.status}`);
          return;
        }
        const data = await res.json();
        const raw = data?.data ?? data?.user ?? data;
        if (active) setUser({
          id: String(raw.id ?? ''),
          email: raw.email ?? '',
          fullName: raw.fullName ?? raw.full_name ?? raw.name ?? '',
          phone: raw.phone ?? null,
          roles: Array.isArray(raw.roles)
            ? raw.roles.map((r: any) => typeof r === 'string' ? r : r?.name ?? '')
            : typeof raw.role === 'string' ? [raw.role] : [],
          avatarUrl: resolveUrl(raw.avatarUrl ?? raw.avatar_url),
          bio: raw.bio ?? null,
          shortBio: raw.shortBio ?? raw.short_bio ?? null,
          specialization: raw.specialization ?? null,
          hourlyRate: raw.hourlyRate ?? raw.hourly_rate ?? null,
          groupMeetings: raw.groupMeetings ?? raw.group_meetings ?? null,
          isBlocked: Boolean(raw.isBlocked ?? raw.is_blocked ?? false),
          commissionRate: raw.commissionRate ?? raw.commission_rate ?? null,
          defaultPaymentMethodId: raw.defaultPaymentMethodId ?? raw.default_payment_method_id ?? null,
          createdAt: raw.createdAt ?? raw.created_at,
          updatedAt: raw.updatedAt ?? raw.updated_at,
          applicationStatus: raw.applicationStatus ?? raw.application_status ?? null,
          rejectionReason: raw.rejectionReason ?? raw.rejection_reason ?? null,
        });
      } catch {
        if (active) setError('Не удалось загрузить данные');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#181818" />
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error || 'Пользователь не найден'}</Text>
        <Pressable style={styles.retryBackBtn} onPress={() => router.back()}>
          <Text style={styles.retryBackText}>← Назад</Text>
        </Pressable>
      </View>
    );
  }

  const isTutor = user.roles.includes('tutor');
  const statusLabel = user.applicationStatus
    ? (APPLICATION_STATUS_LABELS[user.applicationStatus] ?? user.applicationStatus)
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{user.fullName || user.email}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={styles.heroRow}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{(user.fullName || user.email || '?')[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.heroText}>
            <Text style={styles.heroName}>{user.fullName || '—'}</Text>
            <Text style={styles.heroRoles}>{user.roles.join(', ') || 'без роли'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: user.isBlocked ? '#F8D7DA' : '#D4EDDA' }]}>
              <Text style={[styles.statusText, { color: user.isBlocked ? '#721c24' : '#155724' }]}>
                {user.isBlocked ? 'Заблокирован' : 'Активен'}
              </Text>
            </View>
          </View>
        </View>

        {/* Contacts */}
        <Section title="Контакты">
          <Row label="ID" value={user.id} />
          <Row label="Email" value={user.email} />
          <Row label="Телефон" value={user.phone} />
        </Section>

        {/* Tutor profile */}
        {isTutor && (
          <Section title="Профиль наставника">
            <Row label="Короткое био" value={user.shortBio} />
            <Row label="Специализация" value={user.specialization} />
            <Row label="О себе" value={user.bio} />
            <Row label="Групповые встречи" value={user.groupMeetings} />
            <Row
              label="Стоимость часа"
              value={user.hourlyRate != null ? `${Number(user.hourlyRate).toLocaleString('ru-RU')} ₽` : null}
            />
          </Section>
        )}

        {/* Financials */}
        <Section title="Финансы">
          <Row
            label="Комиссия"
            value={user.commissionRate != null ? `${user.commissionRate}%` : 'Платформенная (по умолчанию)'}
          />
          <Row label="Метод оплаты по умолч." value={user.defaultPaymentMethodId} />
        </Section>

        {/* Application (tutors only) */}
        {isTutor && statusLabel && (
          <Section title="Заявка наставника">
            <Row label="Статус заявки" value={statusLabel} />
            {user.applicationStatus === 'rejected' && (
              <Row label="Причина отказа" value={user.rejectionReason} />
            )}
          </Section>
        )}

        {/* Meta */}
        <Section title="Служебное">
          <Row label="Заблокирован" value={fmtBool(user.isBlocked)} />
          <Row label="Зарегистрирован" value={fmtDate(user.createdAt)} />
          <Row label="Обновлён" value={fmtDate(user.updatedAt)} />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 16 },
  retryBackBtn: { borderWidth: 1, borderColor: '#181818', paddingVertical: 10, paddingHorizontal: 20 },
  retryBackText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#1E1E1E', gap: 12 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 28, lineHeight: 30, color: '#181818', marginTop: -2 },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818' },

  content: { paddingBottom: 48 },

  heroRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#E5E5E5', gap: 16 },
  avatar: { width: 72, height: 72, backgroundColor: '#E5E5E5' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 26, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  heroText: { flex: 1 },
  heroName: { fontSize: 18, fontFamily: 'Inter-Regular', fontWeight: '600', color: '#181818', marginBottom: 2 },
  heroRoles: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 6 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 12, fontFamily: 'Inter-Regular', fontWeight: '600' },

  section: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, borderBottomWidth: 1, borderColor: '#E5E5E5' },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  row: { flexDirection: 'row', paddingVertical: 7, borderTopWidth: 1, borderColor: '#F0F0F0' },
  rowLabel: { width: 160, fontSize: 13, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  rowValue: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818' },
});
