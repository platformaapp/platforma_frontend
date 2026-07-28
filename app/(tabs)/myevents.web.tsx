import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteShell } from '@/components/web/site-shell';
import { API_BASE, endpoints } from '@/constants/env';
import { AuthError } from '@/lib/api/auth-error';
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
};

type Tab = 'events' | 'meetings';

const MONTHS_GEN = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

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

function formatPrice(price?: number): string | null {
  if (price == null) return null;
  return price === 0 ? 'Бесплатно' : `${price.toLocaleString('ru-RU')} ₽`;
}

function isAuthError(e: unknown): boolean {
  if (!e) return false;
  if (e instanceof AuthError) return true;
  const msg = ((e as any)?.message ?? '').toLowerCase();
  return msg.includes('token expired') || msg.includes('требуется авторизация') || msg.includes('unauthorized');
}

/**
 * Веб-версия "Мои записи". Упрощена по сравнению с нативным экраном:
 * отмена события/брони — через window.confirm вместо кастомных модалок,
 * без выпадающего меню "•••". Данные и группировка (роль наставника —
 * "Мои студенты"/"Мои наставники" через my_role) — те же, что в приложении.
 */
export default function MyEventsScreenWeb() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState('');

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

  async function cancelEvent(id: string) {
    const w = (globalThis as any).window;
    if (w && !w.confirm('Отменить регистрацию на событие?')) return;
    try {
      const attempts = role === 'tutor'
        ? [() => authedFetch(`${endpoints.events}/${id}`, { method: 'DELETE' })]
        : [() => authedFetch(`${endpoints.events}/${id}/registration`, { method: 'DELETE' }), () => authedFetch(`${endpoints.events}/${id}/unregister`, { method: 'POST' })];
      let res = await attempts[0]();
      for (const attempt of attempts.slice(1)) {
        if (res.status !== 404 && res.status !== 405) break;
        res = await attempt();
      }
      if (res.ok || res.status === 404) setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch { /* ignore — list stays as-is, user can retry */ }
  }

  async function cancelBooking(booking: BookingItem) {
    const w = (globalThis as any).window;
    if (w && !w.confirm('Отменить запись?')) return;
    const viewerRole = booking._viewerRole ?? role;
    try {
      const url = viewerRole === 'tutor' ? `${endpoints.tutorBookings}/${booking.id}` : `${endpoints.studentBookings}/${booking.id}`;
      const res = await authedFetch(url, { method: 'DELETE' });
      if (res.ok || res.status === 404) setBookings((prev) => prev.filter((b) => b.id !== booking.id));
    } catch { /* ignore */ }
  }

  async function joinBooking(booking: BookingItem, title: string) {
    const viewerRole = booking._viewerRole ?? role;
    if (booking.videoUrl) { openJitsi(booking.videoUrl, { title }); return; }
    const res = await authedFetch(`${API_BASE}/api/${viewerRole}/bookings/${booking.id}/join`).catch(() => null);
    const url = res?.ok ? (await res.json().catch(() => ({}))).join_url ?? null : null;
    openJitsi(url ?? buildJitsiUrl('booking', booking.id), { title });
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

  function otherPartyOf(b: BookingItem) {
    const isViewerTutor = b._viewerRole === 'tutor';
    const obj = isViewerTutor ? b.student : (b.tutor ?? b.mentor);
    return {
      name: obj?.fullName ?? obj?.full_name ?? obj?.name ?? (isViewerTutor ? 'Ученик' : 'Наставник'),
      avatarUrl: obj?.avatarUrl ?? obj?.avatar_url ?? null,
    };
  }

  function renderEventCard(item: EventItem) {
    return (
      <View key={item.id} style={styles.card}>
        <Pressable style={styles.cardTop} onPress={() => router.push(`/(tabs)/events/${item.id}` as any)}>
          {item.mentor?.avatarUrl ? <Image source={{ uri: item.mentor.avatarUrl }} style={styles.cardImage} /> : <View style={[styles.cardImage, styles.cardImagePlaceholder]} />}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.cardAuthor}>{item.mentor?.name ?? ''}</Text>
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardDate}>{formatDatetime(item.datetimeStart)}</Text>
              {formatPrice(item.price) ? <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text> : null}
            </View>
          </View>
        </Pressable>
        <Pressable style={styles.cancelLink} onPress={() => cancelEvent(item.id)}>
          <Text style={styles.cancelLinkText}>Отменить</Text>
        </Pressable>
      </View>
    );
  }

  function renderBookingCard(item: BookingItem) {
    const other = otherPartyOf(item);
    const title = `Личная встреча с ${other.name}`;
    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardTop}>
          {other.avatarUrl ? <Image source={{ uri: other.avatarUrl }} style={styles.cardImage} /> : <View style={[styles.cardImage, styles.cardImagePlaceholder]} />}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardDate}>{formatBookingDate(item.date ?? item.slot_date ?? item.slot?.date, item.time ?? item.slot_time ?? item.slot?.time)}</Text>
          </View>
        </View>
        <View style={styles.cardActionsRow}>
          <Pressable style={styles.joinButton} onPress={() => joinBooking(item, title)}>
            <Text style={styles.joinButtonText}>Подключиться к встрече</Text>
          </Pressable>
          <Pressable style={styles.cancelLink} onPress={() => cancelBooking(item)}>
            <Text style={styles.cancelLinkText}>Отменить</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderBookingGroups(items: BookingItem[]) {
    if (role !== 'tutor') return items.map(renderBookingCard);
    const asTutor = items.filter((b) => b._viewerRole === 'tutor');
    const asStudent = items.filter((b) => b._viewerRole === 'student');
    return (
      <>
        {asTutor.length > 0 && <><Text style={styles.groupHeader}>Мои студенты</Text>{asTutor.map(renderBookingCard)}</>}
        {asStudent.length > 0 && <><Text style={styles.groupHeader}>Мои наставники</Text>{asStudent.map(renderBookingCard)}</>}
      </>
    );
  }

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Мои записи</Text>

        <View style={styles.tabsRow}>
          <Pressable onPress={() => setActiveTab('events')}><Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>События</Text></Pressable>
          <Pressable onPress={() => setActiveTab('meetings')}><Text style={[styles.tabText, activeTab === 'meetings' && styles.tabTextActive]}>Личные встречи</Text></Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View>
        ) : error && activeTab === 'events' && isEmpty ? (
          <Text style={styles.errorText}>Не удалось загрузить события: {error}</Text>
        ) : isEmpty ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>У вас еще нет ни одной записи</Text>
            <Text style={styles.emptyText}>Зарегистрируйтесь на событие или подберите себе наставника, и здесь появится кнопка для подключения</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/events' as any)}>
              <Text style={styles.primaryButtonText}>Посмотреть события</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {activeTab === 'events' ? currentUpcoming.map((e) => renderEventCard(e as EventItem)) : renderBookingGroups(currentUpcoming as BookingItem[])}
            {currentPast.length > 0 && (
              <>
                <Text style={styles.pastSeparator}>ПРОШЕДШИЕ</Text>
                {activeTab === 'events' ? currentPast.map((e) => renderEventCard(e as EventItem)) : renderBookingGroups(currentPast as BookingItem[])}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 48, maxWidth: 720 },
  title: { fontSize: 28, fontFamily: 'Inter-Bold', color: '#181818', marginBottom: 16 },
  tabsRow: { flexDirection: 'row', gap: 24, marginBottom: 24, borderBottomWidth: 1, borderColor: '#E5E5E5', paddingBottom: 12 },
  tabText: { fontFamily: 'Inter-Regular', fontSize: 15, color: '#687076' },
  tabTextActive: { color: '#181818', fontFamily: 'Inter-Medium' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D' },
  emptyBox: { paddingVertical: 32 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter-Medium', color: '#181818', marginBottom: 8 },
  emptyText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#687076', marginBottom: 20, maxWidth: 420 },
  primaryButton: { backgroundColor: '#E02D2D', paddingVertical: 14, paddingHorizontal: 24, alignSelf: 'flex-start' },
  primaryButtonText: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#FFFFFF' },
  list: { gap: 12 },
  groupHeader: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#181818', marginTop: 12, marginBottom: 4 },
  pastSeparator: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9B9B9B', letterSpacing: 1, marginTop: 16, marginBottom: 4 },
  card: { borderWidth: 1, borderColor: '#1E1E1E', marginBottom: 4 },
  cardTop: { flexDirection: 'row' },
  cardImage: { width: 88, height: 88 },
  cardImagePlaceholder: { backgroundColor: '#E5E5E5' },
  cardBody: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#181818', marginBottom: 4 },
  cardAuthor: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#687076', marginBottom: 4 },
  cardMetaRow: { flexDirection: 'row', gap: 16 },
  cardDate: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#687076' },
  cardPrice: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818' },
  cardActionsRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#1E1E1E' },
  joinButton: { flex: 1, backgroundColor: '#E02D2D', paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  joinButtonText: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#FFFFFF' },
  cancelLink: { paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderColor: '#1E1E1E' },
  cancelLinkText: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#687076' },
});
