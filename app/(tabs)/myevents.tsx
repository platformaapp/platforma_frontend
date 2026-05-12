import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { endpoints, API_BASE } from '@/constants/env';
import { AuthError } from '@/lib/api/auth-error';
import { getMyEventsForStudent, teacherName, type MyEventItem } from '@/lib/api/student-events';
import { authedFetch } from '@/lib/authed-fetch';
import { getAuthToken, getAuthRole, getUserProfile } from '@/lib/auth';
import { buildJitsiUrl, openJitsi } from '@/lib/jitsi';

// ─── Types ───────────────────────────────────────────────────────────────────

type EventItem = MyEventItem & {
  datetimeStart?: string;
  mentor?: { id: string; name: string; avatarUrl?: string | null };
  registeredCount?: number;
};

type BookingItem = {
  id: string;
  slotId?: string;
  tutorId?: string;
  tutor?: { id?: string; name?: string; fullName?: string; avatarUrl?: string };
  student?: { id?: string; name?: string; fullName?: string; avatarUrl?: string };
  date?: string;
  time?: string;
  status?: string;
  createdAt?: string;
  videoUrl?: string;
};

type Tab = 'events' | 'meetings';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS_GEN = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];

function formatDatetime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTHS_GEN[d.getMonth()];
    const weekday = d.toLocaleString('ru-RU', { weekday: 'short' }).toUpperCase();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${weekday} ${hh}:${mm}`;
  } catch {
    return iso ?? '';
  }
}

function formatMenuDatetime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const weekday = d.toLocaleString('ru-RU', { weekday: 'short' }).toUpperCase();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}  ${weekday}  ${hh}:${mm}`;
  } catch {
    return iso ?? '';
  }
}

function formatBookingDate(date?: string, time?: string): string {
  const parts: string[] = [];
  if (date) parts.push(date);
  if (time) parts.push(time);
  return parts.join(' ');
}

function isAuthError(e: unknown): boolean {
  if (!e) return false;
  if (e instanceof AuthError) return true;
  const err = e as any;
  if (err?.name === 'AuthError') return true;
  const msg: string = (err?.message ?? '').toLowerCase();
  return (
    msg.includes('token expired') ||
    msg.includes('refresh failed') ||
    msg.includes('требуется авторизация') ||
    msg.includes('session not found') ||
    msg.includes('unauthorized') ||
    msg.includes('not authenticated')
  );
}

function translateEventStatus(status?: string, paymentStatus?: string): string {
  // Если payment_status === paid — событие оплачено, независимо от status
  if (paymentStatus?.toLowerCase() === 'paid') return 'Оплачено';
  if (!status) return '';
  const map: Record<string, string> = {
    scheduled: 'Запланировано',
    pending: 'Ожидает оплаты',
    confirmed: 'Подтверждено',
    active: 'Активно',
    registered: 'Зарегистрировано',
    cancelled: 'Отменено',
    canceled: 'Отменено',
    completed: 'Завершено',
    paid: 'Оплачено',
    attended: 'Посещено',
  };
  return map[status.toLowerCase()] ?? status;
}

