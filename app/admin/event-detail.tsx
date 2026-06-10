import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE, endpoints } from '@/constants/env';
import { clearAdminToken, getAdminToken } from '@/lib/admin-auth';

async function uploadAdminCoverImage(uri: string): Promise<string> {
  const token = await getAdminToken();
  if (!token) throw new Error('Требуется авторизация');
  const formData = new FormData();
  const filename = `cover_${Date.now()}.jpg`;
  if (Platform.OS === 'web') {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    formData.append('file', blob, filename);
  } else {
    formData.append('file', { uri, name: filename, type: 'image/jpeg' } as any);
  }
  const res = await fetch(endpoints.uploadImage, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message ?? `Ошибка загрузки обложки (${res.status})`);
  }
  const data = await res.json();
  if (!data?.url) throw new Error('Сервер не вернул URL изображения');
  const url = data.url as string;
  return url.startsWith('http') ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

type EventDetail = {
  id: string;
  title: string;
  description?: string | null;
  type?: string | null;
  status?: string | null;
  isBlocked: boolean;
  price?: number | null;
  platformFee?: number | null;
  mentorRevenue?: number | null;
  maxParticipants?: number | null;
  durationMinutes?: number | null;
  datetimeStart?: string | null;
  datetimeEnd?: string | null;
  coverUrl?: string | null;
  recordingUrl?: string | null;
  sessionId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  mentor?: { id: string; fullName: string; email: string; avatarUrl?: string | null } | null;
  videoRoom?: {
    id?: string;
    provider?: string;
    url?: string | null;
    moderatorUrl?: string | null;
    externalId?: string | null;
    isActive?: boolean;
    expiresAt?: string | null;
  } | null;
  participants?: { total: number; paid: number } | null;
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

function fmtMoney(v?: number | null): string | null {
  if (v == null) return null;
  return `${Number(v).toLocaleString('ru-RU')} ₽`;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Запланировано',
  active: 'Активно',
  completed: 'Завершено',
  cancelled: 'Отменено',
};

const TYPE_LABELS: Record<string, string> = {
  standalone: 'Разовое',
  course: 'Курс',
  workshop: 'Воркшоп',
};

const TEAM_COMMENT =
  'Мы немного подправили ваше событие, чтобы оно лучше соответствовало общей стилистике платформы и помогло вам привлечь больше пользователей.\n\n' +
  'Если вы не согласны с нашим предложением, то вот контакт для связи в тг @vladislav_yakunin. Давайте вместе доработаем событие, чтобы и вам, и нам было хорошо и приятно.';

export default function AdminEventDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modVisible, setModVisible] = useState(false);
  const [modFields, setModFields] = useState({ title: '', description: '', comment: '' });
  const [modCoverUri, setModCoverUri] = useState<string | null>(null);
  const [modCoverUploading, setModCoverUploading] = useState(false);
  const [modSaving, setModSaving] = useState(false);
  const [modError, setModError] = useState('');
  const [modSuccess, setModSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;

    const load = async () => {
      const token = await getAdminToken();
      if (!token) { router.replace('/admin/login'); return; }

      try {
        const res = await fetch(`${endpoints.adminEventsAdmin}/${id}`, {
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
        const r = data?.data ?? data?.event ?? data;
        if (active) setEvent({
          id: String(r.id ?? ''),
          title: r.title ?? '',
          description: r.description ?? null,
          type: r.type ?? null,
          status: r.status ?? null,
          isBlocked: Boolean(r.isBlocked ?? r.is_blocked ?? false),
          price: r.price != null ? Number(r.price) : null,
          platformFee: r.platformFee ?? r.platform_fee ?? null,
          mentorRevenue: r.mentorRevenue ?? r.mentor_revenue ?? null,
          maxParticipants: r.maxParticipants ?? r.max_participants ?? null,
          durationMinutes: r.durationMinutes ?? r.duration_minutes ?? null,
          datetimeStart: r.datetimeStart ?? r.datetime_start ?? null,
          datetimeEnd: r.datetimeEnd ?? r.datetime_end ?? null,
          coverUrl: resolveUrl(r.coverUrl ?? r.cover_url),
          recordingUrl: r.recordingUrl ?? r.recording_url ?? null,
          sessionId: r.sessionId ?? r.session_id ?? null,
          createdAt: r.createdAt ?? r.created_at,
          updatedAt: r.updatedAt ?? r.updated_at,
          mentor: r.mentor ? {
            id: String(r.mentor.id ?? ''),
            fullName: r.mentor.fullName ?? r.mentor.full_name ?? r.mentor.name ?? '',
            email: r.mentor.email ?? '',
            avatarUrl: resolveUrl(r.mentor.avatarUrl ?? r.mentor.avatar_url),
          } : null,
          videoRoom: r.videoRoom ?? r.video_room ?? null,
          participants: r.participants ?? null,
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

  const pickModCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Ошибка', 'Необходимо разрешение на доступ к фотографиям');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      if (Platform.OS === 'web' && uri.startsWith('blob:')) {
        try {
          const resp = await fetch(uri);
          const blob = await resp.blob();
          const dataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          setModCoverUri(dataUri);
        } catch { setModCoverUri(uri); }
      } else {
        setModCoverUri(uri);
      }
    }
  };

  const handleModerate = async () => {
    setModSaving(true);
    setModError('');
    setModSuccess(false);
    try {
      const token = await getAdminToken();
      if (!token) { router.replace('/admin/login'); return; }

      const body: Record<string, string> = {};

      if (modCoverUri) {
        setModCoverUploading(true);
        try {
          body.coverUrl = await uploadAdminCoverImage(modCoverUri);
        } catch (e) {
          setModError((e as Error)?.message ?? 'Не удалось загрузить обложку');
          setModCoverUploading(false);
          setModSaving(false);
          return;
        }
        setModCoverUploading(false);
      }

      if (modFields.title.trim()) body.title = modFields.title.trim();
      if (modFields.description.trim()) body.description = modFields.description.trim();
      const adminComment = modFields.comment.trim();
      body.comment = adminComment
        ? `${TEAM_COMMENT}\n\n${adminComment}`
        : TEAM_COMMENT;

      const res = await fetch(`${endpoints.adminEventsAdmin}/${id}/moderate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.status === 401 || res.status === 403) {
        await clearAdminToken();
        router.replace('/admin/login');
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message ?? `Ошибка ${res.status}`);
      }
      setModSuccess(true);
      setModCoverUri(null);
      setModFields({ title: '', description: '', comment: '' });
    } catch (e) {
      setModError((e as Error)?.message ?? 'Не удалось отправить правки');
    } finally {
      setModSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#181818" />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error || 'Событие не найдено'}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Назад</Text>
        </Pressable>
      </View>
    );
  }

  const statusLabel = event.status ? (STATUS_LABELS[event.status] ?? event.status) : null;
  const typeLabel = event.type ? (TYPE_LABELS[event.type] ?? event.type) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{event.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Cover */}
        {event.coverUrl ? (
          <Image source={{ uri: event.coverUrl }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={styles.coverPlaceholder} />
        )}

        {/* Status badges */}
        <View style={styles.badgeRow}>
          <View style={[styles.statusBadge, { backgroundColor: event.isBlocked ? '#F8D7DA' : '#D4EDDA' }]}>
            <Text style={[styles.statusText, { color: event.isBlocked ? '#721c24' : '#155724' }]}>
              {event.isBlocked ? 'Заблокировано' : 'Активно'}
            </Text>
          </View>
          {statusLabel ? (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{statusLabel}</Text>
            </View>
          ) : null}
          {typeLabel ? (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{typeLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* Title + description */}
        <Section title="Основное">
          <Row label="ID" value={event.id} />
          <Row label="Название" value={event.title} />
          {event.description ? (
            <View style={styles.descBlock}>
              <Text style={styles.rowLabel}>Описание</Text>
              <Text style={styles.descText}>{event.description}</Text>
            </View>
          ) : null}
          <Row label="sessionId" value={event.sessionId} />
        </Section>

        {/* Schedule */}
        <Section title="Расписание">
          <Row label="Начало" value={fmtDate(event.datetimeStart)} />
          <Row label="Конец" value={fmtDate(event.datetimeEnd)} />
          <Row label="Длительность" value={event.durationMinutes != null ? `${event.durationMinutes} мин` : null} />
          <Row label="Макс. участников" value={event.maxParticipants != null ? String(event.maxParticipants) : null} />
        </Section>

        {/* Participants */}
        {event.participants != null && (
          <Section title="Участники">
            <Row label="Всего зарегистрировано" value={String(event.participants.total)} />
            <Row label="Из них оплатили" value={String(event.participants.paid)} />
          </Section>
        )}

        {/* Financials */}
        <Section title="Финансы">
          <Row label="Цена" value={fmtMoney(event.price)} />
          <Row label="Комиссия платформы" value={fmtMoney(event.platformFee)} />
          <Row label="Выручка наставника" value={fmtMoney(event.mentorRevenue)} />
        </Section>

        {/* Mentor */}
        {event.mentor && (
          <Section title="Наставник">
            <Pressable
              style={styles.mentorRow}
              onPress={() => router.push(`/admin/user-detail?id=${event.mentor!.id}` as any)}
            >
              {event.mentor.avatarUrl ? (
                <Image source={{ uri: event.mentor.avatarUrl }} style={styles.mentorAvatar} />
              ) : (
                <View style={[styles.mentorAvatar, styles.mentorAvatarPlaceholder]}>
                  <Text style={styles.mentorAvatarInitial}>
                    {(event.mentor.fullName || '?')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.mentorInfo}>
                <Text style={styles.mentorName}>{event.mentor.fullName}</Text>
                <Text style={styles.mentorEmail}>{event.mentor.email}</Text>
                <Text style={styles.mentorLink}>Открыть профиль →</Text>
              </View>
            </Pressable>
          </Section>
        )}

        {/* Video room */}
        {event.videoRoom && (
          <Section title="Видеокомната">
            <Row label="Провайдер" value={event.videoRoom.provider} />
            <Row label="Ссылка" value={event.videoRoom.url} />
            <Row label="Ссылка модератора" value={event.videoRoom.moderatorUrl} />
            <Row label="External ID" value={event.videoRoom.externalId} />
            <Row label="Активна" value={event.videoRoom.isActive ? 'Да' : 'Нет'} />
            <Row label="Истекает" value={fmtDate(event.videoRoom.expiresAt)} />
          </Section>
        )}

        {/* Recording */}
        {event.recordingUrl ? (
          <Section title="Запись">
            <Row label="URL записи" value={event.recordingUrl} />
          </Section>
        ) : null}

        {/* Meta */}
        <Section title="Служебное">
          <Row label="Создано" value={fmtDate(event.createdAt)} />
          <Row label="Обновлено" value={fmtDate(event.updatedAt)} />
        </Section>

        {/* Moderation */}
        <View style={styles.modSection}>
          <Pressable
            style={styles.modToggle}
            onPress={() => { setModVisible(v => !v); setModError(''); setModSuccess(false); }}
          >
            <Text style={styles.modToggleText}>
              {modVisible ? '▲ Скрыть форму правок' : '✏️ Предложить правки наставнику'}
            </Text>
          </Pressable>

          {modVisible && (
            <View style={styles.modForm}>
              <Text style={styles.modLabel}>Обложка</Text>
              <Pressable style={styles.modCoverBtn} onPress={pickModCover}>
                {modCoverUri ? (
                  <Image source={{ uri: modCoverUri }} style={styles.modCoverPreview} resizeMode="cover" />
                ) : (
                  <Text style={styles.modCoverBtnText}>Выбрать изображение</Text>
                )}
              </Pressable>
              {modCoverUri ? (
                <Pressable onPress={() => setModCoverUri(null)}>
                  <Text style={styles.modCoverRemove}>Удалить выбранное фото</Text>
                </Pressable>
              ) : null}

              <Text style={styles.modLabel}>Название</Text>
              <TextInput
                style={styles.modInput}
                value={modFields.title}
                onChangeText={v => setModFields(f => ({ ...f, title: v }))}
                placeholder="Новое название события"
                placeholderTextColor="#9B9B9B"
              />

              <Text style={styles.modLabel}>Описание</Text>
              <TextInput
                style={[styles.modInput, styles.modInputMultiline]}
                value={modFields.description}
                onChangeText={v => setModFields(f => ({ ...f, description: v }))}
                placeholder="Новое описание"
                placeholderTextColor="#9B9B9B"
                multiline
                numberOfLines={4}
              />

              <View style={styles.modTeamCommentBox}>
                <Text style={styles.modTeamCommentLabel}>Комментарий от команды (отправляется всегда)</Text>
                <Text style={styles.modTeamCommentText}>{TEAM_COMMENT}</Text>
              </View>

              <Text style={styles.modLabel}>Дополнительный комментарий (необязательно)</Text>
              <TextInput
                style={[styles.modInput, styles.modInputMultiline]}
                value={modFields.comment}
                onChangeText={v => setModFields(f => ({ ...f, comment: v }))}
                placeholder="Пояснение: что и почему нужно изменить"
                placeholderTextColor="#9B9B9B"
                multiline
                numberOfLines={3}
              />

              {modError ? <Text style={styles.modError}>{modError}</Text> : null}
              {modSuccess ? (
                <Text style={styles.modSuccessText}>Правки отправлены.</Text>
              ) : null}

              <Pressable
                style={[styles.modSubmitBtn, (modSaving || modCoverUploading) && styles.modSubmitBtnDisabled]}
                onPress={handleModerate}
                disabled={modSaving || modCoverUploading}
              >
                {modCoverUploading
                  ? <><ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} /><Text style={styles.modSubmitText}>Загрузка обложки...</Text></>
                  : modSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modSubmitText}>Отправить правки</Text>
                }
              </Pressable>
            </View>
          )}
        </View>
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

  cover: { width: '100%', height: 200, backgroundColor: '#E5E5E5' },
  coverPlaceholder: { width: '100%', height: 120, backgroundColor: '#E5E5E5' },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E5E5E5' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontFamily: 'Inter-Regular', fontWeight: '600' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#E5E5E5' },
  typeBadgeText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#181818' },

  section: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, borderBottomWidth: 1, borderColor: '#E5E5E5' },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  row: { flexDirection: 'row', paddingVertical: 7, borderTopWidth: 1, borderColor: '#F0F0F0' },
  rowLabel: { width: 160, fontSize: 13, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  rowValue: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818' },

  descBlock: { paddingVertical: 7, borderTopWidth: 1, borderColor: '#F0F0F0' },
  descText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818', lineHeight: 20, marginTop: 4 },

  mentorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderColor: '#F0F0F0' },
  mentorAvatar: { width: 48, height: 48, backgroundColor: '#E5E5E5' },
  mentorAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  mentorAvatarInitial: { fontSize: 18, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  mentorInfo: { flex: 1 },
  mentorName: { fontSize: 14, fontFamily: 'Inter-Regular', fontWeight: '600', color: '#181818' },
  mentorEmail: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginTop: 1 },
  mentorLink: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#555', marginTop: 3 },

  modSection: { borderTopWidth: 1, borderColor: '#E5E5E5', marginTop: 8 },
  modToggle: { paddingHorizontal: 16, paddingVertical: 14 },
  modToggleText: { fontSize: 14, fontFamily: 'Inter-Regular', fontWeight: '600', color: '#181818' },
  modForm: { paddingHorizontal: 16, paddingBottom: 24 },
  modLabel: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 4, marginTop: 12 },
  modTeamCommentBox: { backgroundColor: '#F5F5F5', borderLeftWidth: 3, borderLeftColor: '#BDBDBD', padding: 12, marginTop: 12 },
  modTeamCommentLabel: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  modTeamCommentText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#444', lineHeight: 18 },
  modInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    backgroundColor: '#FAFAFA',
  },
  modInputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  modCoverBtn: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FAFAFA',
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modCoverPreview: { width: '100%', height: 80 },
  modCoverBtnText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  modCoverRemove: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#E02D2D', marginTop: 4 },
  modError: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D', marginTop: 12 },
  modSuccessText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#155724', backgroundColor: '#D4EDDA', padding: 10, marginTop: 12 },
  modSubmitBtn: { marginTop: 16, backgroundColor: '#181818', paddingVertical: 14, alignItems: 'center' },
  modSubmitBtnDisabled: { opacity: 0.6 },
  modSubmitText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#FAFAFA', fontWeight: '600' },
});
