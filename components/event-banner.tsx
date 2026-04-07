import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { endpoints } from '@/constants/env';
import { getMyEventsForStudent } from '@/lib/api/student-events';
import { getAuthToken } from '@/lib/auth';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MEETING_DURATION_MS = 90 * 60 * 1000;

function pluralizeRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const rem = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (rem === 1) return one;
  if (rem >= 2 && rem <= 4) return few;
  return many;
}

function formatCountdown(targetIso: string): string | null {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0 || diff > WEEK_MS) return null;
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${pluralizeRu(days, 'день', 'дня', 'дней')}`);
  if (hours > 0) parts.push(`${hours} ${pluralizeRu(hours, 'час', 'часа', 'часов')}`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} ${pluralizeRu(minutes, 'минуту', 'минуты', 'минут')}`);
  if (parts.length === 1) return parts[0];
  const last = parts.pop()!;
  return `${parts.join(', ')} и ${last}`;
}

type EventEntry = { id: string; datetimeStart?: string; canJoin?: boolean };

type BannerState =
  | { kind: 'none' }
  | { kind: 'countdown'; text: string; eventId: string }
  | { kind: 'ongoing'; eventId: string };

function computeBanner(events: EventEntry[]): BannerState {
  const now = Date.now();
  // Check for ongoing first
  for (const e of events) {
    if (!e.datetimeStart) continue;
    const start = new Date(e.datetimeStart).getTime();
    if (start <= now && now <= start + MEETING_DURATION_MS) {
      return { kind: 'ongoing', eventId: e.id };
    }
  }
  // Find soonest upcoming within a week
  const upcoming = events
    .filter((e) => {
      if (!e.datetimeStart) return false;
      const diff = new Date(e.datetimeStart).getTime() - now;
      return diff > 0 && diff <= WEEK_MS;
    })
    .sort((a, b) => new Date(a.datetimeStart!).getTime() - new Date(b.datetimeStart!).getTime());
  if (upcoming.length > 0) {
    const text = formatCountdown(upcoming[0].datetimeStart!);
    if (text) return { kind: 'countdown', text, eventId: upcoming[0].id };
  }
  return { kind: 'none' };
}

async function joinEvent(eventId: string): Promise<string | null> {
  const token = await getAuthToken();
  if (!token) return null;
  const res = await fetch(`${endpoints.events}/${eventId}/join`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.join_url ?? data?.joinUrl ?? null;
}

export function EventBanner() {
  const router = useRouter();
  const [banner, setBanner] = useState<BannerState>({ kind: 'none' });
  const [joining, setJoining] = useState(false);
  const eventsRef = useRef<EventEntry[]>([]);

  const fetchEvents = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      const { items } = await getMyEventsForStudent({ role: 'student', filter: 'all', time: 'all', page: 1, per_page: 50 });
      eventsRef.current = items.map((it) => ({
        id: it.id,
        datetimeStart: it.start_at ?? it.startAt,
        canJoin: (it as any).can_join ?? (it as any).canJoin,
      }));
      setBanner(computeBanner(eventsRef.current));
    } catch {
      // silently ignore — banner stays hidden
    }
  };

  useEffect(() => {
    fetchEvents();
    const fetchInterval = setInterval(fetchEvents, 5 * 60 * 1000);
    const tickInterval = setInterval(() => {
      setBanner(computeBanner(eventsRef.current));
    }, 30_000);
    return () => {
      clearInterval(fetchInterval);
      clearInterval(tickInterval);
    };
  }, []);

  const handleJoin = async (eventId: string) => {
    setJoining(true);
    try {
      const url = await joinEvent(eventId);
      if (url) {
        await Linking.openURL(url);
      } else {
        // Can't join yet or no room — open event detail
        router.push(`/(tabs)/events/${eventId}` as any);
      }
    } catch {
      router.push(`/(tabs)/events/${eventId}` as any);
    } finally {
      setJoining(false);
    }
  };

  if (banner.kind === 'none') return null;

  if (banner.kind === 'ongoing') {
    return (
      <View style={styles.container}>
        <Pressable
          style={[styles.button, joining && styles.buttonDisabled]}
          onPress={() => !joining && handleJoin(banner.eventId)}
          disabled={joining}
        >
          {joining ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Встреча уже идет, присоединяйся!</Text>
          )}
        </Pressable>
      </View>
    );
  }

  // countdown
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.icon}>{'□|'}</Text>
        <Text style={styles.countdownText} numberOfLines={1}>
          {'До ближайшего события: ' + banner.text}
        </Text>
      </View>
      <Pressable
        style={[styles.button, joining && styles.buttonDisabled]}
        onPress={() => !joining && handleJoin(banner.eventId)}
        disabled={joining}
      >
        {joining ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.buttonText}>Открыть видео</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#181818',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  icon: {
    fontSize: 14,
    color: '#FFFFFF',
    marginRight: 8,
    fontFamily: 'Inter-Regular',
  },
  countdownText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  button: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
});