function translateStatus(s: string): string {
  const map: Record<string, string> = {
    pending: 'Забронировано', confirmed: 'Подтверждено',
    cancelled: 'Отменено', completed: 'Завершено', booked: 'Забронировано',
  };
  return map[s.toLowerCase()] ?? s;
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function timeRemainingLabel(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return '';
  const totalMins = Math.floor(diff / 60000);
  const hours = Math.floor(totalMins / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `До встречи ${days} ${pluralRu(days, 'день', 'дня', 'дней')}`;
  if (hours >= 1) return `До встречи ${hours} ${pluralRu(hours, 'час', 'часа', 'часов')}`;
  if (totalMins >= 1) return `До встречи ${totalMins} ${pluralRu(totalMins, 'минута', 'минуты', 'минут')}`;
  return '';
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function MyEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Event menu
  const [menuEvent, setMenuEvent] = useState<EventItem | null>(null);
  const [cancelEventTarget, setCancelEventTarget] = useState<EventItem | null>(null);
  const [cancelEventConfirmVisible, setCancelEventConfirmVisible] = useState(false);
  const [cancelEventSuccessVisible, setCancelEventSuccessVisible] = useState(false);
  const [isCancellingEvent, setIsCancellingEvent] = useState(false);

  // Booking menu
  const [menuBooking, setMenuBooking] = useState<BookingItem | null>(null);
  const [cancelBookingTarget, setCancelBookingTarget] = useState<BookingItem | null>(null);
  const [cancelBookingConfirmVisible, setCancelBookingConfirmVisible] = useState(false);
  const [cancelBookingSuccessVisible, setCancelBookingSuccessVisible] = useState(false);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);

  const load = useCallback(async () => {
    try {
      const [token, userRole, profile] = await Promise.all([getAuthToken(), getAuthRole(), getUserProfile().catch(() => null)]);
      if (!token) { setLoading(false); setRefreshing(false); return; }
      setRole(userRole);
      if (profile?.id) setCurrentUserId(profile.id);
      // Events: use /api/events/my with matching role for both tutor and student
      const eventsPromise = getMyEventsForStudent({ role: userRole as 'student' | 'tutor', filter: 'all', time: 'all', page: 1, per_page: 50 })
        .then(({ items }) => items.map((it) => {
          const ta = it.teacher as Record<string, unknown> | null | undefined;
          const rawAv = ta?.avatarUrl ?? ta?.avatar_url;
          const mentorAvatar = rawAv && typeof rawAv === 'string'
            ? (rawAv.startsWith('http') ? rawAv : `${API_BASE}${rawAv}`)
            : null;
          return {
            ...it,
            datetimeStart: it.start_at ?? it.startAt,
            mentor: { id: String(ta?.id ?? ''), name: teacherName(it.teacher), avatarUrl: mentorAvatar },
          } as EventItem;
        }))
        .catch(() => [] as EventItem[]);

      const bookingsUrl = userRole === 'tutor' ? endpoints.tutorBookings : endpoints.studentBookings;

      const [eventsRes, bookRes] = await Promise.allSettled([
        eventsPromise,
        authedFetch(bookingsUrl),
      ]);

      if (eventsRes.status === 'fulfilled') {
        setEvents(eventsRes.value);
      } else {
        setEvents([]);
      }

      if (bookRes.status === 'fulfilled' && bookRes.value.ok) {
        const data = await bookRes.value.json();
        const rawList: any[] = Array.isArray(data) ? data : [];
        setBookings(rawList.map((b) => ({
          ...b,
          videoUrl: b.videoUrl ?? b.video_url ?? b.meetingUrl ?? b.meeting_url ?? undefined,
        } as BookingItem)));
      } else {
        setBookings([]);
      }
    } catch (e: any) {
      if (isAuthError(e)) { router.replace('/login'); return; }
      setEvents([]); setBookings([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  // ─── Event cancel (student cancels registration / tutor cancels event) ────

  const handleCancelEvent = () => {
    if (!menuEvent) return;
    setCancelEventTarget(menuEvent);
    setMenuEvent(null);
    setCancelEventConfirmVisible(true);
  };

  const confirmCancelEvent = async () => {
    if (!cancelEventTarget) return;
    const eventId = cancelEventTarget.id;
    setCancelEventConfirmVisible(false);
    setIsCancellingEvent(true);
    try {
      let res: Response;
      const attempts = role === 'tutor' ? [
        () => authedFetch(`${endpoints.events}/${eventId}`, { method: 'DELETE' }),
        () => authedFetch(`${endpoints.events}/${eventId}/cancel`, { method: 'POST' }),
      ] : [
          () => authedFetch(`${endpoints.events}/${eventId}/registration`, { method: 'DELETE' }),
          () => authedFetch(`${endpoints.events}/${eventId}/cancel`, { method: 'POST' }),
          () => authedFetch(`${endpoints.studentBookings}/${eventId}`, { method: 'DELETE' }),
          () => authedFetch(`${endpoints.events}/${eventId}/unregister`, { method: 'POST' }),
        ];
      res = await attempts[0]();
      if (res.status === 404 || res.status === 405) {
        for (const attempt of attempts.slice(1)) {
          res = await attempt();
          if (res.status !== 404 && res.status !== 405) break;
        }
      }

      if (res.ok || res.status === 404) {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
        setCancelEventSuccessVisible(true);
      } else {
        const data = await res.json().catch(() => ({}));
        Alert.alert('Ошибка', data?.message ?? `Не удалось отменить (${res.status})`);
        setCancelEventTarget(null);
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось отменить');
      setCancelEventTarget(null);
    } finally {
      setIsCancellingEvent(false);
    }
  };

  // ─── Booking cancel ───────────────────────────────────────────────────────

  const handleCancelBooking = () => {
    if (!menuBooking) return;
    setCancelBookingTarget(menuBooking);
    setMenuBooking(null);
    setCancelBookingConfirmVisible(true);
  };

  const confirmCancelBooking = async () => {
    if (!cancelBookingTarget) return;
    const bookingId = cancelBookingTarget.id;
    setCancelBookingConfirmVisible(false);
    setIsCancellingBooking(true);
    try {
      const url = role === 'tutor'
        ? `${endpoints.tutorBookings}/${bookingId}`
        : `${endpoints.studentBookings}/${bookingId}`;
      const res = await authedFetch(url, { method: 'DELETE' });
      if (res.ok || res.status === 404) {
        setBookings((prev) => prev.filter((b) => b.id !== bookingId));
        setCancelBookingSuccessVisible(true);
      } else {
        const data = await res.json().catch(() => ({}));
        Alert.alert('Ошибка', data?.message ?? `Не удалось отменить (${res.status})`);
        setCancelBookingTarget(null);
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось отменить');
      setCancelBookingTarget(null);
    } finally {
      setIsCancellingBooking(false);
    }
  };

  // ─── Render event card ────────────────────────────────────────────────────

  const renderEventCard = (item: EventItem) => {
    const eventMs = item.datetimeStart ? new Date(item.datetimeStart).getTime() : null;
    const isPast = eventMs != null && eventMs < Date.now();
    const remainingLabel = !isPast && eventMs ? timeRemainingLabel(eventMs) : '';
    return (
      <View key={item.id} style={styles.card}>
        <Pressable style={styles.cardTop} onPress={() => router.push(`/(tabs)/events/${item.id}` as any)}>
          {item.coverUrl ? (
            <Image source={{ uri: item.coverUrl }} style={styles.cardImage} />
          ) : item.mentor?.avatarUrl ? (
            <Image source={{ uri: item.mentor.avatarUrl }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
          )}
          <View style={styles.cardTitleBox}>
            <Text style={styles.cardTitle} numberOfLines={3}>{item.title}</Text>
            {(item.status || item.paymentStatus) ? <Text style={styles.eventStatus}>{translateEventStatus(item.status, item.paymentStatus)}</Text> : null}
            {role === 'tutor' && typeof item.registeredCount === 'number' ? (
              <Text style={styles.participantCount}>Записалось: {item.registeredCount} чел.</Text>
            ) : null}
          </View>
        </Pressable>
        <View style={styles.cardBottom}>
          <Text style={styles.cardAuthor} numberOfLines={1}>{item.mentor?.name ?? ''}</Text>
          <Text style={styles.cardDate}>{formatDatetime(item.datetimeStart)}</Text>
          {!isPast && (
            <Pressable style={styles.cardMenu} onPress={() => setMenuEvent(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.cardMenuText}>•••</Text>
            </Pressable>
          )}
        </View>
        {remainingLabel ? (
          <View style={styles.timeRemainingBadge}>
            <Text style={styles.timeRemainingText}>{remainingLabel}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  // ─── Render booking card ──────────────────────────────────────────────────

  const renderBookingCard = (item: BookingItem) => {
    const personName = role === 'tutor'
      ? (item.student?.fullName ?? item.student?.name ?? 'Ученик')
      : (item.tutor?.fullName ?? item.tutor?.name ?? 'Наставник');
    const avatarUrl = role === 'tutor' ? item.student?.avatarUrl : item.tutor?.avatarUrl;
    const profileId = role === 'tutor'
      ? (item.student?.id)
      : (item.tutor?.id ?? item.tutorId);
    const dateStr = formatBookingDate(item.date, item.time);
    const nowTs = Date.now();
    const meetingTs = item.date
      ? new Date(`${item.date}T${item.time ?? '23:59'}:00`).getTime()
      : null;
    const isPast = meetingTs != null ? meetingTs < nowTs : false;
    const FIFTEEN_MIN = 15 * 60 * 1000;
    const NINETY_MIN = 90 * 60 * 1000;
    const isNearlyStarting = meetingTs != null &&
      nowTs >= meetingTs - FIFTEEN_MIN &&
      nowTs <= meetingTs + NINETY_MIN;
    return (
      <View key={item.id} style={styles.card}>
        <Pressable
          style={styles.cardTop}
          onPress={() => profileId && router.push(`/(tabs)/explore/${profileId}` as any)}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.cardImage} />
          ) : (
            <Image source={require('@/assets/images/avatar.png')} style={styles.cardImage} />
          )}
          <View style={styles.cardTitleBox}>
            <Text style={styles.cardTitle}>Личная встреча</Text>
            {item.status ? <Text style={styles.bookingStatus}>{translateStatus(item.status)}</Text> : null}
          </View>
        </Pressable>
        <View style={styles.cardBottom}>
          <Text style={styles.cardAuthor} numberOfLines={1}>{personName}</Text>
          <Text style={styles.cardDate}>{dateStr}</Text>
          {!isPast && (
            <Pressable style={styles.cardMenu} onPress={() => setMenuBooking(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.cardMenuText}>•••</Text>
            </Pressable>
          )}
        </View>
        {!isPast && meetingTs && !isNearlyStarting ? (
          <View style={styles.timeRemainingBadge}>
            <Text style={styles.timeRemainingText}>{timeRemainingLabel(meetingTs)}</Text>
          </View>
        ) : null}
        {isNearlyStarting && (
          <Pressable
            style={styles.videoButton}
            onPress={() => openJitsi(item.videoUrl ?? buildJitsiUrl('booking', item.id))}
          >
            <Text style={styles.videoButtonText}>Открыть видео</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const now = Date.now();

  const getEventMs = (e: EventItem) =>
    e.datetimeStart ? new Date(e.datetimeStart).getTime() : Infinity;
  const getBookingMs = (b: BookingItem) =>
    b.date ? new Date(`${b.date}T${b.time ?? '00:00'}:00`).getTime() : Infinity;

  const upcomingEvents = [...events]
    .filter((e) => getEventMs(e) >= now)
    .sort((a, b) => getEventMs(a) - getEventMs(b));
  const pastEvents = [...events]
    .filter((e) => getEventMs(e) < now)
    .sort((a, b) => getEventMs(b) - getEventMs(a));

  const upcomingBookings = [...bookings]
    .filter((b) => getBookingMs(b) >= now)
    .sort((a, b) => getBookingMs(a) - getBookingMs(b));
  const pastBookings = [...bookings]
    .filter((b) => getBookingMs(b) < now)
    .sort((a, b) => getBookingMs(b) - getBookingMs(a));

  const currentUpcoming = activeTab === 'events' ? upcomingEvents : upcomingBookings;
  const currentPast = activeTab === 'events' ? pastEvents : pastBookings;
  const isEmpty = currentUpcoming.length === 0 && currentPast.length === 0;

  return (
    <View style={styles.container}>
      <Text style={[styles.screenTitle, { paddingTop: insets.top + 16 }]}>МОИ ЗАПИСИ</Text>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, activeTab === 'events' && styles.tabButtonActive]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>СОБЫТИЯ</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'meetings' && styles.tabButtonActive]}
          onPress={() => setActiveTab('meetings')}
        >
          <Text style={[styles.tabText, activeTab === 'meetings' && styles.tabTextActive]}>ЛИЧНЫЕ ВСТРЕЧИ</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'events'
            ? currentUpcoming.map(renderEventCard)
            : currentUpcoming.map(renderBookingCard)}
          {currentPast.length > 0 && (
            <>
              <View style={styles.pastSeparator}>
                <View style={styles.pastSeparatorLine} />
                <Text style={styles.pastSeparatorLabel}>ПРОШЕДШИЕ</Text>
                <View style={styles.pastSeparatorLine} />
              </View>
              {activeTab === 'events'
                ? currentPast.map((item) => (
                    <View key={`past-${(item as EventItem).id}`} style={styles.pastCardWrap}>
                      {renderEventCard(item as EventItem)}
                    </View>
                  ))
                : currentPast.map((item) => (
                    <View key={`past-${(item as BookingItem).id}`} style={styles.pastCardWrap}>
                      {renderBookingCard(item as BookingItem)}
                    </View>
                  ))}
            </>
          )}
        </ScrollView>
      )}

      {!loading && isEmpty && (
        <View style={[styles.emptySheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <Text style={styles.emptySheetTitle}>У вас еще нет ни одной записи</Text>
          <Text style={styles.emptySheetDescription}>
            Зарегистрируйтесь на событие или подберите себе наставника и здесь появится кнопка для подключения
          </Text>
          <Pressable style={styles.emptySheetButton} onPress={() => router.push('/(tabs)/events')}>
            <Text style={styles.emptySheetButtonText}>Посмотреть события</Text>
          </Pressable>
        </View>
      )}

      {/* ─── Event menu popup ────────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={menuEvent !== null} onRequestClose={() => setMenuEvent(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMenuEvent(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalEventCard}>
              <Text style={styles.modalEventTitle}>{menuEvent?.title}</Text>
              {menuEvent?.datetimeStart && (
                <Text style={styles.modalEventDate}>{formatMenuDatetime(menuEvent.datetimeStart)}</Text>
              )}
            </View>
            {role === 'tutor' ? (
              <>
                <Pressable
                  style={styles.modalActionButton}
                  onPress={() => {
                    const id = menuEvent?.id;
                    setMenuEvent(null);
                    if (id) router.push(`/(tabs)/profile/edit-event?id=${id}` as any);
                  }}
                >
                  <Text style={styles.modalActionButtonText}>Настройки</Text>
                </Pressable>
                <Pressable style={styles.modalCancelButton} onPress={handleCancelEvent}>
                  <Text style={styles.modalCancelButtonText}>Отменить событие</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  style={styles.modalActionButton}
                  onPress={() => {
                    const mentorId = menuEvent?.mentor?.id;
                    setMenuEvent(null);
                    if (mentorId) router.push(`/(tabs)/explore/${mentorId}` as any);
                  }}
                >
                  <Text style={styles.modalActionButtonText}>Написать наставнику</Text>
                </Pressable>
                {(!menuEvent?.datetimeStart || new Date(menuEvent.datetimeStart).getTime() > Date.now()) && (
                  <Pressable style={styles.modalCancelButton} onPress={handleCancelEvent} disabled={isCancellingEvent}>
                    <Text style={styles.modalCancelButtonText}>Отменить запись</Text>
                  </Pressable>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Booking menu popup ──────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={menuBooking !== null} onRequestClose={() => setMenuBooking(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMenuBooking(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalEventCard}>
              <Text style={styles.modalEventTitle}>
                {role === 'tutor'
                  ? (menuBooking?.student?.fullName ?? menuBooking?.student?.name ?? 'Ученик')
                  : (menuBooking?.tutor?.fullName ?? menuBooking?.tutor?.name ?? 'Наставник')}
              </Text>
              {menuBooking?.date && (
                <Text style={styles.modalEventDate}>{formatBookingDate(menuBooking.date, menuBooking.time)}</Text>
              )}
            </View>
            {(() => {
              // Determine if current user is the listener (student) in this booking.
              // A tutor can book as a student with another tutor — in that case show "Написать наставнику".
              const isListener = role !== 'tutor' ||
                (menuBooking?.student?.id != null && menuBooking.student.id === currentUserId);
              if (isListener) {
                return (
                  <>
                    <Pressable
                      style={styles.modalActionButton}
                      onPress={() => {
                        const tutorId = menuBooking?.tutor?.id ?? menuBooking?.tutorId;
                        setMenuBooking(null);
                        if (tutorId) router.push(`/(tabs)/explore/${tutorId}` as any);
                      }}
                    >
                      <Text style={styles.modalActionButtonText}>Написать наставнику</Text>
                    </Pressable>
                    <Pressable style={styles.modalCancelButton} onPress={handleCancelBooking} disabled={isCancellingBooking}>
                      <Text style={styles.modalCancelButtonText}>Отменить запись</Text>
                    </Pressable>
                  </>
                );
              }
              return (
                <>
                  <Pressable
                    style={styles.modalActionButton}
                    onPress={() => {
                      const studentId = menuBooking?.student?.id;
                      setMenuBooking(null);
                      if (studentId) router.push(`/(tabs)/explore/${studentId}` as any);
                    }}
                  >
                    <Text style={styles.modalActionButtonText}>Написать ученику</Text>
                  </Pressable>
                  <Pressable style={styles.modalCancelButton} onPress={handleCancelBooking} disabled={isCancellingBooking}>
                    <Text style={styles.modalCancelButtonText}>Отменить встречу</Text>
                  </Pressable>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Event cancel confirm ────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={cancelEventConfirmVisible}
        onRequestClose={() => { setCancelEventConfirmVisible(false); setCancelEventTarget(null); }}>
        <Pressable style={styles.modalOverlay} onPress={() => { setCancelEventConfirmVisible(false); setCancelEventTarget(null); }}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.cancelModalTitle}>
              {role === 'tutor' ? 'ВЫ ДЕЙСТВИТЕЛЬНО ХОТИТЕ ОТМЕНИТЬ СОБЫТИЕ?' : 'ВЫ ДЕЙСТВИТЕЛЬНО ХОТИТЕ ОТМЕНИТЬ ЗАПИСЬ?'}
            </Text>
            {cancelEventTarget?.datetimeStart && new Date(cancelEventTarget.datetimeStart).getTime() - Date.now() < 24 * 60 * 60 * 1000 ? (
              <Text style={styles.cancelModalWarning}>Вы отменяете позднее, чем за 24 часа. Вернуть деньги уже не получится.</Text>
            ) : (
              <Text style={styles.cancelModalSubtext}>После отмены вы потеряете место на этом мероприятии.</Text>
            )}
            <Pressable style={styles.cancelModalKeepButton} onPress={() => { setCancelEventConfirmVisible(false); setCancelEventTarget(null); }}>
              <Text style={styles.cancelModalKeepText}>Оставить</Text>
            </Pressable>
            <Pressable style={[styles.cancelModalConfirmButton, isCancellingEvent && styles.disabledButton]}
              onPress={confirmCancelEvent} disabled={isCancellingEvent}>
              <Text style={styles.cancelModalConfirmText}>{isCancellingEvent ? 'Отмена...' : (role === 'tutor' ? 'Отменить событие' : 'Отменить запись')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Event cancel success ────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={cancelEventSuccessVisible}
        onRequestClose={() => { setCancelEventSuccessVisible(false); setCancelEventTarget(null); }}>
        <Pressable style={styles.modalOverlay} onPress={() => { setCancelEventSuccessVisible(false); setCancelEventTarget(null); }}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.cancelModalTitle}>ЗАПИСЬ ОТМЕНЕНА</Text>
            {(!cancelEventTarget?.datetimeStart || new Date(cancelEventTarget.datetimeStart).getTime() - Date.now() >= 24 * 60 * 60 * 1000) && (
              <Text style={styles.cancelModalSubtext}>Деньги вернутся на карту в течении 3 рабочих дней</Text>
            )}
            <Pressable style={styles.cancelSuccessCloseButton} onPress={() => { setCancelEventSuccessVisible(false); setCancelEventTarget(null); }}>
              <Text style={styles.cancelSuccessCloseText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Booking cancel confirm ──────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={cancelBookingConfirmVisible}
        onRequestClose={() => { setCancelBookingConfirmVisible(false); setCancelBookingTarget(null); }}>
        <Pressable style={styles.modalOverlay} onPress={() => { setCancelBookingConfirmVisible(false); setCancelBookingTarget(null); }}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.cancelModalTitle}>
              {role === 'tutor' ? 'ОТМЕНИТЬ ВСТРЕЧУ?' : 'ОТМЕНИТЬ ЗАПИСЬ?'}
            </Text>
            <Text style={styles.cancelModalSubtext}>Это действие нельзя отменить.</Text>
            <Pressable style={styles.cancelModalKeepButton} onPress={() => { setCancelBookingConfirmVisible(false); setCancelBookingTarget(null); }}>
              <Text style={styles.cancelModalKeepText}>Оставить</Text>
            </Pressable>
            <Pressable style={[styles.cancelModalConfirmButton, isCancellingBooking && styles.disabledButton]}
              onPress={confirmCancelBooking} disabled={isCancellingBooking}>
              <Text style={styles.cancelModalConfirmText}>{isCancellingBooking ? 'Отмена...' : (role === 'tutor' ? 'Отменить встречу' : 'Отменить запись')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Booking cancel success ──────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={cancelBookingSuccessVisible}
        onRequestClose={() => { setCancelBookingSuccessVisible(false); setCancelBookingTarget(null); }}>
        <Pressable style={styles.modalOverlay} onPress={() => { setCancelBookingSuccessVisible(false); setCancelBookingTarget(null); }}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.cancelModalTitle}>{role === 'tutor' ? 'ВСТРЕЧА ОТМЕНЕНА' : 'ЗАПИСЬ ОТМЕНЕНА'}</Text>
            {(!cancelBookingTarget?.date || new Date(`${cancelBookingTarget.date}T${cancelBookingTarget.time ?? '23:59'}:00`).getTime() - Date.now() >= 24 * 60 * 60 * 1000) && (
              <Text style={styles.cancelModalSubtext}>Деньги вернутся на карту в течении 3 рабочих дней</Text>
            )}
            <Pressable style={styles.cancelSuccessCloseButton} onPress={() => { setCancelBookingSuccessVisible(false); setCancelBookingTarget(null); }}>
              <Text style={styles.cancelSuccessCloseText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  screenTitle: {
    paddingHorizontal: 16, paddingBottom: 12,
    fontSize: 20, lineHeight: 26, fontFamily: 'Inter-Regular', color: '#181818',
  },
  tabRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1E1E1E', marginBottom: 16 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabButtonActive: { backgroundColor: '#111' },
  tabText: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#181818', letterSpacing: 0.5 },
  tabTextActive: { color: '#FAFAFA' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { borderWidth: 1, borderColor: '#1E1E1E', marginBottom: 16 },
  cardTop: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#1E1E1E' },
  cardImage: { width: 96, height: 96 },
  cardImagePlaceholder: { backgroundColor: '#E5E5E5' },
  cardTitleBox: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  cardTitle: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  eventStatus: { marginTop: 4, fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  bookingStatus: { marginTop: 4, fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  cardAuthor: { flex: 1, paddingHorizontal: 12, fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  cardDate: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#181818', paddingRight: 4 },
  cardMenu: { width: 44, borderLeftWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  cardMenuText: { fontSize: 18, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptySheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#181818', paddingHorizontal: 16, paddingTop: 24 },
  emptySheetTitle: { fontSize: 22, lineHeight: 28, fontFamily: 'Inter-Regular', color: '#FFFFFF', marginBottom: 8 },
  emptySheetDescription: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: 'rgba(255,255,255,0.7)', marginBottom: 24 },
  emptySheetButton: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', height: 52, alignItems: 'center', justifyContent: 'center' },
  emptySheetButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#FFFFFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },
  modalEventCard: { borderWidth: 1, borderColor: '#1E1E1E', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, marginBottom: 0 },
  modalEventTitle: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#1E1E1E', marginBottom: 12 },
  modalEventDate: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#1E1E1E' },
  modalActionButton: { borderWidth: 1, borderColor: '#1E1E1E', height: 52, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: 0 },
  modalActionButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  modalCancelButton: { borderWidth: 1, borderColor: '#E02D2D', height: 52, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: 0 },
  modalCancelButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#E02D2D' },
  disabledButton: { opacity: 0.5 },
  cancelModalTitle: { fontSize: 22, lineHeight: 28, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818', textTransform: 'uppercase', letterSpacing: -0.5, marginBottom: 12 },
  cancelModalSubtext: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 20 },
  cancelModalWarning: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#E02D2D', marginBottom: 20 },
  cancelModalKeepButton: { height: 52, borderWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cancelModalKeepText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  cancelModalConfirmButton: { height: 52, backgroundColor: '#E02D2D', alignItems: 'center', justifyContent: 'center' },
  cancelModalConfirmText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#FFFFFF' },
  cancelSuccessCloseButton: { height: 52, borderWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  cancelSuccessCloseText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  pastSeparator: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 16 },
  pastSeparatorLine: { flex: 1, height: 1, backgroundColor: '#E5E5E5' },
  pastSeparatorLabel: { fontFamily: 'Inter-Regular', fontSize: 11, color: '#9B9B9B', letterSpacing: 1, marginHorizontal: 12 },
  pastCardWrap: { opacity: 0.55 },
  videoButton: { backgroundColor: '#E02D2D', height: 44, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderColor: '#1E1E1E' },
  videoButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#FFFFFF' },
  timeRemainingBadge: { borderTopWidth: 1, borderColor: '#1E1E1E', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F9F9F9' },
  timeRemainingText: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#181818' },
  participantCount: { marginTop: 4, fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
});
