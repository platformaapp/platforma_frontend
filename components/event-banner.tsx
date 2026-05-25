import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Mask, Path } from 'react-native-svg';

import { endpoints } from '@/constants/env';
import { getMyEventsForStudent } from '@/lib/api/student-events';
import { authedFetch } from '@/lib/authed-fetch';
import { getAuthToken } from '@/lib/auth';

const MEETING_DURATION_MS = 90 * 60 * 1000;

function pluralizeRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const rem = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (rem === 1) return one;
  if (rem >= 2 && rem <= 4) return few;
  return many;
}

function formatCountdown(targetIso: string): string {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return '';
  const totalMin = Math.floor(diff / 60000);
  const totalHours = Math.floor(totalMin / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalDays >= 2) return `${totalDays} ${pluralizeRu(totalDays, 'день', 'дня', 'дней')}`;
  if (totalDays === 1) return '1 день';
  if (totalHours >= 2) return `${totalHours} ${pluralizeRu(totalHours, 'час', 'часа', 'часов')}`;
  if (totalHours === 1) return '1 час';
  if (totalMin >= 30) return 'полчаса';
  if (totalMin >= 1) return `${totalMin} ${pluralizeRu(totalMin, 'минуту', 'минуты', 'минут')}`;
  return 'меньше минуты';
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
  // Find soonest upcoming event (no 7-day limit — show always)
  const upcoming = events
    .filter((e) => {
      if (!e.datetimeStart) return false;
      return new Date(e.datetimeStart).getTime() > now;
    })
    .sort((a, b) => new Date(a.datetimeStart!).getTime() - new Date(b.datetimeStart!).getTime());

  if (upcoming.length > 0) {
    const text = formatCountdown(upcoming[0].datetimeStart!);
    if (text) return { kind: 'countdown', text, eventId: upcoming[0].id };
  }
  return { kind: 'none' };
}

async function joinEvent(eventId: string): Promise<string | null> {
  const res = await authedFetch(`${endpoints.events}/${eventId}/join`);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.join_url ?? data?.joinUrl ?? null;
}

function ClockIcon() {
  return (
    <Svg width="24" height="16" viewBox="0 0 24 16" fill="none">
      <Mask id="path-1-inside-1_4400_4890" fill="white">
        <Path d="M18 5.59961L24 2V14L18 10.3994V16H0V0H18V5.59961Z" />
      </Mask>
      <Path d="M18 5.59961H17V7.3657L18.5145 6.45713L18 5.59961ZM24 2H25V0.233908L23.4855 1.14248L24 2ZM24 14L23.4854 14.8575L25 15.7663V14H24ZM18 10.3994L18.5146 9.54196L17 8.63308V10.3994H18ZM18 16V17H19V16H18ZM0 16H-1V17H0V16ZM0 0V-1H-1V0H0ZM18 0H19V-1H18V0ZM18 5.59961L18.5145 6.45713L24.5145 2.85752L24 2L23.4855 1.14248L17.4855 4.74209L18 5.59961ZM24 2H23V14H24H25V2H24ZM24 14L24.5146 13.1425L18.5146 9.54196L18 10.3994L17.4854 11.2569L23.4854 14.8575L24 14ZM18 10.3994H17V16H18H19V10.3994H18ZM18 16V15H0V16V17H18V16ZM0 16H1V0H0H-1V16H0ZM0 0V1H18V0V-1H0V0ZM18 0H17V5.59961H18H19V0H18Z" fill="#FAFAFA" mask="url(#path-1-inside-1_4400_4890)" />
    </Svg>
  );
}

export function EventBanner() {
  const router = useRouter();
  const [banner, setBanner] = useState<BannerState>({ kind: 'none' });
  const [isAuthed, setIsAuthed] = useState(false);
  const [joining, setJoining] = useState(false);
  const eventsRef = useRef<EventEntry[]>([]);

  const fetchEvents = async () => {
    try {
      const token = await getAuthToken();
      if (!token) { setIsAuthed(false); return; }
      setIsAuthed(true);
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
        router.push(`/(tabs)/events/${eventId}` as any);
      }
    } catch {
      router.push(`/(tabs)/events/${eventId}` as any);
    } finally {
      setJoining(false);
    }
  };

  if (!isAuthed || banner.kind === 'none') return null;

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
  const upcomingEntry = eventsRef.current.find((e) => e.id === banner.eventId);
  const msUntilStart = upcomingEntry?.datetimeStart
    ? new Date(upcomingEntry.datetimeStart).getTime() - Date.now()
    : null;
  const isWithin5Min = msUntilStart !== null && msUntilStart <= 5 * 60 * 1000;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.iconWrapper}>
          <ClockIcon />
        </View>
        <Text style={styles.countdownText} numberOfLines={1}>
          {'До ближайшего события: ' + banner.text}
        </Text>
      </View>
      {isWithin5Min && (
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
      )}
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
  iconWrapper: {
    marginRight: 12,
    width: 24,
    height: 16,
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
