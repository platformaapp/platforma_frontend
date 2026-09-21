import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { API_BASE, endpoints } from '@/constants/env';
import { AuthError } from '@/lib/api/auth-error';
import { updateEvent, uploadEventImage, type EventPatchBody } from '@/lib/api/events';
import { getMyEventsForStudent, teacherName, type MyEventItem } from '@/lib/api/student-events';
import { getAuthRole, getAuthToken } from '@/lib/auth';
import { authedFetch } from '@/lib/authed-fetch';
import { buildJitsiUrl, openJitsi } from '@/lib/jitsi';

type EventItem = MyEventItem & { datetimeStart?: string; mentor?: { id: string; name: string; avatarUrl?: string | null }; registeredCount?: number };

type BookingItem = {
  id: string;
  tutor?: { id?: string; name?: string; fullName?: string; full_name?: string; avatarUrl?: string; avatar_url?: string };
  mentor?: { id?: string; name?: string; fullName?: string; full_name?: string; avatarUrl?: string; avatar_url?: string };
  student?: { id?: string; name?: string; fullName?: string; full_name?: string; avatarUrl?: string; avatar_url?: string };
  date?: string; time?: string; slot_date?: string; slot_time?: string;
  scheduled_at?: string; slot?: { date?: string; time?: string };
  status?: string; videoUrl?: string; price?: number;
  my_role?: 'student' | 'tutor';
  _viewerRole?: 'student' | 'tutor';
  studentId?: string; student_id?: string; tutorId?: string; tutor_id?: string;
};

type Tab = 'events' | 'meetings';
type CancelTarget = { kind: 'event'; item: EventItem } | { kind: 'booking'; item: BookingItem };
type MenuOption = { label: string; danger?: boolean; onPress: () => void };

const MONTHS_GEN = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function pluralRu(n: number, forms: [string, string, string]): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
}

function formatDatetime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_GEN[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso ?? '';
  }
}

function formatBookingDate(date?: string, time?: string): string {
  if (!date) return time ? time.slice(0, 5) : '';
  const timeClean = time ? time.slice(0, 5) : '00:00';
  try {
    const d = new Date(`${date}T${timeClean}:00`);
    if (!isNaN(d.getTime())) return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_GEN[d.getMonth()]} ${timeClean}`;
  } catch { /* fallback below */ }
  return `${date} ${timeClean}`;
}

/** "2 дня 3 часа и 15 минут" — для виджета "До ближайшего события" в шапке страницы. */
function formatCountdown(targetMs: number): string {
  const diff = targetMs - Date.now();
  if (diff <= 0) return 'уже началось';
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${pluralRu(days, ['день', 'дня', 'дней'])}`);
  if (hours > 0) parts.push(`${hours} ${pluralRu(hours, ['час', 'часа', 'часов'])}`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} ${pluralRu(minutes, ['минута', 'минуты', 'минут'])}`);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(' ')} и ${parts[parts.length - 1]}`;
}

