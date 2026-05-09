import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE, endpoints } from '@/constants/env';
import { bookTutorSlot, getPublicTutorList, getStudentTutorSlots } from '@/lib/api/tutor';
import { getAuthRole, getAuthToken, getUserProfile } from '@/lib/auth';

type MentorEvent = {
  id: string;
  title: string;
  datetimeStart?: string;
  price?: number;
  coverUrl?: string | null;
};

function resolveCover(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

function formatEventDate(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' }) +
      ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

const PLACEHOLDER_AVATAR = require('@/assets/images/avatar.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLOT_COLS = 5;
const SLOT_GAP = 6;
const SLOT_PADDING = 16;
const SLOT_WIDTH =
  (SCREEN_WIDTH - SLOT_PADDING * 2 - SLOT_GAP * (SLOT_COLS - 1)) / SLOT_COLS;

type SlotItem = {
  id: string;
  date: string;  // DD.MM для отображения
  time: string;  // HH:mm
  price?: number;
  status: 'available' | 'booked' | 'pending';
};

function formatSlotDate(apiDate: string): string {
  // YYYY-MM-DD → DD.MM
  const parts = apiDate.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}`;
  return apiDate;
}

export default function TutorCardScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState('');
  const [displayBio, setDisplayBio] = useState('');   // long bio for body text
  const [displayRole, setDisplayRole] = useState(''); // shortBio for role label
  const [displayPrice, setDisplayPrice] = useState(''); // hourlyRate
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [isTutor, setIsTutor] = useState(false);
  const [telegramHandle, setTelegramHandle] = useState('');
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isMentorVerified, setIsMentorVerified] = useState(true);

  const [showSlots, setShowSlots] = useState(false);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [isShareVisible, setShareVisible] = useState(false);
  const [isShareCopied, setShareCopied] = useState(false);

  const [mentorEvents, setMentorEvents] = useState<MentorEvent[]>([]);

  const profileUrl = `https://platformaapp.ru/explore/${id ?? ''}`;

  useEffect(() => {
    if (!id) return;
    let active = true;

    const load = async () => {
      try {
        const [viewerRole, profile, list] = await Promise.all([
          getAuthRole(),
          getUserProfile(),
          getPublicTutorList(),
        ]);
        if (active) {
          setIsTutor(viewerRole === 'tutor');
          setIsOwnProfile(profile?.id === id);
        }

        // Fetch tutor info from user list
        const tutor = list.find((t) => t.id === id);
        if (active && tutor) {
          setDisplayName(tutor.fullName ?? '');
          // shortBio = role label (e.g. "Куратор, исследователь")
          const roleLabel = tutor.shortBio ?? tutor.short_bio ?? '';
          setDisplayRole(roleLabel);
          // bio = long description text
          setDisplayBio(tutor.bio ?? '');
          setAvatarUrl(tutor.avatarUrl ?? '');
          // hourlyRate for price row
          const rate = tutor.hourlyRate ?? tutor.hourly_rate ?? tutor.pricePerHour;
          if (typeof rate === 'number' && rate > 0) {
            setDisplayPrice(`${rate.toLocaleString('ru-RU')} ₽ в час`);
          }
          // Telegram handle
          const tg = tutor.telegram ?? tutor.telegramUsername ?? tutor.telegram_username ?? '';
          setTelegramHandle(tg.replace(/^@/, ''));
          // Verification: if field present and explicitly false — mentor not verified
          if (active) setIsMentorVerified(tutor.isVerified !== false);
        }

        // Fetch mentor's events — try server params first, fall back to feed + filter
        try {
          let events: MentorEvent[] = [];

          // Try common query params for tutor-filtered events
          const tryEndpoints = [
            `${endpoints.events}?tutorId=${id}&per_page=50`,
            `${endpoints.events}?mentor_id=${id}&per_page=50`,
            `${endpoints.events}?authorId=${id}&per_page=50`,
            `${endpoints.eventsFeed}?tutorId=${id}&per_page=50`,
          ];

          for (const url of tryEndpoints) {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            let rawItems: unknown = data.items ?? data.data ?? data;
            if (!Array.isArray(rawItems) && rawItems && typeof rawItems === 'object') {
              const inner = rawItems as Record<string, unknown>;
              rawItems = inner.items ?? inner.data ?? [];
            }
            const list = Array.isArray(rawItems) ? rawItems : [];
            const parsed: MentorEvent[] = list
              .filter((r: any) => {
                const mentorRaw = r.mentor ?? r.teacher ?? r.tutor;
                const mId = String(mentorRaw?.id ?? mentorRaw?.userId ?? '');
                return mId === id || list.length > 0;
              })
              .map((r: any) => ({
                id: String(r.id ?? ''),
                title: String(r.title ?? ''),
                datetimeStart: r.datetimeStart ?? r.datetime_start ?? r.startAt ?? undefined,
                price: typeof r.price === 'number' ? r.price : typeof r.price === 'string' ? parseFloat(r.price) : undefined,
                coverUrl: resolveCover(r.coverUrl ?? r.cover_url ?? r.imageUrl),
              }))
              .filter((e: MentorEvent) => e.id);

            // If we got results that actually belong to this mentor, stop
            const owned = parsed.filter((e: MentorEvent) => {
              const raw = list.find((r: any) => String(r.id ?? '') === e.id) as any;
              if (!raw) return false;
              const mentorRaw = raw.mentor ?? raw.teacher ?? raw.tutor;
              return String(mentorRaw?.id ?? mentorRaw?.userId ?? '') === id;
            });
            if (owned.length > 0) { events = owned; break; }
          }

          // Last resort: fetch all feed and filter client-side
          if (events.length === 0) {
            const res = await fetch(`${endpoints.events}?per_page=100`);
            if (res.ok) {
              const data = await res.json();
              let rawItems: unknown = data.items ?? data.data ?? data;
              if (!Array.isArray(rawItems) && rawItems && typeof rawItems === 'object') {
                const inner = rawItems as Record<string, unknown>;
                rawItems = inner.items ?? inner.data ?? [];
              }
              const list = Array.isArray(rawItems) ? rawItems : [];
              events = list
                .filter((r: any) => {
                  const mentorRaw = r.mentor ?? r.teacher ?? r.tutor;
                  return String(mentorRaw?.id ?? mentorRaw?.userId ?? '') === id;
                })
                .map((r: any) => ({
                  id: String(r.id ?? ''),
                  title: String(r.title ?? ''),
                  datetimeStart: r.datetimeStart ?? r.datetime_start ?? r.startAt ?? undefined,
                  price: typeof r.price === 'number' ? r.price : typeof r.price === 'string' ? parseFloat(r.price) : undefined,
                  coverUrl: resolveCover(r.coverUrl ?? r.cover_url ?? r.imageUrl),
                }))
                .filter((e: MentorEvent) => e.id);
            }
          }

          if (active) setMentorEvents(events);
        } catch {
          // ignore — events section stays empty
        }
      } catch {
        // ignore — show placeholder
      } finally {
        if (active) setLoadingProfile(false);
      }
    };

    load();
    return () => { active = false; };
  }, [id]);

  const imageSource = avatarUrl && !avatarUrl.startsWith('blob:') ? { uri: avatarUrl } : PLACEHOLDER_AVATAR;

  const handleOpenSlots = async () => {
    const token = await getAuthToken();
    if (!token) { router.push('/login'); return; }
    setShowSlots(true);
    setLoadingSlots(true);
    setSlotsError('');
    try {
      const apiSlots = await getStudentTutorSlots(id ?? '');
      const nowTs = Date.now();
      const filtered = apiSlots.filter((s) => {
        // Hide booked slots — not available for new bookings
        if (s.status !== 'free' && s.status !== 'available') return false;
        // Hide past slots
        const slotTs = new Date(`${s.date}T${s.time}:00`).getTime();
        return slotTs > nowTs;
      });
      setSlots(filtered.map((s) => ({
        id: s.id,
        date: formatSlotDate(s.date),
        time: s.time,
        price: s.price,
        status: 'available',
      })));
    } catch (e: any) {
      setSlotsError(e?.message ?? 'Не удалось загрузить слоты');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSelectSlot = (slot: SlotItem) => {
    if (slot.status !== 'available') return;
    setSelectedSlot(slot);
    setShowSlots(false);
  };

  const handleBook = async () => {
    if (!selectedSlot || isBooking) return;
    const token = await getAuthToken();
    if (!token) { setSelectedSlot(null); router.push('/login'); return; }
    setIsBooking(true);
    try {
      await bookTutorSlot(selectedSlot.id);
      setSelectedSlot(null);
      Alert.alert('Успешно', 'Вы записались на встречу!');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось забронировать слот');
    } finally {
      setIsBooking(false);
    }
  };

  if (loadingProfile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#181818" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Back */}
      <Pressable style={[styles.backButton, { top: insets.top + 12 }]} onPress={() => router.back()}>
        <Text style={styles.backArrow}>‹</Text>
      </Pressable>

      <Image source={imageSource} style={styles.heroImage} resizeMode="cover" />

      <View style={styles.nameRow}>
        <Text style={styles.name}>{displayName || 'Наставник'}</Text>
        {displayRole ? (
          <Text style={styles.roleText} numberOfLines={2}>{displayRole}</Text>
        ) : null}
      </View>

      {displayBio ? (
        <View style={styles.bioSection}>
          <Text style={styles.bioText}>{displayBio}</Text>
        </View>
      ) : null}

      {displayPrice ? (
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Стоимость консультации</Text>
          <Text style={styles.priceValue}>{displayPrice}</Text>
        </View>
      ) : null}

      {/* Booking button — hidden for own profile and unverified mentors */}
      {!isOwnProfile && isMentorVerified && (
        <Pressable style={styles.primaryButton} onPress={handleOpenSlots}>
          <Text style={styles.primaryButtonText}>Записаться на встречу</Text>
        </Pressable>
      )}

      {!isOwnProfile && (
        <Pressable
          style={styles.secondaryButton}
          onPress={async () => {
            const token = await getAuthToken();
            if (!token) { router.push('/login'); return; }
            if (telegramHandle) {
              Linking.openURL(`https://t.me/${telegramHandle}`);
            } else {
              Alert.alert('Контакт', 'Наставник пока не указал способ связи');
            }
          }}
        >
          <Text style={styles.secondaryButtonText}>Написать наставнику</Text>
        </Pressable>
      )}

      {/* Mentor events */}
      {mentorEvents.length > 0 && (
        <View style={styles.eventsSection}>
          <Text style={styles.eventsSectionTitle}>СОБЫТИЯ НАСТАВНИКА</Text>
          {mentorEvents.map((ev) => (
            <Pressable
              key={ev.id}
              style={styles.eventCard}
              onPress={() => router.push(`/(tabs)/events/${ev.id}` as any)}
            >
              {ev.coverUrl ? (
                <Image source={{ uri: ev.coverUrl }} style={styles.eventCover} resizeMode="cover" />
              ) : (
                <View style={[styles.eventCover, styles.eventCoverPlaceholder]} />
              )}
              <View style={styles.eventBody}>
                <Text style={styles.eventTitle} numberOfLines={2}>{ev.title}</Text>
                {ev.datetimeStart ? (
                  <Text style={styles.eventDate}>{formatEventDate(ev.datetimeStart)}</Text>
                ) : null}
                {ev.price != null ? (
                  <Text style={styles.eventPrice}>{ev.price.toLocaleString('ru-RU')} ₽</Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Share row */}
      <Pressable style={styles.shareRow} onPress={() => { setShareCopied(false); setShareVisible(true); }}>
        <Text style={styles.shareText}>Поделиться профилем</Text>
        <View style={styles.shareIconBox}>
          <Text style={styles.shareIcon}>↑</Text>
        </View>
      </Pressable>

      {/* ─── Slot selection ───────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={showSlots} onRequestClose={() => setShowSlots(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowSlots(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>СВОБОДНЫЕ СЛОТЫ{'\n'}ДЛЯ ЗАПИСИ</Text>
            {loadingSlots ? (
              <View style={styles.slotsCentered}>
                <ActivityIndicator size="small" color="#181818" />
              </View>
            ) : slotsError ? (
              <View style={styles.slotsCentered}>
                <Text style={styles.slotsErrorText}>{slotsError}</Text>
              </View>
            ) : slots.length === 0 ? (
              <View style={styles.slotsCentered}>
                <Text style={styles.slotsEmptyText}>Нет доступных слотов</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.slotScroll} contentContainerStyle={styles.slotGrid}>
                {slots.map((slot) => {
                  const isAvailable = slot.status === 'available';
                  const isPending = slot.status === 'pending';
                  return (
                    <Pressable
                      key={slot.id}
                      onPress={() => handleSelectSlot(slot)}
                      style={[styles.slotCard, !isAvailable && styles.slotCardUnavailable]}
                    >
                      {isPending && (
                        <View style={styles.slotBadge}>
                          <Text style={styles.slotBadgeText}>?</Text>
                        </View>
                      )}
                      <Text style={[styles.slotDate, !isAvailable && styles.slotTextMuted]}>{slot.date}</Text>
                      <Text style={[styles.slotTime, !isAvailable && styles.slotTextMuted]}>{slot.time}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <Pressable style={styles.sheetSecondaryButton} onPress={() => setShowSlots(false)}>
              <Text style={styles.sheetSecondaryButtonText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Booking confirmation ─────────────────────────────── */}
      <Modal transparent animationType="fade" visible={selectedSlot !== null} onRequestClose={() => setSelectedSlot(null)}>
        <Pressable style={styles.overlay} onPress={() => setSelectedSlot(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>ПОДТВЕРЖДЕНИЕ{'\n'}ЗАПИСИ</Text>
            <View style={styles.bookingCard}>
              <View style={styles.bookingCardTop}>
                <Text style={styles.bookingCardName}>{displayName || 'Наставник'}</Text>
              </View>
              <View style={styles.bookingCardBottom}>
                <Text style={styles.bookingCardDateTime}>{selectedSlot?.date} {selectedSlot?.time}</Text>
                <View style={styles.bookingCardDivider} />
                <Text style={styles.bookingCardPrice}>
                  {selectedSlot?.price != null
                    ? `${selectedSlot.price.toLocaleString('ru-RU')} ₽`
                    : displayPrice || '—'}
                </Text>
              </View>
            </View>
            <Pressable
              style={[styles.sheetPrimaryButton, isBooking && styles.sheetPrimaryButtonDisabled]}
              onPress={handleBook}
              disabled={isBooking}
            >
              <Text style={styles.sheetPrimaryButtonText}>{isBooking ? 'Оплата...' : 'Оплатить'}</Text>
            </Pressable>
            <Pressable style={styles.sheetSecondaryButton} onPress={() => { setSelectedSlot(null); setShowSlots(true); }}>
              <Text style={styles.sheetSecondaryButtonText}>Назад</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Share popup ──────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={isShareVisible} onRequestClose={() => setShareVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setShareVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Поделиться профилем</Text>
            <View style={styles.shareCard}>
              <Text style={styles.shareUrl} numberOfLines={2}>{profileUrl}</Text>
            </View>
            {isShareCopied ? <Text style={styles.shareCopiedText}>Ссылка скопирована</Text> : null}
            <Pressable
              style={styles.sheetPrimaryButton}
              onPress={async () => { await Clipboard.setStringAsync(profileUrl); setShareCopied(true); }}
            >
              <Text style={styles.sheetPrimaryButtonText}>
                {isShareCopied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
              </Text>
            </Pressable>
            <Pressable style={styles.sheetSecondaryButton} onPress={() => setShareVisible(false)}>
              <Text style={styles.sheetSecondaryButtonText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  contentContainer: { paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  backButton: {
    position: 'absolute', top: 16, left: 16, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 28, lineHeight: 30, color: '#181818', marginTop: -2 },

  heroImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.1, backgroundColor: '#E5E5E5' },

  nameRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#1E1E1E' },
  name: { fontSize: 18, lineHeight: 24, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 4 },
  roleText: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#181818' },

  bioSection: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#1E1E1E' },
  bioText: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },

  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#1E1E1E',
  },
  priceLabel: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#181818' },
  priceValue: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#181818' },

  primaryButton: { marginHorizontal: 16, marginTop: 16, backgroundColor: '#111', height: 52, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#FAFAFA' },

  tutorBlockedRow: { marginHorizontal: 16, marginTop: 16, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#C8C8C8', backgroundColor: '#F5F5F5' },
  tutorBlockedText: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#9B9B9B', textAlign: 'center' },

  secondaryButton: { marginHorizontal: 16, marginTop: 12, height: 52, borderWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },

  eventsSection: { marginTop: 20, marginHorizontal: 16, marginBottom: 4 },
  eventsSectionTitle: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818', marginBottom: 12, borderBottomWidth: 1, borderColor: '#1E1E1E', paddingBottom: 8 },
  eventCard: { flexDirection: 'row', borderWidth: 1, borderColor: '#1E1E1E', marginBottom: 10, backgroundColor: '#fff' },
  eventCover: { width: 80, height: 80 },
  eventCoverPlaceholder: { backgroundColor: '#E5E5E5' },
  eventBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  eventTitle: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', fontWeight: '600', color: '#181818', marginBottom: 4 },
  eventDate: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#555', marginBottom: 2 },
  eventPrice: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#181818' },

  shareRow: { marginTop: 16, marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#1E1E1E', height: 52 },
  shareText: { flex: 1, paddingLeft: 16, fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  shareIconBox: { width: 52, height: 52, borderLeftWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
  shareIcon: { fontSize: 18, color: '#181818' },

  // Bottom sheet shared
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  sheetTitle: { marginTop: 0, marginBottom: 8, fontFamily: 'Inter-Regular', fontWeight: '700', fontSize: 28, textTransform: 'uppercase', lineHeight: 36, letterSpacing: -1, color: '#181818', textAlign: 'left' },
  sheetPrimaryButton: { marginTop: 16, backgroundColor: '#1E1E1E', height: 52, alignItems: 'center', justifyContent: 'center' },
  sheetPrimaryButtonDisabled: { opacity: 0.6 },
  sheetPrimaryButtonText: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#FFFFFF' },
  sheetSecondaryButton: { marginTop: 12, borderWidth: 1, borderColor: '#1E1E1E', height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  sheetSecondaryButtonText: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#181818' },

  // Slot grid
  slotsCentered: { height: 120, alignItems: 'center', justifyContent: 'center' },
  slotsErrorText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D', textAlign: 'center' },
  slotsEmptyText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#9B9B9B', textAlign: 'center' },
  slotScroll: { maxHeight: 280 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SLOT_GAP, paddingBottom: 4 },
  slotCard: { width: SLOT_WIDTH, height: SLOT_WIDTH * 0.9, borderWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', position: 'relative' },
  slotCardUnavailable: { backgroundColor: '#F5F5F5', borderColor: '#C8C8C8' },
  slotBadge: { position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#9B9B9B', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  slotBadgeText: { fontSize: 9, lineHeight: 12, color: '#9B9B9B' },
  slotDate: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#181818', textAlign: 'center' },
  slotTime: { fontSize: 11, lineHeight: 14, fontFamily: 'Inter-Regular', color: '#181818', textAlign: 'center', marginTop: 2 },
  slotTextMuted: { color: '#9B9B9B' },

  // Booking card
  bookingCard: { borderWidth: 1, borderColor: '#1E1E1E', backgroundColor: '#FFFFFF' },
  bookingCardTop: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderColor: '#1E1E1E' },
  bookingCardName: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#1E1E1E' },
  bookingCardBottom: { flexDirection: 'row', alignItems: 'center', minHeight: 46 },
  bookingCardDateTime: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#1E1E1E' },
  bookingCardDivider: { width: 1, alignSelf: 'stretch', backgroundColor: '#1E1E1E' },
  bookingCardPrice: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#1E1E1E', textAlign: 'right' },

  // Share popup
  shareCard: { borderWidth: 1, borderColor: '#1E1E1E', backgroundColor: '#FFFFFF' },
  shareUrl: { paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#1E1E1E' },
  shareCopiedText: { marginTop: 4, fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: '#181818' },
});
