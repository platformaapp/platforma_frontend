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

import { API_BASE } from '@/constants/env';
import { getAdminToken } from '@/lib/admin-auth';

function resolveUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
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

export default function AdminUserDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: dataParam } = useLocalSearchParams<{ data: string }>();

  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    getAdminToken().then((token) => {
      if (!token) { router.replace('/admin/login'); return; }
      setAuthChecked(true);
    });
  }, []);

  if (!authChecked) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#181818" />
      </View>
    );
  }

  let user: Record<string, any> | null = null;
  try {
    user = dataParam ? JSON.parse(decodeURIComponent(dataParam)) : null;
  } catch {
    user = null;
  }

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Не удалось загрузить данные пользователя</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Назад</Text>
        </Pressable>
      </View>
    );
  }

  const fullName = user.fullName ?? user.full_name ?? user.name ?? '—';
  const email = user.email ?? '';
  const phone = user.phone ?? '';
  const avatarUrl = resolveUrl(user.avatarUrl ?? user.avatar_url);
  const roles: string[] = Array.isArray(user.roles)
    ? user.roles.map((r: any) => (typeof r === 'string' ? r : r?.name ?? ''))
    : typeof user.role === 'string' ? [user.role] : [];
  const isBlocked = Boolean(user.isBlocked ?? user.is_blocked ?? false);
  const isVerified = user.isVerified ?? user.is_verified ?? user.verified;
  const shortBio = user.shortBio ?? user.short_bio ?? '';
  const bio = user.bio ?? user.about ?? user.description ?? '';
  const telegram = user.telegram ?? user.telegramUsername ?? user.telegram_username ?? '';
  const hourlyRate = user.hourlyRate ?? user.hourly_rate ?? user.pricePerHour ?? user.price_per_hour;
  const commissionRate = user.commissionRate ?? user.commission_rate;
  const createdAt = user.createdAt ?? user.created_at ?? '';
  const updatedAt = user.updatedAt ?? user.updated_at ?? '';

  const knownKeys = new Set([
    'id', 'fullName', 'full_name', 'name', 'email', 'phone',
    'avatarUrl', 'avatar_url', 'roles', 'role', 'isBlocked', 'is_blocked',
    'isVerified', 'is_verified', 'verified',
    'shortBio', 'short_bio', 'bio', 'about', 'description',
    'telegram', 'telegramUsername', 'telegram_username',
    'hourlyRate', 'hourly_rate', 'pricePerHour', 'price_per_hour',
    'commissionRate', 'commission_rate', 'createdAt', 'created_at',
    'updatedAt', 'updated_at',
  ]);
  const extraFields = Object.entries(user).filter(
    ([k, v]) => !knownKeys.has(k) && v != null && v !== '' && typeof v !== 'object'
  );

  function fmt(v: unknown): string {
    if (v == null) return '—';
    if (typeof v === 'boolean') return v ? 'Да' : 'Нет';
    return String(v);
  }

  function fmtDate(iso: string): string {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString('ru-RU'); } catch { return iso; }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{fullName}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroRow}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{(fullName || '?')[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.heroText}>
            <Text style={styles.heroName}>{fullName}</Text>
            <Text style={styles.heroRoles}>{roles.join(', ') || 'без роли'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: isBlocked ? '#F8D7DA' : '#D4EDDA' }]}>
              <Text style={[styles.statusText, { color: isBlocked ? '#721c24' : '#155724' }]}>
                {isBlocked ? 'Заблокирован' : 'Активен'}
              </Text>
            </View>
          </View>
        </View>

        <Section title="Контакты">
          <Row label="ID" value={String(user.id ?? '')} />
          <Row label="Email" value={email} />
          <Row label="Телефон" value={phone} />
          <Row label="Telegram" value={telegram} />
        </Section>

        {(shortBio || bio) ? (
          <Section title="Профиль">
            <Row label="Короткое био" value={shortBio} />
            {bio ? (
              <View style={styles.bioBlock}>
                <Text style={styles.rowLabel}>О себе</Text>
                <Text style={styles.bioText}>{bio}</Text>
              </View>
            ) : null}
          </Section>
        ) : null}

        <Section title="Финансы">
          <Row label="Стоимость часа" value={hourlyRate != null ? `${Number(hourlyRate).toLocaleString('ru-RU')} ₽` : null} />
          <Row
            label="Комиссия"
            value={commissionRate != null ? `${commissionRate}%` : 'Платформенная (по умолчанию)'}
          />
        </Section>

        <Section title="Статус">
          <Row label="Заблокирован" value={fmt(isBlocked)} />
          {isVerified != null && <Row label="Верифицирован" value={fmt(isVerified)} />}
          <Row label="Создан" value={fmtDate(createdAt)} />
          <Row label="Обновлён" value={fmtDate(updatedAt)} />
        </Section>

        {extraFields.length > 0 && (
          <Section title="Дополнительно">
            {extraFields.map(([key, val]) => (
              <Row key={key} label={key} value={fmt(val)} />
            ))}
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 16 },
  backBtn: { borderWidth: 1, borderColor: '#181818', paddingVertical: 10, paddingHorizontal: 20 },
  backBtnText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },

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

  section: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, borderBottomWidth: 1, borderColor: '#E5E5E5' },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  row: { flexDirection: 'row', paddingVertical: 7, borderTopWidth: 1, borderColor: '#F0F0F0' },
  rowLabel: { width: 160, fontSize: 13, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  rowValue: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818' },

  bioBlock: { paddingVertical: 7, borderTopWidth: 1, borderColor: '#F0F0F0' },
  bioText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818', lineHeight: 20, marginTop: 4 },
});
