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

import { endpoints } from '@/constants/env';
import { getAuthToken, getAuthRole } from '@/lib/auth';
import { AuthError } from '@/lib/api/auth-error';
import { getMyEventsForStudent, teacherName, type MyEventItem } from '@/lib/api/student-events';

// ─── Types ───────────────────────────────────────────────────────────────────

type EventItem = MyEventItem & {
  /** для UI: дата начала как в ленте */
  datetimeStart?: string;
  mentor?: { id: string; name: string; avatarUrl?: string | null };
};

type BookingItem = {
  id: string;
  slotId?: string;
  tutorId?: string;
  tutor?: { id?: string; name?: string; fullName?: string; avatarUrl?: string };
  date?: string;
  time?: string;
  status?: string;
  createdAt?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDatetime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('ru-RU', { month: 'short' });
    const weekday = d.toLocaleString('ru-RU', { weekday: 'short' }).toUpperCase();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${weekday} ${hh}:${mm}`;
  } catch {
    return iso;
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
    return iso;
  }
}

function formatBookingDate(date?: string, time?: string): string {
  if (!date && !time) return '';
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
  return msg.includes('token expired') || msg.includes('refresh failed') || msg.includes('требуется авторизация');
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

type Tab = 'events' | 'meetings';

export default function MyEventsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('events');

  const [events, setEvents] = useState<EventItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [menuEvent, setMenuEvent] = useState<EventItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<EventItem | null>(null);
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);
  const [cancelSuccessVisible, setCancelSuccessVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const [token, userRole] = await Promise.all([getAuthToken(), getAuthRole()]);
      if (!token) { router.replace('/login'); return; }
      setRole(userRole);

      const headers: HeadersInit = { Authorization: `Bearer ${token}` };
      const bookingsUrl = userRole === 'tutor' ? endpoints.tutorBookings : endpoints.studentBookings;

      const [myEventsRes, bookRes] = await Promise.allSettled([
        getMyEventsForStudent({ role: 'student', filter: 'all', time: 'all', page: 1, per_page: 50 }),
        fetch(bookingsUrl, { headers }),
      ]);

      if (myEventsRes.status === 'fulfilled') {
        const { items } = myEventsRes.value;
        const mapped: EventItem[] = items.map((it) => {
          const start = it.start_at ?? it.startAt;
          return {
            ...it,
            datetimeStart: start,
            mentor: { id: '', name: teacherName(it.teacher) },
          };
        });
        setEvents(mapped);
      } else {
        setEvents([]);
        const err = myEventsRes.reason;
        if (isAuthError(err)) { router.replace('/login'); return; }
        setError(err instanceof Error ? err.message : 'Не удалось загрузить мои мероприятия');
      }

      if (bookRes.status === 'fulfilled' && bookRes.value.ok) {
        const data = await bookRes.value.json();
        setBookings(Array.isArray(data) ? data : []);
      }
    } catch (e: any) {
      if (isAuthError(e)) { router.replace('/login'); return; }
      setError(e?.message ?? 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleWriteToMentor = () => {
    const mentorId = menuEvent?.mentor?.id;
    setMenuEvent(null);
    if (mentorId) {
      router.push(`/(tabs)/explore/${mentorId}` as any);
    }
  };

  const handleWriteToStudent = () => {
    const student = menuEvent?.student as Record<string, unknown> | undefined;
    const studentId = (student?.id ?? student?.userId ?? student?.user_id) as string | undefined;
    setMenuEvent(null);
    if (studentId) {
      router.push(`/(tabs)/explore/${studentId}` as any);
    }
  };

  const handleEventSettings = () => {
    setMenuEvent(null);
    router.push('/(tabs)/profile' as any);
  };

  const handleEditEvent = () => {
    const eventId = menuEvent?.id;
    setMenuEvent(null);
    if (eventId) {
      router.push(`/(tabs)/profile/edit-event?id=${eventId}` as any);
    }
  };

  const handleCancelRegistration = () => {
    if (!menuEvent) return;
    setCancelTarget(menuEvent);
    setMenuEvent(null);
    setCancelConfirmVisible(true);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const eventId = cancelTarget.id;
    setCancelConfirmVisible(false);
    setIsCancelling(true);
    try {
      const token = await getAuthToken();
      if (!token) { router.replace('/login'); return; }
      const res = await fetch(`${endpoints.events}/${eventId}/register`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok || res.status === 404) {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
        setCancelSuccessVisible(true);
      } else {
        const data = await res.json().catch(() => ({}));
        Alert.alert('Ошибка', data?.message ?? `Не удалось отменить запись (${res.status})`);
        setCancelTarget(null);
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось отменить запись');
      setCancelTarget(null);
    } finally {
      setIsCancelling(false);
    }
  };

  // ─── Render event card ───────────────────────────────────────────────────

  const renderEventCard = (item: EventItem) => (
    <Pressable
      key={item.id}
      style={styles.card}
      onPress={() => router.push(`/(tabs)/events/${item.id}` as any)}
    >
      <View style={styles.cardTop}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
        )}
        <View style={styles.cardTitleBox}>
          <Text style={styles.cardTitle} numberOfLines={3}>{item.title}</Text>
          {item.status ? (
            <Text style={styles.eventStatus}>{translateEventStatus(item.status)}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.cardAuthor} numberOfLines={1}>
          {item.mentor?.name ?? ''}
        </Text>
        <Text style={styles.cardDate}>{formatDatetime(item.datetimeStart)}</Text>
        <Pressable
          style={styles.cardMenu}
          onPress={(e) => { e.stopPropagation(); setMenuEvent(item); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.cardMenuText}>•••</Text>
        </Pressable>
      </View>
    </Pressable>
  );

  // ─── Render booking card (личная встреча с наставником) ─────────────────

  const renderBookingCard = (item: BookingItem) => {
    const tutorName = item.tutor?.fullName ?? item.tutor?.name ?? 'Наставник';
    const avatarUrl = item.tutor?.avatarUrl;
    const dateStr = formatBookingDate(item.date, item.time);
    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardTop}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.cardImage} />
          ) : (
            <Image source={require('@/assets/images/avatar.png')} style={styles.cardImage} />
          )}
          <View style={styles.cardTitleBox}>
            <Text style={styles.cardTitle}>Личная встреча</Text>
            {item.status ? (
              <Text style={styles.bookingStatus}>{translateStatus(item.status)}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.cardAuthor} numberOfLines={1}>{tutorName}</Text>
          <Text style={styles.cardDate}>{dateStr}</Text>
          <View style={styles.cardMenu}>
            <Text style={styles.cardMenuText}>•••</Text>
          </View>
        </View>
      </View>
    );
  };

  function translateEventStatus(s: string): string {
    const map: Record<string, string> = {
      pending: 'Ожидает оплаты',
      confirmed: 'Подтверждено',
      cancelled: 'Отменено',
      completed: 'Завершено',
      paid: 'Оплачено',
    };
    return map[s.toLowerCase()] ?? s;
  }

  function translateStatus(s: string): string {
    const map: Record<string, string> = {
      pending: 'Ожидает подтверждения',
      confirmed: 'Подтверждено',
      cancelled: 'Отменено',
      completed: 'Завершено',
      booked: 'Забронировано',
    };
    return map[s.toLowerCase()] ?? s;
  }

  // ─── Empty state ─────────────────────────────────────────────────────────

  const isEmpty = activeTab === 'events' ? events.length === 0 : bookings.length === 0;
  const emptyText = activeTab === 'events'
    ? 'Вы ещё не записались ни на одно событие'
    : role === 'tutor'
      ? 'У вас пока нет встреч с учениками'
      : 'У вас пока нет личных встреч с наставниками';
  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>МОИ ЗАПИСИ</Text>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, activeTab === 'events' && styles.tabButtonActive]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
            СОБЫТИЯ
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'meetings' && styles.tabButtonActive]}
          onPress={() => setActiveTab('meetings')}
        >
          <Text style={[styles.tabText, activeTab === 'meetings' && styles.tabTextActive]}>
            ЛИЧНЫЕ ВСТРЕЧИ
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#181818" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {isEmpty ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyText}>{emptyText}</Text>
              {activeTab === 'events' ? (
                <Pressable
                  style={styles.browseButton}
                  onPress={() => router.push('/(tabs)/events')}
                >
                  <Text style={styles.browseButtonText}>Смотреть события</Text>
                </Pressable>
              ) : role !== 'tutor' ? (
                <Pressable
                  style={styles.browseButton}
                  onPress={() => router.push('/(tabs)/explore')}
                >
                  <Text style={styles.browseButtonText}>Найти наставника</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <>
              {activeTab === 'events'
                ? events.map(renderEventCard)
                : bookings.map(renderBookingCard)}
            </>
          )}
        </ScrollView>
      )}

      {/* ─── Event menu popup (•••) ──────────────────────────────────────── */}
      <Modal
        transparent
        animationType="none"
        visible={menuEvent !== null}
        onRequestClose={() => setMenuEvent(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuEvent(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalEventCard}>
              <Text style={styles.modalEventTitle}>{menuEvent?.title}</Text>
              {menuEvent?.datetimeStart ? (
                <Text style={styles.modalEventDate}>
                  {formatMenuDatetime(menuEvent.datetimeStart)}
                </Text>
              ) : null}
            </View>
            {role === 'tutor' ? (
              <>
                <Pressable style={styles.modalWriteButton} onPress={handleWriteToStudent}>
                  <Text style={styles.modalWriteButtonText}>Написать ученику</Text>
                </Pressable>
                <Pressable style={styles.modalWriteButton} onPress={handleEventSettings}>
                  <Text style={styles.modalWriteButtonText}>Настройки</Text>
                </Pressable>
                <Pressable style={styles.modalWriteButton} onPress={handleEditEvent}>
                  <Text style={styles.modalWriteButtonText}>Редактировать событие</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={styles.modalWriteButton} onPress={handleWriteToMentor}>
                  <Text style={styles.modalWriteButtonText}>Написать наставнику</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalCancelButton, isCancelling && styles.modalCancelButtonDisabled]}
                  onPress={handleCancelRegistration}
                  disabled={isCancelling}
                >
                  <Text style={styles.modalCancelButtonText}>
                    {isCancelling ? 'Отмена...' : 'Отменить запись'}
                  </Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Cancel confirmation modal ──────────────────────────────────── */}
      <Modal
        transparent
        animationType="none"
        visible={cancelConfirmVisible}
        onRequestClose={() => { setCancelConfirmVisible(false); setCancelTarget(null); }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => { setCancelConfirmVisible(false); setCancelTarget(null); }}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.cancelModalTitle}>ВЫ ДЕЙСТВИТЕЛЬНО ХОТИТЕ ОТМЕНИТЬ ЗАПИСЬ?</Text>
            {cancelTarget?.datetimeStart &&
              new Date(cancelTarget.datetimeStart).getTime() - Date.now() < 24 * 60 * 60 * 1000 ? (
              <Text style={styles.cancelModalWarning}>
                Вы отменяете запись позднее, чем за 24 часа. Вернуть деньги за нее уже не получится.
              </Text>
            ) : (
              <Text style={styles.cancelModalSubtext}>
                После отмены вы потеряете место на этом мероприятии.
              </Text>
            )}
            <Pressable
              style={styles.cancelModalKeepButton}
              onPress={() => { setCancelConfirmVisible(false); setCancelTarget(null); }}
            >
              <Text style={styles.cancelModalKeepText}>Оставить</Text>
            </Pressable>
            <Pressable
              style={[styles.cancelModalConfirmButton, isCancelling && styles.modalCancelButtonDisabled]}
              onPress={confirmCancel}
              disabled={isCancelling}
            >
              <Text style={styles.cancelModalConfirmText}>
                {isCancelling ? 'Отмена...' : 'Отменить запись'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Cancel success modal ───────────────────────────────────────── */}
      <Modal
        transparent
        animationType="none"
        visible={cancelSuccessVisible}
        onRequestClose={() => { setCancelSuccessVisible(false); setCancelTarget(null); }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => { setCancelSuccessVisible(false); setCancelTarget(null); }}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.cancelModalTitle}>ЗАПИСЬ ОТМЕНЕНА</Text>
            <Text style={styles.cancelModalSubtext}>
              Деньги вернутся на карту в течении 3 рабочих дней
            </Text>
            <Pressable
              style={styles.cancelSuccessCloseButton}
              onPress={() => { setCancelSuccessVisible(false); setCancelTarget(null); }}
            >
              <Text style={styles.cancelSuccessCloseText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  screenTitle: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },

  tabRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#111',
  },
  tabText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: '#FAFAFA',
  },

  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  card: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 16,
  },
  cardTop: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  cardImage: {
    width: 96,
    height: 96,
  },
  cardImagePlaceholder: {
    backgroundColor: '#E5E5E5',
  },
  cardTitleBox: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  eventStatus: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
  },
  bookingStatus: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  cardAuthor: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  cardDate: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    paddingRight: 4,
  },
  cardMenu: {
    width: 44,
    borderLeftWidth: 1,
    borderColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  cardMenuText: {
    fontSize: 18,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#E02D2D',
    textAlign: 'center',
  },
  emptyBlock: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 14,
    paddingHorizontal: 24,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },

  // ─── Event menu modal (•••) ─────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  modalEventCard: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    marginBottom: 0,
  },
  modalEventTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
    marginBottom: 12,
  },
  modalEventDate: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#1E1E1E',
  },
  modalWriteButton: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    height: 52,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 0,
  },
  modalWriteButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  modalCancelButton: {
    borderWidth: 1,
    borderColor: '#E02D2D',
    height: 52,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  modalCancelButtonDisabled: {
    opacity: 0.5,
  },
  modalCancelButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#E02D2D',
  },

  // ─── Cancel confirm / success modals ────────────────────────────────────
  cancelModalTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'Inter-Regular',
    fontWeight: '700',
    color: '#181818',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  cancelModalSubtext: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    marginBottom: 20,
  },
  cancelModalWarning: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#E02D2D',
    marginBottom: 20,
  },
  cancelModalKeepButton: {
    height: 52,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cancelModalKeepText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  cancelModalConfirmButton: {
    height: 52,
    backgroundColor: '#E02D2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalConfirmText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  cancelSuccessCloseButton: {
    height: 52,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelSuccessCloseText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
});
