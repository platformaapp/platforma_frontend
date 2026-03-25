import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

type EventItem = {
  id: string;
  title: string;
  description?: string;
  datetimeStart?: string;
  price?: number;
  coverUrl?: string | null;
  mentor?: { id: string; name: string; avatarUrl?: string | null };
  status?: string;
  isRegistered?: boolean;
  isPaid?: boolean;
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

function formatBookingDate(date?: string, time?: string): string {
  if (!date && !time) return '';
  const parts: string[] = [];
  if (date) parts.push(date);
  if (time) parts.push(time);
  return parts.join(' ');
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

  const load = useCallback(async () => {
    try {
      setError('');
      const token = await getAuthToken();
      if (!token) { router.replace('/login'); return; }

      const headers: HeadersInit = { Authorization: `Bearer ${token}` };

      // Load registered events and bookings in parallel
      const [feedRes, bookRes] = await Promise.allSettled([
        fetch(endpoints.eventsFeed, { headers }),
        fetch(endpoints.studentBookings, { headers }),
      ]);

      if (feedRes.status === 'fulfilled' && feedRes.value.ok) {
        const data = await feedRes.value.json();
        const items: EventItem[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.items) ? data.items : [];
        // Keep only events the user has registered for
        setEvents(items.filter((e) => e.isRegistered === true));
      }

      if (bookRes.status === 'fulfilled' && bookRes.value.ok) {
        const data = await bookRes.value.json();
        setBookings(Array.isArray(data) ? data : []);
      }
    } catch (e: any) {
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
        </View>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.cardAuthor} numberOfLines={1}>
          {item.mentor?.name ?? ''}
        </Text>
        <Text style={styles.cardDate}>{formatDatetime(item.datetimeStart)}</Text>
        <View style={styles.cardMenu}>
          <Text style={styles.cardMenuText}>•••</Text>
        </View>
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
    : 'У вас пока нет личных встреч с наставниками';

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>МОИ ЗАПИСИ</Text>

      {/* Tab switcher */}
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
              ) : (
                <Pressable
                  style={styles.browseButton}
                  onPress={() => router.push('/(tabs)/explore')}
                >
                  <Text style={styles.browseButtonText}>Найти наставника</Text>
                </Pressable>
              )}
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
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  // Tab switcher
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

  // List
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  // Card
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

  // States
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
});