function combineDatetime(date: string, time: string): string | undefined {
  if (!date) return undefined;
  const t = time || '00:00';
  const d = new Date(`${date}T${t}:00`);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function isAuthError(e: unknown): boolean {
  if (!e) return false;
  if (e instanceof AuthError) return true;
  const msg = ((e as any)?.message ?? '').toLowerCase();
  return msg.includes('token expired') || msg.includes('требуется авторизация') || msg.includes('unauthorized');
}

/**
 * Веб-версия "Мои записи" — вкладки "События" / "Личные встречи", меню "•••"
 * на карточке (настройки/написать/отменить вместо отдельных ссылок),
 * двухшаговое модальное подтверждение отмены и виджет "До ближайшего
 * события" внизу справа с кнопкой подключения к видео.
 */
export default function MyEventsScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [cancelPhase, setCancelPhase] = useState<'confirm' | 'success'>('confirm');
  const [cancelling, setCancelling] = useState(false);
  const [viewingBooking, setViewingBooking] = useState<BookingItem | null>(null);

  const [editEventItem, setEditEventItem] = useState<EventItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editMax, setEditMax] = useState('');
  const [editCoverUri, setEditCoverUri] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const [token, userRole] = await Promise.all([getAuthToken(), getAuthRole()]);
      if (!token) { setLoading(false); return; }
      setRole(userRole);
      setError('');

      const eventsPromise = getMyEventsForStudent({ role: userRole as 'student' | 'tutor', filter: 'all', time: 'all', page: 1, per_page: 50 })
        .then(({ items }) => items.map((it) => ({
          ...it,
          datetimeStart: it.start_at ?? it.startAt,
          mentor: { id: String((it.teacher as any)?.id ?? ''), name: teacherName(it.teacher), avatarUrl: null },
        } as EventItem)))
        .catch((e: any) => { console.error('[myevents.web] events failed:', e); setError(e?.message ?? 'Не удалось загрузить события'); return [] as EventItem[]; });

      const bookingFetch = userRole === 'tutor' ? authedFetch(endpoints.tutorBookings) : authedFetch(endpoints.studentBookings);
      const [eventsRes, bookingsRes] = await Promise.allSettled([eventsPromise, bookingFetch]);

      const mergedBookings: BookingItem[] = [];
      const seenIds = new Set<string>();

      if (eventsRes.status === 'fulfilled') {
        const allItems = eventsRes.value;
        setEvents(allItems.filter((e) => e.type !== 'session_based'));
        const sessionRole = (userRole === 'tutor' ? 'tutor' : 'student') as 'student' | 'tutor';
        for (const e of allItems.filter((it) => it.type === 'session_based')) {
          const eid = String(e.id ?? '');
          if (seenIds.has(eid)) continue;
          seenIds.add(eid);
          const ta = e.teacher as Record<string, unknown> | null | undefined;
          mergedBookings.push({
            id: eid, date: e.start_at?.split('T')[0], time: e.start_at?.split('T')[1]?.slice(0, 5),
            scheduled_at: e.start_at, status: e.status, price: e.price,
            tutor: ta ? { id: String(ta.id ?? ''), name: (ta.name ?? ta.fullName ?? ta.full_name ?? '') as string } : undefined,
            _viewerRole: sessionRole,
          });
        }
      } else {
        setEvents([]);
      }

      if (bookingsRes.status === 'fulfilled' && bookingsRes.value.ok) {
        const data = await bookingsRes.value.json().catch(() => null);
        const rawList: any[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.data) ? data.data : [];
        for (const b of rawList) {
          const id = String(b.id ?? '');
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          const viewerRole = (b.my_role === 'student' || b.my_role === 'tutor') ? b.my_role : (userRole === 'tutor' ? 'tutor' : 'student');
          mergedBookings.push({ ...b, videoUrl: b.videoUrl ?? b.video_url, _viewerRole: viewerRole });
        }
      }
      setBookings(mergedBookings);
    } catch (e: any) {
      if (isAuthError(e)) { router.replace('/login' as any); return; }
      setEvents([]); setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function performCancelEvent(id: string): Promise<boolean> {
    const attempts = role === 'tutor'
      ? [() => authedFetch(`${endpoints.events}/${id}`, { method: 'DELETE' })]
      : [() => authedFetch(`${endpoints.events}/${id}/registration`, { method: 'DELETE' }), () => authedFetch(`${endpoints.events}/${id}/unregister`, { method: 'POST' })];
    let res = await attempts[0]();
    for (const attempt of attempts.slice(1)) {
      if (res.status !== 404 && res.status !== 405) break;
      res = await attempt();
    }
    if (res.ok || res.status === 404) { setEvents((prev) => prev.filter((e) => e.id !== id)); return true; }
    return false;
  }

  async function performCancelBooking(booking: BookingItem): Promise<boolean> {
    const viewerRole = booking._viewerRole ?? role;
    const url = viewerRole === 'tutor' ? `${endpoints.tutorBookings}/${booking.id}` : `${endpoints.studentBookings}/${booking.id}`;
    const res = await authedFetch(url, { method: 'DELETE' });
    if (res.ok || res.status === 404) { setBookings((prev) => prev.filter((b) => b.id !== booking.id)); return true; }
    return false;
  }

  function openCancelModal(target: CancelTarget) {
    setOpenMenuId(null);
    setCancelTarget(target);
    setCancelPhase('confirm');
  }

  function closeCancelModal() {
    setCancelTarget(null);
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const ok = cancelTarget.kind === 'event' ? await performCancelEvent(cancelTarget.item.id) : await performCancelBooking(cancelTarget.item);
      if (ok) setCancelPhase('success');
    } catch { /* ignore — modal stays on confirm step, user can retry */ }
    finally { setCancelling(false); }
  }

  async function joinBooking(booking: BookingItem, title: string) {
    const viewerRole = booking._viewerRole ?? role;
    if (booking.videoUrl) { openJitsi(booking.videoUrl, { title }); return; }
    const res = await authedFetch(`${API_BASE}/api/${viewerRole}/bookings/${booking.id}/join`).catch(() => null);
    const url = res?.ok ? (await res.json().catch(() => ({}))).join_url ?? null : null;
    openJitsi(url ?? buildJitsiUrl('booking', booking.id), { title });
  }

  async function openEditEvent(item: EventItem) {
    setOpenMenuId(null);
    setEditEventItem(item);
    setEditTitle(item.title ?? '');
    setEditDescription('');
    const dt = item.datetimeStart ? new Date(item.datetimeStart) : null;
    setEditDate(dt && !isNaN(dt.getTime()) ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` : '');
    setEditTime(dt && !isNaN(dt.getTime()) ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '');
    setEditPrice(item.price != null ? String(item.price) : '');
    setEditMax('');
    setEditCoverUri(null);
    setEditError('');

    // /api/events/my не отдаёт description/max_participants — подгружаем
    // полную карточку события, чтобы поля модалки были предзаполнены (см. макет).
    try {
      const token = await getAuthToken();
      const res = await fetch(`${endpoints.events}/${item.id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      if (res.ok) {
        const data = await res.json();
        const r = (data?.data ?? data) as Record<string, unknown>;
        if (typeof r.description === 'string') setEditDescription(r.description);
        const maxParticipants = r.max_participants ?? r.maxParticipants;
        if (typeof maxParticipants === 'number') setEditMax(String(maxParticipants));
      }
    } catch { /* модалка остаётся с уже заполненными название/датой/ценой */ }
  }

  async function handlePickEditCover() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setEditCoverUri(result.assets[0].uri);
  }

  async function handleSaveEditEvent() {
    if (!editEventItem) return;
    setEditSaving(true);
    setEditError('');
    try {
      let coverUrl: string | undefined;
      if (editCoverUri) coverUrl = await uploadEventImage(editCoverUri);
      const body: EventPatchBody = {};
      if (editTitle.trim()) body.title = editTitle.trim();
      if (editDescription.trim()) body.description = editDescription.trim();
      const dt = combineDatetime(editDate, editTime);
      if (dt) body.datetime_start = dt;
      if (editPrice) body.price = Number(editPrice);
      if (editMax) body.max_participants = Number(editMax);
      if (coverUrl) body.coverUrl = coverUrl;
      await updateEvent(editEventItem.id, body);
      setEditEventItem(null);
      load();
    } catch (e: any) {
      setEditError(e?.message ?? 'Не удалось сохранить изменения');
    } finally {
      setEditSaving(false);
    }
  }

  const now = Date.now();
  const getEventMs = (e: EventItem) => (e.datetimeStart ? new Date(e.datetimeStart).getTime() : Infinity);
  const getBookingMs = (b: BookingItem) => {
    const d = b.date ?? b.slot_date ?? b.slot?.date ?? (b.scheduled_at ? b.scheduled_at.split('T')[0] : undefined);
    const t = b.time ?? b.slot_time ?? b.slot?.time ?? (b.scheduled_at ? b.scheduled_at.split('T')[1]?.slice(0, 5) : undefined);
    return d ? new Date(`${d}T${t ?? '00:00'}:00`).getTime() : Infinity;
  };

  const upcomingEvents = [...events].filter((e) => getEventMs(e) >= now).sort((a, b) => getEventMs(a) - getEventMs(b));
  const pastEvents = [...events].filter((e) => getEventMs(e) < now).sort((a, b) => getEventMs(b) - getEventMs(a));
  const upcomingBookings = [...bookings].filter((b) => getBookingMs(b) >= now).sort((a, b) => getBookingMs(a) - getBookingMs(b));
  const pastBookings = [...bookings].filter((b) => getBookingMs(b) < now).sort((a, b) => getBookingMs(b) - getBookingMs(a));

  const currentUpcoming = activeTab === 'events' ? upcomingEvents : upcomingBookings;
  const currentPast = activeTab === 'events' ? pastEvents : pastBookings;
  const isEmpty = currentUpcoming.length === 0 && currentPast.length === 0;

  // "Открыть видео" в шапке — ведёт на ближайшую предстоящую личную встречу, если она есть.
  const nextBooking = upcomingBookings[0];
  const nextBookingMs = nextBooking ? getBookingMs(nextBooking) : null;
  const meetingStarted = nextBookingMs != null && nextBookingMs <= now;

  function otherPartyOf(b: BookingItem) {
    const isViewerTutor = b._viewerRole === 'tutor';
    const obj = isViewerTutor ? b.student : (b.tutor ?? b.mentor);
    const fallbackId = isViewerTutor ? (b.studentId ?? b.student_id) : (b.tutorId ?? b.tutor_id);
    return {
      id: obj?.id ?? fallbackId,
      name: obj?.fullName ?? obj?.full_name ?? obj?.name ?? (isViewerTutor ? 'Ученик' : 'Наставник'),
      avatarUrl: obj?.avatarUrl ?? obj?.avatar_url ?? null,
      isViewerTutor,
    };
  }

  // Наставник пишет ученику (пока нет отдельной публичной страницы профиля
  // ученика — тот же адрес, что и в нативном приложении), студент — наставнику.
  function bookingProfileRoute(b: BookingItem): string | null {
    const other = otherPartyOf(b);
    if (!other.id) return null;
    return other.isViewerTutor ? `/(tabs)/profile/student/${other.id}` : `/(tabs)/explore/${other.id}`;
  }

  function CardMenu({ id, options }: { id: string; options: MenuOption[] }) {
    return (
      <View style={styles.menuButtonWrap}>
        <Pressable style={styles.menuButton} onPress={() => setOpenMenuId((cur) => (cur === id ? null : id))}>
          <Text style={styles.menuButtonText}>•••</Text>
        </Pressable>
        {openMenuId === id ? (
          <View style={styles.menuDropdown}>
            {options.map((opt, i) => (
              <Pressable
                key={opt.label}
                style={[styles.menuItem, i > 0 && styles.menuItemBordered]}
                onPress={() => { setOpenMenuId(null); opt.onPress(); }}
              >
                <Text style={[styles.menuItemText, opt.danger && styles.menuItemTextDanger]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  function renderEventCard(item: EventItem, muted = false) {
    const isOwner = role === 'tutor';
    const options: MenuOption[] = isOwner
      ? [
          { label: 'Настройки', onPress: () => openEditEvent(item) },
          { label: 'Отменить событие', danger: true, onPress: () => openCancelModal({ kind: 'event', item }) },
        ]
      : [
          { label: 'Отменить запись', danger: true, onPress: () => openCancelModal({ kind: 'event', item }) },
        ];
    const dateText = item.datetimeStart ? formatDatetime(item.datetimeStart) : '';

    if (isMobile) {
      return (
        <View key={item.id} style={styles.listRow}>
          <Pressable style={styles.listRowMain} onPress={() => router.push(`/(tabs)/events/${item.id}` as any)}>
            {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.listThumb} resizeMode="cover" /> : <View style={[styles.listThumb, styles.cardImagePlaceholder]} />}
            <View style={styles.listBody}>
              <Text style={[styles.listLabel, muted && styles.textMuted]}>Событие</Text>
              <Text style={[styles.listTitle, muted && styles.textMuted]} numberOfLines={2}>{item.title}</Text>
              {dateText ? <Text style={[styles.listDate, muted && styles.textMuted]}>{dateText}</Text> : null}
            </View>
          </Pressable>
          <CardMenu id={`e-${item.id}`} options={options} />
        </View>
      );
    }

    return (
      <View key={item.id} style={[styles.card, muted && styles.cardMuted]}>
        <Pressable onPress={() => router.push(`/(tabs)/events/${item.id}` as any)}>
          {item.coverUrl ? (
            <Image source={{ uri: item.coverUrl }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
          )}
          <View style={styles.cardBody}>
            {item.registeredCount != null ? <Text style={styles.cardMeta}>Записалось: {item.registeredCount} чел.</Text> : null}
            <Text style={styles.cardTitle} numberOfLines={3}>{item.title}</Text>
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardMentorName}>{item.mentor?.name ?? ''}</Text>
              {dateText ? <Text style={styles.cardDateText}>{dateText}</Text> : null}
            </View>
          </View>
        </Pressable>
        <CardMenu id={`e-${item.id}`} options={options} />
      </View>
    );
  }

  function renderBookingCard(item: BookingItem, muted = false) {
    const other = otherPartyOf(item);
    const dateText = formatBookingDate(item.date ?? item.slot_date ?? item.slot?.date, item.time ?? item.slot_time ?? item.slot?.time);

    return (
      <Pressable key={item.id} style={[styles.card, isMobile && styles.cardMobile, muted && styles.cardMuted]} onPress={() => setViewingBooking(item)}>
        {other.avatarUrl ? <Image source={{ uri: other.avatarUrl }} style={styles.cardImage} resizeMode="cover" /> : <View style={[styles.cardImage, styles.cardImagePlaceholder]} />}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{other.name}</Text>
          <View style={styles.cardMetaRow}>
            <Text style={styles.cardMentorName}>Личная встреча</Text>
            {dateText ? <Text style={styles.cardDateText}>{dateText}</Text> : null}
          </View>
        </View>
      </Pressable>
    );
  }

  function renderBookingGroups(items: BookingItem[], muted = false) {
    if (items.length === 0) return null;
    if (role !== 'tutor') return <View style={styles.grid}>{items.map((b) => renderBookingCard(b, muted))}</View>;
    const asTutor = items.filter((b) => b._viewerRole === 'tutor');
    const asStudent = items.filter((b) => b._viewerRole === 'student');
    return (
      <>
        {asTutor.length > 0 && <><Text style={styles.groupHeader}>Мои студенты</Text><View style={styles.grid}>{asTutor.map((b) => renderBookingCard(b, muted))}</View></>}
        {asStudent.length > 0 && <><Text style={styles.groupHeader}>Мои наставники</Text><View style={styles.grid}>{asStudent.map((b) => renderBookingCard(b, muted))}</View></>}
      </>
    );
  }

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageContent}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Мои записи</Text>
          {nextBooking && !isMobile ? (
            <View style={styles.headerVideoBlock}>
              <Pressable style={styles.headerVideoButton} onPress={() => joinBooking(nextBooking, `Личная встреча с ${otherPartyOf(nextBooking).name}`)}>
                <Text style={styles.headerVideoButtonText}>Открыть видео</Text>
              </Pressable>
              <Text style={styles.headerCountdownText}>
                {meetingStarted ? 'Встреча уже идёт, присоединяйся!' : `До ближайшего события:\n${formatCountdown(nextBookingMs!)}`}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.tabsRow}>
          <Pressable onPress={() => setActiveTab('events')}><Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>События</Text></Pressable>
          <Pressable onPress={() => setActiveTab('meetings')}><Text style={[styles.tabText, activeTab === 'meetings' && styles.tabTextActive]}>Личные встречи</Text></Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#010101" /></View>
        ) : error && activeTab === 'events' && isEmpty ? (
          <Text style={styles.errorText}>Не удалось загрузить события: {error}</Text>
        ) : isEmpty ? (
          // Modal (не обычный View с flex:1) — гарантированно перекрывает всю
          // страницу независимо от окружающего flex-контекста, см. cookie-banner.
          <Modal transparent animationType="fade" visible onRequestClose={() => router.push('/events' as any)}>
            <View style={styles.emptyOverlay}>
              <View style={styles.emptyCard}>
                <View style={styles.emptyHeaderRow}>
                  <Text style={styles.emptyTitle}>У вас еще нет ни одной записи</Text>
                  <Pressable onPress={() => router.push('/events' as any)}><Text style={styles.emptyClose}>✕</Text></Pressable>
                </View>
                <Text style={styles.emptyText}>Зарегистрируйтесь на событие или подберите себе наставника, и здесь появится кнопка для подключения</Text>
                <Pressable onPress={() => router.push('/events' as any)}>
                  <Text style={styles.emptyLink}>Посмотреть события</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        ) : (
          <>
            {activeTab === 'events' ? (
              upcomingEvents.length > 0 && <View style={isMobile ? styles.list : styles.grid}>{upcomingEvents.map((e) => renderEventCard(e))}</View>
            ) : (
              renderBookingGroups(upcomingBookings)
            )}

            {nextBooking && isMobile ? (
              <View style={styles.mobileVideoBar}>
                <View style={styles.mobileVideoBarTextRow}>
                  <Text style={styles.mobileVideoBarIcon}>🎥</Text>
                  <Text style={styles.mobileVideoBarText}>
                    {meetingStarted ? 'Встреча уже идёт, присоединяйся!' : `До ближайшего события: ${formatCountdown(nextBookingMs!)}`}
                  </Text>
                </View>
                <Pressable style={styles.mobileVideoBarButton} onPress={() => joinBooking(nextBooking, `Личная встреча с ${otherPartyOf(nextBooking).name}`)}>
                  <Text style={styles.mobileVideoBarButtonText}>Открыть видео</Text>
                </Pressable>
              </View>
            ) : null}

            {currentPast.length > 0 ? (
              <Text style={styles.pastSeparator}>{activeTab === 'events' ? 'Прошедшие события' : 'Прошедшие встречи'}</Text>
            ) : null}
            {activeTab === 'events' ? (
              pastEvents.length > 0 && <View style={isMobile ? styles.list : styles.grid}>{pastEvents.map((e) => renderEventCard(e, true))}</View>
            ) : (
              renderBookingGroups(pastBookings, true)
            )}
          </>
        )}
      </View>

        <SiteFooter />
      </ScrollView>

      {/* ─── Подтверждение отмены записи ───────────────────────────────── */}
      <Modal transparent animationType="fade" visible={!!cancelTarget} onRequestClose={closeCancelModal}>
        <View style={styles.overlay}>
          <Pressable style={styles.overlayClose} onPress={closeCancelModal}><Text style={styles.overlayCloseText}>✕</Text></Pressable>
          <View style={styles.confirmCard}>
            {cancelPhase === 'confirm' ? (
              <>
                <Text style={styles.confirmTitle}>Вы действительно хотите отменить запись?</Text>
                <Text style={styles.confirmText}>Вы отменяете запись позднее, чем за 24 часа. Вернуть деньги за нее уже не получится.</Text>
                <Pressable style={styles.confirmBtnOutline} onPress={closeCancelModal}>
                  <Text style={styles.confirmBtnOutlineText}>Оставить</Text>
                </Pressable>
                <Pressable style={styles.confirmBtnDanger} onPress={handleConfirmCancel} disabled={cancelling}>
                  <Text style={styles.confirmBtnDangerText}>{cancelling ? 'Отменяем…' : 'Отменить запись'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.confirmTitle}>Запись отменена</Text>
                <Text style={styles.confirmText}>Деньги вернутся на карту в течение 3 рабочих дней или даже быстрее</Text>
                <Pressable style={styles.confirmBtnDark} onPress={closeCancelModal}>
                  <Text style={styles.confirmBtnDarkText}>Закрыть</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── Изменение события (только для наставника, его карточки) ──────── */}
      <Modal transparent animationType="fade" visible={!!editEventItem} onRequestClose={() => setEditEventItem(null)}>
        <Pressable style={styles.overlay} onPress={() => setEditEventItem(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Изменение события</Text>
              <Pressable onPress={() => setEditEventItem(null)}><Text style={styles.modalClose}>✕</Text></Pressable>
            </View>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.fieldLabel}>Название</Text>
              <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} />
              <Text style={styles.fieldLabel}>Описание</Text>
              <TextInput style={[styles.input, styles.inputMultiline]} value={editDescription} onChangeText={setEditDescription} multiline placeholder="Оставьте пустым, чтобы не менять" />
              <Text style={styles.fieldLabel}>Дата</Text>
              <TextInput style={styles.input} value={editDate} onChangeText={setEditDate} placeholder="ГГГГ-ММ-ДД" placeholderTextColor="#9B9B9B" />
              <Text style={styles.fieldLabel}>Время</Text>
              <TextInput style={styles.input} value={editTime} onChangeText={setEditTime} placeholder="ЧЧ:ММ" placeholderTextColor="#9B9B9B" />
              <View style={styles.priceLabelRow}>
                <Text style={styles.fieldLabel}>Стоимость</Text>
                {Number(editPrice) > 0 ? <Text style={styles.commissionHint}>Комиссия 10% — вы получите {Math.round(Number(editPrice) * 0.9)} ₽</Text> : null}
              </View>
              <TextInput style={styles.input} value={editPrice} onChangeText={setEditPrice} keyboardType="numeric" />
              <Text style={styles.fieldLabel}>Максимальное количество участников</Text>
              <TextInput style={styles.input} value={editMax} onChangeText={setEditMax} keyboardType="numeric" placeholder="Оставьте пустым, чтобы не менять" />
              <Pressable style={styles.uploadRow} onPress={handlePickEditCover}>
                {(editCoverUri || editEventItem?.coverUrl) ? (
                  <Image source={{ uri: editCoverUri ?? editEventItem?.coverUrl ?? '' }} style={styles.uploadThumb} />
                ) : null}
                <Text style={styles.uploadButtonText}>Заменить обложку</Text>
              </Pressable>
              {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
            </ScrollView>
            <View style={styles.modalFooterRow}>
              <Pressable onPress={() => setEditEventItem(null)}><Text style={styles.modalCancelText}>Отменить</Text></Pressable>
              <Pressable onPress={handleSaveEditEvent} disabled={editSaving}>
                <Text style={styles.modalSaveText}>{editSaving ? 'Сохраняем…' : 'Сохранить'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Карточка личной встречи (по клику на карточку) ────────────────── */}
      <Modal transparent animationType="fade" visible={!!viewingBooking} onRequestClose={() => setViewingBooking(null)}>
        <Pressable style={styles.overlay} onPress={() => setViewingBooking(null)}>
          <Pressable style={styles.bookingModalCard} onPress={() => {}}>
            {viewingBooking ? (() => {
              const other = otherPartyOf(viewingBooking);
              const dateText = formatBookingDate(
                viewingBooking.date ?? viewingBooking.slot_date ?? viewingBooking.slot?.date,
                viewingBooking.time ?? viewingBooking.slot_time ?? viewingBooking.slot?.time,
              );
              const profileRoute = bookingProfileRoute(viewingBooking);
              return (
                <>
                  <View style={styles.modalHeaderRow}>
                    <Text style={styles.modalTitle}>{other.name}</Text>
                    <Pressable onPress={() => setViewingBooking(null)}><Text style={styles.modalClose}>✕</Text></Pressable>
                  </View>
                  <Text style={styles.bookingModalMeta}>Личная встреча</Text>
                  {dateText ? <Text style={styles.bookingModalDate}>{dateText}</Text> : null}
                  <View style={styles.modalFooterRow}>
                    <Pressable
                      onPress={() => {
                        setViewingBooking(null);
                        if (profileRoute) router.push(profileRoute as any);
                      }}
                    >
                      <Text style={styles.modalCancelText}>{other.isViewerTutor ? 'Написать ученику' : 'Написать наставнику'}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        const b = viewingBooking;
                        setViewingBooking(null);
                        openCancelModal({ kind: 'booking', item: b });
                      }}
                    >
                      <Text style={styles.modalSaveText}>{other.isViewerTutor ? 'Отменить встречу' : 'Отменить запись'}</Text>
                    </Pressable>
                  </View>
                </>
              );
            })() : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 24, paddingBottom: 48 },
  pageContent: { paddingHorizontal: 32 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101' },
  headerVideoBlock: { alignItems: 'flex-end' },
  headerVideoButton: { backgroundColor: '#010101', paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  headerVideoButtonText: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 14, color: '#fff' },
  headerCountdownText: { fontFamily: 'Gramatika-Regular', fontSize: 12, lineHeight: 16, color: '#687076', textAlign: 'right' },
  tabsRow: { flexDirection: 'row', gap: 24, marginBottom: 24 },
  tabText: { fontFamily: 'Gramatika-Regular', fontSize: 30, lineHeight: 27, color: '#838383' },
  tabTextActive: { color: '#010101', fontFamily: 'Gramatika-Regular', fontWeight: 'bold' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#E02D2D' },
  emptyOverlay: { flex: 1, backgroundColor: '#BEBEBE', alignItems: 'center', justifyContent: 'center', padding: 16 },
  emptyCard: { backgroundColor: '#fff', padding: 24, width: '100%', maxWidth: 680 },
  emptyHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  emptyTitle: { fontSize: 25, lineHeight: 23, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101', flex: 1 },
  emptyClose: { fontSize: 18, color: '#010101' },
  emptyText: { fontSize: 14, lineHeight: 20, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 20, maxWidth: 480 },
  emptyLink: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 14, color: '#E02D2D', alignSelf: 'flex-end' },
  groupHeader: { fontSize: 16, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101', marginTop: 8, marginBottom: 12 },
  pastSeparator: { fontSize: 25, lineHeight: 23, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101', marginTop: 32, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  list: { gap: 20, marginBottom: 24 },
  card: { flexBasis: 280, flexGrow: 1, minWidth: 240, maxWidth: 360, backgroundColor: '#fff', position: 'relative' },
  // Личные встречи остаются карточками (не строками списка) и на мобильном —
  // здесь у карточки нет минимальной ширины по умолчанию, поэтому переопределяем.
  cardMobile: { flexBasis: '47%', minWidth: 0, maxWidth: '48%' },
  cardMuted: { opacity: 0.45 },
  cardImage: { width: '100%', height: 180 },
  cardImagePlaceholder: { backgroundColor: '#E5E5E5' },
  cardBody: { paddingTop: 14 },
  cardMeta: { fontSize: 12, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 6 },
  cardTitle: { fontSize: 25, lineHeight: 23, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101', marginBottom: 8 },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  cardMentorName: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#687076' },
  cardDateText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#687076' },

  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, position: 'relative' },
  listRowMain: { flexDirection: 'row', flex: 1, gap: 12 },
  listThumb: { width: 72, height: 72, backgroundColor: '#E5E5E5' },
  listBody: { flex: 1, minHeight: 72, justifyContent: 'space-between' },
  listLabel: { fontSize: 12, fontFamily: 'Gramatika-Regular', color: '#687076' },
  listTitle: { fontSize: 14, lineHeight: 19, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101' },
  listDate: { fontSize: 12, fontFamily: 'Gramatika-Regular', color: '#687076', alignSelf: 'flex-end' },
  textMuted: { opacity: 0.45 },

  menuButtonWrap: { position: 'absolute', top: 8, right: 8, zIndex: 5 },
  menuButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  menuButtonText: { fontSize: 16, color: '#010101', fontFamily: 'Gramatika-Regular', fontWeight: 'bold', letterSpacing: 1, marginTop: -8 },
  menuDropdown: { position: 'absolute', top: 32, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#1E1E1E', minWidth: 190, zIndex: 6 },
  menuItem: { paddingVertical: 12, paddingHorizontal: 14 },
  menuItemBordered: { borderTopWidth: 1, borderTopColor: '#1E1E1E' },
  menuItemText: { fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#010101' },
  menuItemTextDanger: { color: '#E02D2D' },

  mobileVideoBar: { backgroundColor: '#010101', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, paddingHorizontal: 16, marginTop: 8, marginBottom: 24 },
  mobileVideoBarTextRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  mobileVideoBarIcon: { fontSize: 14 },
  mobileVideoBarText: { flex: 1, fontFamily: 'Gramatika-Regular', fontSize: 12, lineHeight: 16, color: '#fff' },
  mobileVideoBarButton: { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 16 },
  mobileVideoBarButtonText: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 13, color: '#010101' },

  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 },
  overlayClose: { position: 'absolute', top: 24, right: 24 },
  overlayCloseText: { fontSize: 20, color: '#fff' },

  confirmCard: { width: '100%', maxWidth: 360, backgroundColor: '#fff', padding: 24 },
  confirmTitle: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 25, lineHeight: 28, color: '#010101', textTransform: 'uppercase', marginBottom: 12 },
  confirmText: { fontFamily: 'Gramatika-Regular', fontSize: 13, lineHeight: 18, color: '#687076', marginBottom: 24 },
  confirmBtnOutline: { borderWidth: 1, borderColor: '#1E1E1E', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  confirmBtnOutlineText: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 14, color: '#010101' },
  confirmBtnDanger: { backgroundColor: '#E02D2D', paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  confirmBtnDangerText: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 14, color: '#fff' },
  confirmBtnDark: { backgroundColor: '#010101', paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  confirmBtnDarkText: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 14, color: '#fff' },

  modalCard: { width: '100%', maxWidth: 520, maxHeight: '85%', backgroundColor: '#fff', padding: 24 },
  bookingModalCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', padding: 24 },
  bookingModalMeta: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#687076', marginTop: 4 },
  bookingModalDate: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#687076' },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 25, lineHeight: 23, color: '#010101' },
  modalClose: { fontSize: 20, color: '#010101' },
  modalScroll: { flexGrow: 0 },
  fieldLabel: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#010101', marginBottom: 6 },
  priceLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  commissionHint: { fontFamily: 'Gramatika-Regular', fontSize: 11, lineHeight: 14, color: '#687076', textAlign: 'right', maxWidth: 180 },
  input: { borderWidth: 1, borderColor: '#010101', paddingVertical: 12, paddingHorizontal: 12, marginBottom: 16, fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#010101' },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  uploadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#010101', paddingVertical: 12, paddingHorizontal: 12, marginBottom: 12 },
  uploadThumb: { width: 32, height: 32, backgroundColor: '#f0f0f0' },
  uploadButtonText: { fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#010101' },
  modalFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  modalCancelText: { fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#687076' },
  modalSaveText: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 15, color: '#E02D2D' },
});
