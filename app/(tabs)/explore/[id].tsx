import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { API_BASE, endpoints } from '@/constants/env';

const OFERTA_URL = Platform.OS === 'web' ? '/oferta.pdf' : 'https://platformaapp.ru/oferta.pdf';
import { getPublicTutorList, getPublicTutors, getStudentTutorSlots } from '@/lib/api/tutor';
import { getPaymentMethods } from '@/lib/api/student-payments';
import { getAuthRole, getAuthToken, getUserProfile } from '@/lib/auth';
import { authedFetch } from '@/lib/authed-fetch';

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
const SLOT_COLS = 5;
const SLOT_GAP = 6;
const SLOT_PADDING = 16;

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
  const { width: screenWidth } = useWindowDimensions();
  // On web, content is constrained to 620px; on native use actual screen width
  const contentWidth = Platform.OS === 'web' ? Math.min(screenWidth, 620) : screenWidth;
  const slotWidth = (contentWidth - SLOT_PADDING * 2 - SLOT_GAP * (SLOT_COLS - 1)) / SLOT_COLS;

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
  const [payError, setPayError] = useState('');
  const [isPaySuccess, setIsPaySuccess] = useState(false);
  const [isPayFailed, setIsPayFailed] = useState(false);
  const [isShareVisible, setShareVisible] = useState(false);
  const [isShareCopied, setShareCopied] = useState(false);

  const [mentorEvents, setMentorEvents] = useState<MentorEvent[]>([]);

  const profileUrl = `https://platformaapp.ru/explore/${id ?? ''}`;

  useEffect(() => {
    if (!id) return;
    let active = true;

    const load = async () => {
      try {
        const [viewerRole, profile, authList, publicList] = await Promise.all([
          getAuthRole(),
          getUserProfile(),
          getPublicTutorList(),
          getPublicTutors(),
        ]);
        if (active) {
          setIsTutor(viewerRole === 'tutor');
          setIsOwnProfile(profile?.id === id);
        }

        // Find tutor in authenticated list first; fall back to public list (no auth needed)
        const tutor = authList.find((t) => t.id === id) ?? publicList.find((t) => t.id === id);
        if (active && tutor) {
          setDisplayName(tutor.fullName ?? '');
          const roleLabel = (tutor as any).shortBio ?? (tutor as any).short_bio ?? (tutor as any).roleLabel ?? (tutor as any).role_label ?? (tutor as any).specialty ?? '';
          setDisplayRole(roleLabel);
          setDisplayBio((tutor as any).bio ?? '');
          setAvatarUrl(tutor.avatarUrl ?? '');
          const rate = (tutor as any).hourlyRate ?? (tutor as any).hourly_rate ?? (tutor as any).pricePerHour;
          if (typeof rate === 'number' && rate > 0) {
            setDisplayPrice(`${rate.toLocaleString('ru-RU')} ₽ в час`);
          }
          const tg = (tutor as any).telegram ?? (tutor as any).telegramUsername ?? (tutor as any).telegram_username ?? '';
          setTelegramHandle(tg.replace(/^@/, ''));
          if (active) setIsMentorVerified((tutor as any).isVerified !== false);
        }

        // Fetch mentor's events from eventsFeed (includes mentor data) and filter client-side
        try {
          const feedRes = await fetch(endpoints.eventsFeed);
          if (feedRes.ok) {
            const data = await feedRes.json();
            let rawItems: unknown = data.items ?? data.data ?? data;
            if (!Array.isArray(rawItems) && rawItems && typeof rawItems === 'object') {
              const inner = rawItems as Record<string, unknown>;
              rawItems = inner.items ?? inner.data ?? [];
            }
            const list = Array.isArray(rawItems) ? rawItems : [];
            const mentorId = String(id);
            const events: MentorEvent[] = list
              .filter((r: any) => {
                const mentorRaw = r.mentor ?? r.teacher ?? r.tutor;
                const mId = String(
                  mentorRaw?.id ?? mentorRaw?.userId ?? mentorRaw?.user_id ??
                  r.tutorId ?? r.tutor_id ?? r.mentorId ?? r.mentor_id ?? ''
                );
                return mId === mentorId;
              })
              .map((r: any) => ({
                id: String(r.id ?? ''),
                title: String(r.title ?? ''),
                datetimeStart: r.datetimeStart ?? r.datetime_start ?? r.startAt ?? r.start_at ?? undefined,
                price: typeof r.price === 'number' ? r.price : typeof r.price === 'string' ? parseFloat(r.price) || undefined : undefined,
                coverUrl: resolveCover(r.coverUrl ?? r.cover_url ?? r.imageUrl ?? r.image_url ?? r.cover ?? r.thumbnail),
              }))
              .filter((e: MentorEvent) => e.id);
            if (active) setMentorEvents(events);
          }
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
        if (s.status !== 'free' && s.status !== 'available') return false;
        const slotTs = new Date(`${s.date}T${s.time}:00`).getTime();
        return slotTs > nowTs;
      });
      setSlots(filtered.map((s) => ({
        id: s.id,
        date: formatSlotDate(s.date),
        time: s.time.slice(0, 5),
        price: s.price,
        status: 'available',
      })));
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      const isForbidden = msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('403') || e?.status === 403;
      setSlotsError(isForbidden ? 'Нет доступных слотов' : (msg || 'Не удалось загрузить слоты'));
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

    // iOS: avoid Apple's 30% commission — redirect to web
    if (Platform.OS === 'ios') {
      setSelectedSlot(null);
      Linking.openURL(`https://platformaapp.ru/explore/${id ?? ''}`);
      return;
    }

    setIsBooking(true);
    setPayError('');
    try {
      const cards = await getPaymentMethods();
      if (!cards.length) {
        // No card linked — send to payments screen to add one
        setSelectedSlot(null);
        router.push('/(tabs)/profile/payments' as any);
        return;
      }
      const card = cards.find((c) => c.isDefault) ?? cards[0];

      const res = await authedFetch(endpoints.studentBookings, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: selectedSlot.id, payment_method_id: card.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          // Slot already booked by this user — treat as success
          setSelectedSlot(null);
          setIsPaySuccess(true);
          return;
        }
        throw new Error(data?.message ?? `Ошибка бронирования (${res.status})`);
      }

      // Handle 3DS confirmation redirect
      const confirmUrl =
        data?.confirmation_url ?? data?.confirmationUrl ??
        data?.redirect_url ?? data?.booking?.confirmation_url ?? null;
      if (confirmUrl) {
        setSelectedSlot(null);
        if (Platform.OS === 'web') {
          (globalThis as any).window.location.href = confirmUrl;
          return;
        }
        await WebBrowser.openBrowserAsync(confirmUrl);
        // After browser closes, check what the backend says about payment status
        const payStatusAfter = (
          data?.payment_status ?? data?.booking?.payment_status ?? ''
        ).toLowerCase();
        if (payStatusAfter === 'failed' || payStatusAfter === 'cancelled') {
          setIsPayFailed(true);
        } else {
          setIsPaySuccess(true);
        }
        return;
      }

      // No redirect — check status from response
      const payStatus = (
        data?.payment_status ?? data?.booking?.payment_status ?? data?.status ?? ''
      ).toLowerCase();
      setSelectedSlot(null);
      if (payStatus === 'failed' || payStatus === 'cancelled' || payStatus === 'canceled') {
        setIsPayFailed(true);
      } else {
        setIsPaySuccess(true);
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Не удалось оплатить встречу';
      setPayError(msg);
      setIsPayFailed(true);
      setSelectedSlot(null);
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
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Pressable style={[styles.backButton, { top: insets.top + 12 }]} onPress={() => router.back()}>
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <Path d="M15 18L9 12L15 6" stroke="#181818" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Image source={imageSource} style={styles.heroImage} resizeMode="cover" />

      <View style={styles.infoBox}>
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
      </View>

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
          <Svg width="22" height="22" viewBox="0 0 25 25" fill="none">
            <Path d="M16.0961 11.2467H19.7603V22.203H5.10352V11.2467H8.76772M12.4319 2.66064L17.0381 7.26684M12.4319 2.66064L7.82569 7.26684M12.4319 2.66064V15.9086" stroke="#181818"/>
          </Svg>
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
                      style={[styles.slotCard, { width: slotWidth, height: slotWidth * 0.9 }, !isAvailable && styles.slotCardUnavailable]}
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
            <Text style={styles.legalText}>
              {'Нажимая «Оплатить», вы принимаете '}
              <Text style={styles.legalLink} onPress={() => WebBrowser.openBrowserAsync(OFERTA_URL)}>оферту</Text>
              {' и условия сервиса'}
            </Text>
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

      {/* ─── Payment success ─────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={isPaySuccess} onRequestClose={() => setIsPaySuccess(false)}>
        <Pressable style={styles.overlay} onPress={() => setIsPaySuccess(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>ВСТРЕЧА{'\n'}ЗАБРОНИРОВАНА</Text>
            <View style={styles.bookingCard}>
              <View style={styles.bookingCardTop}>
                <Text style={styles.bookingCardName}>{displayName || 'Наставник'}</Text>
              </View>
              <View style={styles.bookingCardBottom}>
                <Text style={styles.bookingCardDateTime}>Чек придёт на почту</Text>
                <View style={styles.bookingCardDivider} />
                <Text style={styles.bookingCardPrice}>Возврат до 24 ч</Text>
              </View>
            </View>
            <Pressable
              style={styles.sheetPrimaryButton}
              onPress={() => { setIsPaySuccess(false); router.push('/(tabs)/myevents' as any); }}
            >
              <Text style={styles.sheetPrimaryButtonText}>Мои записи</Text>
            </Pressable>
            <Pressable style={styles.sheetSecondaryButton} onPress={() => setIsPaySuccess(false)}>
              <Text style={styles.sheetSecondaryButtonText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Payment failed ───────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={isPayFailed} onRequestClose={() => setIsPayFailed(false)}>
        <Pressable style={styles.overlay} onPress={() => setIsPayFailed(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={[styles.sheetTitle, styles.sheetTitleRed]}>ОПЛАТА{'\n'}НЕ ПРОШЛА</Text>
            {payError ? (
              <View style={styles.bookingCard}>
                <Text style={styles.payErrorText}>{payError}</Text>
              </View>
            ) : (
              <View style={styles.bookingCard}>
                <Text style={styles.payErrorText}>Повторите попытку или привяжите другую карту</Text>
              </View>
            )}
            <Pressable
              style={styles.sheetPrimaryButton}
              onPress={() => {
                setIsPayFailed(false);
                setPayError('');
                // Re-open slot selection so user can try again
                setShowSlots(true);
              }}
            >
              <Text style={styles.sheetPrimaryButtonText}>Попробовать снова</Text>
            </Pressable>
            <Pressable
              style={styles.sheetSecondaryButton}
              onPress={() => { setIsPayFailed(false); router.push('/(tabs)/profile/payments' as any); }}
            >
              <Text style={styles.sheetSecondaryButtonText}>Сменить карту</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  contentContainer: { paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  backButton: {
    position: 'absolute', left: 16, zIndex: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },

  heroImage: { width: '100%', aspectRatio: 1, maxHeight: 600, backgroundColor: '#E5E5E5' },

  infoBox: { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderColor: '#1E1E1E' },
  nameRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  name: { fontSize: 18, lineHeight: 24, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 4 },
  roleText: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#181818' },

  bioSection: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderColor: '#1E1E1E' },
  bioText: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },

  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderColor: '#1E1E1E',
  },
  priceLabel: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#181818' },
  priceValue: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#181818' },

  primaryButton: { marginHorizontal: 16, marginTop: 16, backgroundColor: '#111', height: 52, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#FAFAFA' },

  tutorBlockedRow: { marginHorizontal: 16, marginTop: 16, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#C8C8C8', backgroundColor: '#F5F5F5' },
  tutorBlockedText: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#9B9B9B', textAlign: 'center' },

  secondaryButton: { marginHorizontal: 16, marginTop: 12, height: 52, backgroundColor: '#181818', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#FAFAFA' },

  eventsSection: { marginTop: 20, marginHorizontal: 16, marginBottom: 4 },
  eventsSectionTitle: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818', marginBottom: 12, borderBottomWidth: 1, borderColor: '#1E1E1E', paddingBottom: 8 },
  eventCard: { flexDirection: 'row', borderWidth: 1, borderColor: '#1E1E1E', marginBottom: 10, backgroundColor: '#fff' },
  eventCover: { width: 80, alignSelf: 'stretch' },
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
  slotCard: { borderWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', position: 'relative' },
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

  sheetTitleRed: { color: '#E02D2D' },
  payErrorText: { paddingHorizontal: 16, paddingVertical: 16, fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#E02D2D' },
  legalText: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#9B9B9B', textAlign: 'center', marginTop: 12 },
  legalLink: { color: '#181818', textDecorationLine: 'underline' },
});
