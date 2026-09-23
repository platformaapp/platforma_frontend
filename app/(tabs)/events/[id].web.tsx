import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { API_BASE, endpoints } from '@/constants/env';
import { updateEvent, uploadEventImage, type EventPatchBody } from '@/lib/api/events';
import { getPaymentMethods, type PaymentMethod } from '@/lib/api/student-payments';
import { getPublicTutorList, getPublicTutors } from '@/lib/api/tutor';
import { getAuthToken, getUserProfile } from '@/lib/auth';
import { isRegisteredOnEventItem, unwrapApiData } from '@/lib/event-feed';

const PLACEHOLDER_AVATAR = require('@/assets/images/avatar.png');

function resolveUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

type EventDetail = {
  id: string;
  title: string;
  description?: string;
  datetimeStart?: string;
  price?: number;
  coverUrl?: string | null;
  mentor?: { id: string; name: string; avatarUrl?: string | null; bio?: string; shortBio?: string };
  isRegistered?: boolean;
  maxParticipants?: number;
  hasPaidRegistrations?: boolean;
};

function normalizeEvent(raw: Record<string, unknown>): EventDetail {
  const r = (unwrapApiData<Record<string, unknown>>(raw) ?? raw) as Record<string, unknown>;
  const datetimeStart = (r.datetimeStart ?? r.datetime_start ?? r.startAt ?? r.start_at) as string | undefined;
  const price = typeof r.price === 'number' ? r.price : typeof r.price === 'string' ? parseFloat(r.price as string) : undefined;
  const mentorRaw = (r.mentor ?? r.teacher ?? r.tutor) as Record<string, unknown> | undefined;
  const mentor = mentorRaw ? {
    id: String(mentorRaw.id ?? mentorRaw.userId ?? mentorRaw.user_id ?? ''),
    name: String(mentorRaw.name ?? mentorRaw.fullName ?? mentorRaw.full_name ?? ''),
    avatarUrl: resolveUrl(mentorRaw.avatarUrl ?? mentorRaw.avatar_url ?? mentorRaw.avatar ?? mentorRaw.photo),
    bio: (mentorRaw.bio ?? mentorRaw.description ?? '') as string,
    shortBio: (mentorRaw.shortBio ?? mentorRaw.short_bio ?? '') as string,
  } : undefined;
  const cupRaw = (r.currentUserParticipation ?? r.current_user_participation) as Record<string, unknown> | undefined;
  const cupStatus = (cupRaw?.status as string | undefined)?.toLowerCase();
  const registeredFromCup = cupStatus ? ['registered', 'confirmed', 'active', 'paid', 'attended', 'completed', 'pending'].includes(cupStatus) : false;

  const maxParticipantsRaw = r.maxParticipants ?? r.max_participants;
  const maxParticipants = typeof maxParticipantsRaw === 'number' ? maxParticipantsRaw : typeof maxParticipantsRaw === 'string' ? parseInt(maxParticipantsRaw, 10) : undefined;
  const hasPaidRegistrations = Boolean(r.hasPaidRegistrations ?? r.has_paid_registrations);

  return {
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    description: (r.description as string) ?? undefined,
    datetimeStart,
    price,
    coverUrl: resolveUrl(r.coverUrl ?? r.cover_url ?? r.imageUrl ?? r.image_url ?? r.cover),
    mentor,
    isRegistered: isRegisteredOnEventItem(r) || registeredFromCup,
    maxParticipants: Number.isFinite(maxParticipants) ? maxParticipants : undefined,
    hasPaidRegistrations,
  };
}

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function formatDatetime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const month = MONTHS_GEN[d.getMonth()];
    const hh = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${hh}:${mm}`;
  } catch {
    return iso ?? '';
  }
}

function formatPrice(price?: number): string {
  if (price == null) return 'Бесплатно';
  return `${price.toLocaleString('ru-RU')} Р`;
}

function formatEditDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

function stripLeadingZeroTime(t: string): string {
  const m = t.match(/^0?(\d{1,2}):(\d{2})/);
  if (!m) return t;
  return `${m[1]}:${m[2]}`;
}

/**
 * Веб-версия страницы события. Регистрация на платное событие реализована по
 * той же схеме, что и в нативном app/(tabs)/events/[id].tsx (POST /register,
 * редирект на confirmation_url при payment_required) — но без модалки выбора
 * карты, прогресс-бара ожидания оплаты и авто-отмены зависших платежей: эта
 * логика продублирована из нативного экрана, а не вынесена в общий хук,
 * чтобы не рисковать регрессией в уже работающей нативной оплате.
 */
export default function EventDetailScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [cancelStep, setCancelStep] = useState<'none' | 'confirm' | 'success'>('none');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<'none' | 'confirm'>('none');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editTimeStr, setEditTimeStr] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editMaxParticipants, setEditMaxParticipants] = useState('');
  const [editCoverUri, setEditCoverUri] = useState<string | null>(null);
  const [editExistingCoverUrl, setEditExistingCoverUrl] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const editDateRef = useRef<any>(null);
  const editTimeRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    getUserProfile().then((profile) => { if (active && profile?.id) setCurrentUserId(profile.id); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const token = await getAuthToken();
        const res = await fetch(`${endpoints.events}/${id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (active) setError(body?.message ?? body?.error ?? `Не удалось загрузить событие (${res.status})`);
          return;
        }
        const data = await res.json();
        const normalized = normalizeEvent(data);
        if (active) setEvent(normalized);

        // API события отдаёт для наставника только bio (полный текст) и не
        // отдаёт shortBio (короткую подпись-роль вроде "Куратор, исследователь
        // культуры") — подтягиваем её из общего публичного списка наставников
        // (там это поле есть, см. explore/[id].web.tsx — тот же приём).
        if (normalized.mentor && !normalized.mentor.shortBio) {
          try {
            const [authList, publicList] = await Promise.all([getPublicTutorList(), getPublicTutors()]);
            const tutor = authList.find((t) => t.id === normalized.mentor!.id) ?? publicList.find((t) => t.id === normalized.mentor!.id);
            const shortBio = (tutor as any)?.shortBio ?? (tutor as any)?.short_bio;
            if (active && shortBio) {
              setEvent((prev) => prev && prev.mentor ? { ...prev, mentor: { ...prev.mentor, shortBio } } : prev);
            }
          } catch { /* блок наставника остаётся без короткой подписи */ }
        }
      } catch (e: any) {
        if (active) setError(e?.message ?? 'Не удалось загрузить событие');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  async function handleRegister() {
    if (!event || isRegistering) return;
    setIsRegistering(true);
    setRegisterError('');
    try {
      const [token, cards] = await Promise.all([getAuthToken(), getPaymentMethods().catch(() => [] as PaymentMethod[])]);
      if (!token) { router.push(`/login?redirect=/events/${event.id}` as any); return; }

      const defaultCard = cards.find((c) => c.isDefault) ?? cards[0] ?? null;
      const body: Record<string, unknown> = {};
      if (defaultCard) body.payment_method_id = defaultCard.id;

      const res = await fetch(`${endpoints.events}/${event.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) { setEvent((prev) => prev ? { ...prev, isRegistered: true } : prev); return; }
        throw new Error(data?.message ?? `Ошибка регистрации (${res.status})`);
      }

      if (!data?.payment_required) {
        setEvent((prev) => prev ? { ...prev, isRegistered: true } : prev);
        return;
      }

      const confirmUrl: string | null = data?.confirmation_url ?? data?.confirmationUrl ?? data?.redirect_url ?? null;
      if (confirmUrl) {
        const w = (globalThis as any).window;
        if (w) w.location.href = confirmUrl;
        return;
      }
      throw new Error(data?.payment_error ?? data?.message ?? 'Не получена ссылка для оплаты');
    } catch (e: any) {
      setRegisterError(e?.message ?? 'Не удалось зарегистрироваться');
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleCancelRegistration() {
    if (!event || isCancelling) return;
    setIsCancelling(true);
    setCancelError('');
    try {
      const token = await getAuthToken();
      if (!token) { router.push(`/login?redirect=/events/${event.id}` as any); return; }
      const headers = { Authorization: `Bearer ${token}` };

      let res = await fetch(`${endpoints.events}/${event.id}/registration`, { method: 'DELETE', headers });
      if (res.status === 404 || res.status === 405) {
        res = await fetch(`${endpoints.events}/${event.id}/unregister`, { method: 'POST', headers });
      }
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? `Не удалось отменить запись (${res.status})`);
      }

      setEvent((prev) => (prev ? { ...prev, isRegistered: false } : prev));
      setCancelStep('success');
    } catch (e: any) {
      setCancelError(e?.message ?? 'Не удалось отменить запись');
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleShare() {
    const w = (globalThis as any).window;
    if (w) await Clipboard.setStringAsync(w.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  async function handleDeleteEvent() {
    if (!event || isDeleting) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const token = await getAuthToken();
      if (!token) { router.push(`/login?redirect=/events/${event.id}` as any); return; }
      const res = await fetch(`${endpoints.events}/${event.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? `Не удалось отменить событие (${res.status})`);
      }
      router.replace('/(tabs)/myevents' as any);
    } catch (e: any) {
      setDeleteError(e?.message ?? 'Не удалось отменить событие');
    } finally {
      setIsDeleting(false);
    }
  }

  function openEditModal() {
    if (!event) return;
    setEditTitle(event.title ?? '');
    setEditDescription(event.description ?? '');
    const dtStart = event.datetimeStart ? new Date(event.datetimeStart) : null;
    setEditDate(dtStart);
    setEditTimeStr(dtStart ? `${String(dtStart.getHours()).padStart(2, '0')}:${String(dtStart.getMinutes()).padStart(2, '0')}` : '');
    setEditPrice(event.price != null ? String(event.price) : '');
    setEditMaxParticipants(event.maxParticipants != null ? String(event.maxParticipants) : '');
    setEditCoverUri(null);
    setEditExistingCoverUrl(event.coverUrl ?? null);
    setEditStatus(null);
    setEditOpen(true);
  }

  function pickEditCover() {
    editFileRef.current?.click();
  }

  async function onEditCoverFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setEditCoverUri(dataUri);
    e.target.value = '';
  }

  async function handleSaveEdit() {
    if (!event || isSavingEdit) return;
    setEditStatus(null);
    if (!event.hasPaidRegistrations && !editTitle.trim()) { setEditStatus('Введите название'); return; }

    const patch: EventPatchBody = {};
    if (!event.hasPaidRegistrations) {
      if (editTitle.trim()) patch.title = editTitle.trim();
      if (editDescription.trim()) patch.description = editDescription.trim();
      patch.price = editPrice ? parseInt(editPrice, 10) || 0 : 0;
      if (editMaxParticipants) patch.max_participants = Math.max(1, parseInt(editMaxParticipants, 10) || 30);
      if (editDate && editTimeStr) {
        const m = editTimeStr.trim().match(/^(\d{1,2}):(\d{2})/);
        if (!m) { setEditStatus('Неверный формат времени'); return; }
        const h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        if (h < 0 || h > 23 || min < 0 || min > 59) { setEditStatus('Неверный формат времени'); return; }
        const start = new Date(editDate.getFullYear(), editDate.getMonth(), editDate.getDate(), h, min, 0);
        patch.datetime_start = start.toISOString();
      }
    }

    setIsSavingEdit(true);

    if (editCoverUri) {
      try {
        setEditStatus('Загрузка обложки...');
        patch.coverUrl = await uploadEventImage(editCoverUri);
      } catch (uploadErr: any) {
        setEditStatus(uploadErr?.message ?? 'Не удалось загрузить обложку');
        setIsSavingEdit(false);
        return;
      }
    }

    if (Object.keys(patch).length === 0) {
      setEditStatus('Нет изменений для сохранения');
      setIsSavingEdit(false);
      return;
    }

    try {
      setEditStatus('Сохранение...');
      await updateEvent(event.id, patch);
      setEvent((prev) => prev ? {
        ...prev,
        title: patch.title ?? prev.title,
        description: patch.description ?? prev.description,
        price: patch.price ?? prev.price,
        maxParticipants: editMaxParticipants ? (Math.max(1, parseInt(editMaxParticipants, 10) || 30)) : prev.maxParticipants,
        datetimeStart: patch.datetime_start ?? prev.datetimeStart,
        coverUrl: patch.coverUrl ?? prev.coverUrl,
      } : prev);
      setEditOpen(false);
    } catch (e: any) {
      setEditStatus(e?.message ?? 'Не удалось сохранить изменения');
    } finally {
      setIsSavingEdit(false);
    }
  }

  const isOwnEvent = currentUserId != null && event?.mentor?.id === currentUserId;

  const metaBlock = (
    <View style={styles.metaRow}>
      <View>
        <Text style={styles.metaLabel}>Дата:</Text>
        <Text style={styles.metaValue}>{formatDatetime(event?.datetimeStart)}</Text>
      </View>
      <View>
        <Text style={styles.metaLabel}>Стоимость:</Text>
        <Text style={styles.metaValue}>{formatPrice(event?.price)}</Text>
      </View>
    </View>
  );

  const mentorRow = event?.mentor ? (
    <View style={styles.mentorRow}>
      <View style={styles.mentorInfo}>
        <Text style={styles.mentorName}>{event.mentor.name}</Text>
        {event.mentor.shortBio ? <Text style={styles.mentorBio}>{event.mentor.shortBio}</Text> : null}
      </View>
      <Image
        source={event.mentor.avatarUrl && !event.mentor.avatarUrl.startsWith('blob:') ? { uri: event.mentor.avatarUrl } : PLACEHOLDER_AVATAR}
        style={styles.mentorAvatar}
        resizeMode="cover"
      />
    </View>
  ) : null;

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageContent}>
        <Pressable style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/events' as any))} hitSlop={8}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#010101" /></View>
        ) : error || !event ? (
          <View style={styles.centered}><Text style={styles.errorText}>{error || 'Событие не найдено'}</Text></View>
        ) : isMobile ? (
          <View>
            <Text style={[styles.title, styles.titleMobile]}>{event.title}</Text>

            {event.coverUrl ? (
              <View style={styles.mobileHeaderRow}>
                <Image source={{ uri: event.coverUrl }} style={styles.mobileThumb} resizeMode="cover" />
                <View style={styles.mobileMetaCol}>
                  <Text style={styles.mobileMetaValue}>{formatDatetime(event.datetimeStart)}</Text>
                  <Text style={styles.mobileMetaValue}>{formatPrice(event.price)}</Text>
                </View>
              </View>
            ) : metaBlock}

            {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

            {registerError ? <Text style={styles.errorText}>{registerError}</Text> : null}

            {isOwnEvent ? (
              <>
                <Pressable style={styles.chipButton} onPress={openEditModal}>
                  <Text style={styles.chipButtonText}>Редактировать событие</Text>
                </Pressable>
                <Pressable style={styles.chipButton} onPress={() => setDeleteStep('confirm')}>
                  <Text style={styles.chipButtonText}>Отменить событие</Text>
                </Pressable>
              </>
            ) : (
              <>
                {event.isRegistered ? (
                  <Pressable style={styles.chipButton} onPress={() => setCancelStep('confirm')}>
                    <Text style={styles.chipButtonText}>Отменить запись</Text>
                  </Pressable>
                ) : (
                  <Pressable style={[styles.chipButton, isRegistering && styles.btnDisabled]} onPress={handleRegister} disabled={isRegistering}>
                    <Text style={styles.chipButtonText}>{isRegistering ? 'Регистрируем…' : 'Зарегистрироваться'}</Text>
                  </Pressable>
                )}
              </>
            )}

            {event.mentor ? (
              <View style={styles.mobileMentorBlock}>
                {mentorRow}
                <Pressable style={styles.chipButton} onPress={() => router.push(`/(tabs)/explore/${event.mentor!.id}` as any)}>
                  <Text style={styles.chipButtonText}>Перейти в профиль</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.desktopLayout}>
            <View style={styles.leftCol}>
              <Text style={styles.title}>{event.title}</Text>
              {event.description ? <Text style={styles.description}>{event.description}</Text> : null}
              {metaBlock}

              {registerError ? <Text style={styles.errorText}>{registerError}</Text> : null}

              <View style={styles.actionsRow}>
                {isOwnEvent ? (
                  <>
                    <Pressable onPress={openEditModal}>
                      <Text style={styles.actionLink}>Редактировать событие</Text>
                    </Pressable>
                    <Pressable onPress={() => setDeleteStep('confirm')}>
                      <Text style={styles.actionLink}>Отменить событие</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    {event.isRegistered ? (
                      <Pressable onPress={() => setCancelStep('confirm')}>
                        <Text style={styles.actionLink}>Отменить запись</Text>
                      </Pressable>
                    ) : (
                      <Pressable onPress={handleRegister} disabled={isRegistering}>
                        <Text style={[styles.actionLink, isRegistering && styles.actionLinkDisabled]}>{isRegistering ? 'Регистрируем…' : 'Зарегистрироваться'}</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={handleShare}>
                      <Text style={styles.actionLink}>{shareCopied ? 'Ссылка скопирована' : 'Поделиться событием'}</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>

            <View style={styles.rightCol}>
              {event.coverUrl ? <Image source={{ uri: event.coverUrl }} style={styles.cover} resizeMode="cover" /> : null}
              {event.mentor ? (
                <View>
                  {mentorRow}
                  <Pressable onPress={() => router.push(`/(tabs)/explore/${event.mentor!.id}` as any)}>
                    <Text style={styles.actionLink}>Перейти в профиль</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </View>

        <SiteFooter />
      </ScrollView>

      <Modal transparent animationType="fade" visible={cancelStep !== 'none'} onRequestClose={() => setCancelStep('none')}>
        <View style={[styles.cancelOverlay, { pointerEvents: 'box-none' }]}>
          <View style={styles.cancelModalCard}>
            <Pressable style={styles.cancelCloseButton} onPress={() => setCancelStep('none')} hitSlop={8}>
              <Text style={styles.cancelCloseText}>✕</Text>
            </Pressable>
            {cancelStep === 'success' ? (
              <Text style={styles.cancelModalTitle}>Запись отменена</Text>
            ) : (
              <>
                <Text style={styles.cancelModalTitle}>Вы действительно хотите отменить запись?</Text>
                <Text style={styles.cancelModalText}>Отменить запись можно не позднее, чем за 24 часа до начала</Text>
                {cancelError ? <Text style={styles.errorText}>{cancelError}</Text> : null}
                <View style={styles.cancelModalActions}>
                  <Pressable onPress={() => setCancelStep('none')}>
                    <Text style={styles.cancelModalLeave}>Оставить</Text>
                  </Pressable>
                  <Pressable onPress={handleCancelRegistration} disabled={isCancelling}>
                    <Text style={[styles.cancelModalConfirm, isCancelling && styles.actionLinkDisabled]}>
                      {isCancelling ? 'Отменяем…' : 'Отменить запись'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={deleteStep !== 'none'} onRequestClose={() => setDeleteStep('none')}>
        <View style={[styles.cancelOverlay, { pointerEvents: 'box-none' }]}>
          <View style={styles.cancelModalCard}>
            <Pressable style={styles.cancelCloseButton} onPress={() => setDeleteStep('none')} hitSlop={8}>
              <Text style={styles.cancelCloseText}>✕</Text>
            </Pressable>
            <Text style={styles.cancelModalTitle}>Вы действительно хотите отменить событие?</Text>
            <Text style={styles.cancelModalText}>Все зарегистрированные участники будут уведомлены об отмене. Действие необратимо.</Text>
            {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
            <View style={styles.cancelModalActions}>
              <Pressable onPress={() => setDeleteStep('none')}>
                <Text style={styles.cancelModalLeave}>Оставить</Text>
              </Pressable>
              <Pressable onPress={handleDeleteEvent} disabled={isDeleting}>
                <Text style={[styles.cancelModalConfirm, isDeleting && styles.actionLinkDisabled]}>
                  {isDeleting ? 'Отменяем…' : 'Отменить событие'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={editOpen} onRequestClose={() => setEditOpen(false)}>
        <View style={[styles.editOverlay, { pointerEvents: 'box-none' }]}>
          <View style={styles.editModalCard}>
            <View style={styles.editHeaderRow}>
              <Text style={styles.editTitle}>Изменение события</Text>
              <Pressable onPress={() => setEditOpen(false)} hitSlop={8}>
                <Text style={styles.editCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.editScroll} contentContainerStyle={styles.editScrollContent}>
              {event?.hasPaidRegistrations ? (
                <Text style={styles.editLockedNote}>Есть оплаченные регистрации — изменить можно только обложку</Text>
              ) : null}

              <View style={styles.editFieldWrap}>
                <Text style={styles.editFieldLabel}>Название</Text>
                <TextInput
                  value={editTitle}
                  onChangeText={setEditTitle}
                  style={styles.editFieldInput}
                  editable={!event?.hasPaidRegistrations}
                />
              </View>

              <View style={styles.editFieldWrap}>
                <Text style={styles.editFieldLabel}>Описание</Text>
                <TextInput
                  value={editDescription}
                  onChangeText={setEditDescription}
                  style={[styles.editFieldInput, styles.editFieldMultiline]}
                  multiline
                  editable={!event?.hasPaidRegistrations}
                />
              </View>

              <View style={styles.editFieldWrap}>
                <Text style={styles.editFieldLabel}>Дата</Text>
                <Pressable
                  style={styles.editFieldValueRow}
                  onPress={event?.hasPaidRegistrations ? undefined : () => { try { editDateRef.current?.showPicker?.(); } catch { editDateRef.current?.click?.(); } }}
                >
                  <Text style={styles.editFieldValue}>{editDate ? formatEditDate(editDate) : 'Дата'}</Text>
                  <input
                    ref={editDateRef}
                    type="date"
                    value={editDate ? `${editDate.getFullYear()}-${String(editDate.getMonth() + 1).padStart(2, '0')}-${String(editDate.getDate()).padStart(2, '0')}` : ''}
                    style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' } as any}
                    onChange={(e: any) => { const v = e.target.value; if (v) { const [y, mo, d] = v.split('-').map(Number); setEditDate(new Date(y, mo - 1, d)); } }}
                    disabled={event?.hasPaidRegistrations}
                  />
                </Pressable>
              </View>

              <View style={styles.editFieldWrap}>
                <Text style={styles.editFieldLabel}>Время</Text>
                <Pressable
                  style={styles.editFieldValueRow}
                  onPress={event?.hasPaidRegistrations ? undefined : () => { try { editTimeRef.current?.showPicker?.(); } catch { editTimeRef.current?.click?.(); } }}
                >
                  <Text style={styles.editFieldValue}>{editTimeStr ? stripLeadingZeroTime(editTimeStr) : 'Время'}</Text>
                  <input
                    ref={editTimeRef}
                    type="time"
                    value={editTimeStr}
                    style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' } as any}
                    onChange={(e: any) => { const v = e.target.value; if (v) setEditTimeStr(v); }}
                    disabled={event?.hasPaidRegistrations}
                  />
                </Pressable>
              </View>

              <View style={styles.editFieldWrap}>
                <Text style={styles.editFieldLabel}>Стоимость</Text>
                {event?.hasPaidRegistrations ? (
                  <Text style={styles.editFieldValue}>{editPrice ? `${editPrice} Р` : 'Бесплатно'}</Text>
                ) : (
                  <TextInput
                    value={editPrice}
                    onChangeText={(t) => setEditPrice(t.replace(/\D/g, ''))}
                    style={styles.editFieldInput}
                    keyboardType="numeric"
                    placeholder="0 — бесплатно"
                  />
                )}
                {editPrice && parseInt(editPrice, 10) > 0 ? (
                  <Text style={styles.editCommissionText}>
                    Комиссия 10% — вы получите {Math.round(parseInt(editPrice, 10) * 0.9)} Р
                  </Text>
                ) : null}
              </View>

              <View style={styles.editFieldWrap}>
                <Text style={styles.editFieldLabel}>Обложка</Text>
                <Pressable onPress={event?.hasPaidRegistrations ? undefined : pickEditCover} style={styles.editCoverThumbWrap}>
                  {(editCoverUri || editExistingCoverUrl) ? (
                    <Image source={{ uri: editCoverUri ?? editExistingCoverUrl! }} style={styles.editCoverThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.editCoverThumb, styles.editCoverThumbEmpty]} />
                  )}
                </Pressable>
                <input ref={editFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onEditCoverFileChange} />
              </View>

              <View style={styles.editFieldWrap}>
                <Text style={styles.editFieldLabel}>Максимальное количество участников</Text>
                <TextInput
                  value={editMaxParticipants}
                  onChangeText={(t) => setEditMaxParticipants(t.replace(/\D/g, ''))}
                  style={styles.editFieldInput}
                  keyboardType="numeric"
                  editable={!event?.hasPaidRegistrations}
                />
              </View>

              {editStatus ? <Text style={styles.editStatusText}>{editStatus}</Text> : null}
            </ScrollView>

            <View style={styles.editFooterRow}>
              <Pressable onPress={() => setEditOpen(false)}>
                <Text style={styles.editCancelText}>Отменить</Text>
              </Pressable>
              <Pressable onPress={handleSaveEdit} disabled={isSavingEdit}>
                <Text style={[styles.editSaveText, isSavingEdit && styles.actionLinkDisabled]}>
                  {isSavingEdit ? 'Сохранение…' : 'Сохранить'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 24, paddingBottom: 24 },
  pageContent: { paddingHorizontal: 32 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 16 },
  backButton: { alignSelf: 'flex-start', marginBottom: 16 },
  backArrow: { fontSize: 20, color: '#010101' },

  // Desktop: узкая текстовая колонка слева (заголовок оборачивается в
  // 2-3 строки, как на референсе), картинка (альбомная, не фикс. высота)
  // + карточка наставника — в широкой колонке справа.
  desktopLayout: { flexDirection: 'row', gap: 48, alignItems: 'flex-start', justifyContent: 'space-between' },
  leftCol: { flexBasis: 420, maxWidth: 420, flexShrink: 1 },
  rightCol: { flex: 1, minWidth: 0, maxWidth: 709 },
  cover: { width: '100%', aspectRatio: 1.44, marginBottom: 24, backgroundColor: '#E5E5E5' },

  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 16 },
  titleMobile: { fontSize: 25, lineHeight: 28 },
  description: { fontSize: 19, lineHeight: 26, fontFamily: 'Gramatika-Regular', color: '#010101', marginBottom: 24 },
  metaRow: { flexDirection: 'row', gap: 48, marginBottom: 24 },
  metaLabel: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#000', marginBottom: 4 },
  metaValue: { fontSize: 16, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  actionLink: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 18, color: '#E02D2D' },
  actionLinkDisabled: { color: '#9B9B9B' },
  btnDisabled: { opacity: 0.6 },

  mentorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  // maxWidth обязателен: rightCol — flex:1 (под широкое фото), без него
  // текстовый блок (особенно с добавленным bio) растягивался бы почти на
  // всю ширину колонки вместо компактной подписи рядом с аватаром.
  mentorInfo: { flex: 1, maxWidth: 360 },
  mentorName: { fontSize: 25, lineHeight: 28, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 4 },
  mentorBio: { fontSize: 18, lineHeight: 18, fontFamily: 'Gramatika-Regular', color: '#000' },
  // Крупный портретный кадр (как на /explore), а не маленький квадратный
  // значок — см. референс страницы события.
  mentorAvatar: { width: 110, height: 132, backgroundColor: '#E5E5E5', flexShrink: 0 },

  // Mobile: широкая обложка (не квадратная миниатюра) слева, дата/цена
  // справа по верхнему краю — см. референс мобильной карточки события.
  mobileHeaderRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', marginBottom: 16 },
  mobileThumb: { flex: 1, height: 160, backgroundColor: '#E5E5E5' },
  mobileMetaCol: { gap: 6, paddingTop: 4 },
  mobileMetaValue: { fontSize: 16, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', textAlign: 'right' },
  // Заметный отступ перед блоком наставника — см. референс.
  mobileMentorBlock: { marginTop: 56 },
  chipButton: { backgroundColor: '#F0F5FB', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  chipButtonText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 15, color: '#68717A' },

  cancelOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(24,24,24,0.45)', padding: 16 },
  cancelModalCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', padding: 24, position: 'relative' },
  cancelCloseButton: { position: 'absolute', top: 16, right: 16, padding: 4 },
  cancelCloseText: { fontSize: 18, color: '#687076' },
  cancelModalTitle: { fontSize: 18, lineHeight: 24, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 8, paddingRight: 24 },
  cancelModalText: { fontSize: 13, lineHeight: 18, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 20 },
  cancelModalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelModalLeave: { fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#687076' },
  cancelModalConfirm: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 14, color: '#E02D2D' },

  // "Изменение события" — попап поверх текущей (дименой) страницы события,
  // а не отдельный полноэкранный маршрут (см. референс) — та же механика
  // overlay/карточки, что и у cancelOverlay выше, просто крупнее и со своим
  // скроллом/шапкой/подвалом.
  editOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(24,24,24,0.45)', padding: 16 },
  editModalCard: { width: '100%', maxWidth: 640, maxHeight: '85%', backgroundColor: '#fff', padding: 32 },
  editHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16 },
  editTitle: { flex: 1, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 32, lineHeight: 36, color: '#010101' },
  editCloseText: { fontSize: 22, color: '#010101', marginTop: 4 },
  editScroll: { flexGrow: 0 },
  editScrollContent: { paddingBottom: 8 },
  editLockedNote: { fontSize: 13, lineHeight: 18, fontFamily: 'Gramatika-Regular', color: '#856404', backgroundColor: '#FFF3CD', borderWidth: 1, borderColor: '#856404', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 20 },
  editFieldWrap: { marginBottom: 28 },
  editFieldLabel: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 6 },
  editFieldInput: { fontSize: 16, lineHeight: 22, fontFamily: 'Gramatika-Regular', color: '#010101', padding: 0, borderWidth: 0, backgroundColor: 'transparent', outlineStyle: 'none' } as any,
  editFieldMultiline: { minHeight: 60, textAlignVertical: 'top' },
  editFieldValueRow: { position: 'relative' },
  editFieldValue: { fontSize: 16, lineHeight: 22, fontFamily: 'Gramatika-Regular', color: '#010101' },
  editCommissionText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginTop: 6 },
  editCoverThumbWrap: { alignSelf: 'flex-start' },
  editCoverThumb: { width: 72, height: 48, backgroundColor: '#E5E5E5' },
  editCoverThumbEmpty: {},
  editStatusText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 8 },
  editFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  editCancelText: { fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#687076' },
  editSaveText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 14, color: '#E02D2D' },
});
