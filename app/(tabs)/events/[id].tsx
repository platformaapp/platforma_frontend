import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE, endpoints } from '@/constants/env';
import { getAuthRole, getAuthToken } from '@/lib/auth';

function resolveUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}
import { getPaymentMethods } from '@/lib/api/student-payments';
import { isRegisteredOnEventItem, parseFeedItems, unwrapApiData } from '@/lib/event-feed';

// ─── Types ───────────────────────────────────────────────────────────────────

type EventDetail = {
  id: string;
  title: string;
  description?: string;
  datetimeStart?: string;
  price?: number;
  coverUrl?: string | null;
  mentor?: { id: string; name: string; avatarUrl?: string | null; bio?: string };
  status?: string;
  isRegistered?: boolean;
  isPaid?: boolean;
  maxParticipants?: number;
  registeredCount?: number;
  // Video conference fields
  canJoin?: boolean;
  videoRoom?: { url?: string | null; moderatorUrl?: string | null };
  recordingUrl?: string | null;
  currentUserParticipation?: {
    status?: string;       // "registered" | "pending" | "attended"
    paymentStatus?: string; // "paid" | "pending"
  };
};

type FeedItem = {
  id: string;
  title: string;
  description?: string;
  datetimeStart?: string;
  price?: number;
  coverUrl?: string | null;
  mentor?: { id: string; name: string; avatarUrl?: string | null };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize raw API response (snake_case + various nesting) into EventDetail */
function normalizeEvent(raw: Record<string, unknown>): EventDetail {
  // Unwrap { data: { ... } } or { event: { ... } } envelope
  const unwrapped = unwrapApiData<Record<string, unknown>>(raw) ?? raw;

  const r = unwrapped as Record<string, unknown>;

  const datetimeStart =
    (r.datetimeStart as string) ??
    (r.datetime_start as string) ??
    (r.startAt as string) ??
    (r.start_at as string) ??
    undefined;

  const price =
    typeof r.price === 'number' ? r.price :
    typeof (r as any).price === 'string' ? parseFloat((r as any).price) :
    undefined;

  // Mentor / teacher
  const mentorRaw = (r.mentor ?? r.teacher ?? r.tutor) as Record<string, unknown> | undefined;
  const mentor = mentorRaw ? {
    id: String(mentorRaw.id ?? mentorRaw.userId ?? mentorRaw.user_id ?? ''),
    name: String(mentorRaw.name ?? mentorRaw.fullName ?? mentorRaw.full_name ?? mentorRaw.displayName ?? ''),
    avatarUrl: resolveUrl(mentorRaw.avatarUrl ?? mentorRaw.avatar_url),
    bio: (mentorRaw.bio ?? mentorRaw.description ?? '') as string,
  } : undefined;

  // Cover image
  const coverUrl = resolveUrl(r.coverUrl ?? r.cover_url ?? r.imageUrl ?? r.image_url ?? r.cover);

  // Payment status + participation (extract before isRegistered so we can use it)
  const cupRaw = (r.currentUserParticipation ?? r.current_user_participation) as Record<string, unknown> | undefined;
  const currentUserParticipation = cupRaw ? {
    status: (cupRaw.status as string) ?? undefined,
    paymentStatus: (cupRaw.paymentStatus ?? cupRaw.payment_status) as string | undefined,
  } : undefined;

  // Registration flag — check both top-level fields and current_user_participation
  // payment_status "pending" also means registered (payment in processing)
  const cupStatus = currentUserParticipation?.status?.toLowerCase();
  const cupPayStatus = currentUserParticipation?.paymentStatus?.toLowerCase();
  const registeredFromCup = cupStatus
    ? ['registered', 'confirmed', 'active', 'paid', 'attended', 'completed', 'pending'].includes(cupStatus)
    : (['paid', 'pending'].includes(cupPayStatus ?? ''));
  const isRegistered = isRegisteredOnEventItem(r) || registeredFromCup;

  const isPaid =
    currentUserParticipation?.paymentStatus?.toLowerCase() === 'paid' ||
    Boolean(r.isPaid ?? r.is_paid);

  // Video room
  const vrRaw = (r.videoRoom ?? r.video_room) as Record<string, unknown> | undefined;
  const videoRoom = vrRaw ? {
    url: (vrRaw.url ?? null) as string | null,
    moderatorUrl: (vrRaw.moderatorUrl ?? vrRaw.moderator_url ?? null) as string | null,
  } : undefined;

  const canJoin = Boolean(r.canJoin ?? r.can_join ?? false);
  const recordingUrl = (r.recordingUrl ?? r.recording_url ?? null) as string | null;

  return {
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    description: (r.description as string) ?? undefined,
    datetimeStart,
    price,
    coverUrl,
    mentor,
    status: (r.status as string) ?? undefined,
    isRegistered,
    isPaid,
    maxParticipants: typeof r.maxParticipants === 'number' ? r.maxParticipants
      : typeof r.max_participants === 'number' ? r.max_participants : undefined,
    registeredCount: typeof r.registeredCount === 'number' ? r.registeredCount
      : typeof r.registered_count === 'number' ? r.registered_count : undefined,
    canJoin,
    videoRoom,
    recordingUrl,
    currentUserParticipation,
  };
}

const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function formatDatetime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTHS_GEN[d.getMonth()];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${hh}:${mm}`;
  } catch { return iso ?? ''; }
}

function formatPrice(price?: number): string {
  if (price == null) return '';
  return `${price.toLocaleString('ru-RU')} ₽`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [otherEvents, setOtherEvents] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [isCardModalVisible, setCardModalVisible] = useState(false);
  const [isCardModalDoneVisible, setCardModalDoneVisible] = useState(false);
  const [isDonePaymentPending, setDonePaymentPending] = useState(false);
  const [isLinkTutorVisible, setLinkTutorVisible] = useState(false);
  const [isShareEventVisible, setShareEventVisible] = useState(false);
  const [isShareCopied, setIsShareCopied] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [isPaymentFailedModalVisible, setPaymentFailedModalVisible] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const loadEvent = async (active: { value: boolean }) => {
    try {
      // Public requests — no auth header (backend rejects auth on public routes)
      const [detailRes, feedRes] = await Promise.allSettled([
        fetch(`${endpoints.events}/${id}`),
        fetch(endpoints.eventsFeed),
      ]);

      if (detailRes.status === 'fulfilled' && detailRes.value.ok) {
        const raw = await detailRes.value.json();
        const normalized = normalizeEvent(raw as Record<string, unknown>);
        if (active.value) setEvent(normalized);
      }

      if (feedRes.status === 'fulfilled' && feedRes.value.ok) {
        const d = await feedRes.value.json();
        const items: FeedItem[] = parseFeedItems(d) as FeedItem[];
        if (active.value) setOtherEvents(items.filter((e) => e.id !== id).slice(0, 4));
      }

      // Overlay user-specific registration state (authenticated request to a private endpoint)
      const token = await getAuthToken();
      if (token && active.value) {
        const { getUserProfile } = await import('@/lib/auth');
        const profile = await getUserProfile().catch(() => null);
        if (active.value && profile?.id) setCurrentUserId(profile.id);

        // Fetch the same event with auth to get current_user_participation
        const authRes = await fetch(`${endpoints.events}/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);
        if (authRes?.ok && active.value) {
          const raw = await authRes.json();
          const normalized = normalizeEvent(raw as Record<string, unknown>);
          if (active.value) setEvent(normalized);
        }
      }
    } catch { /* ignore */ } finally {
      if (active.value) setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    const active = { value: true };
    loadEvent(active);
    return () => { active.value = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  async function handleLinkNow() {
    const token = await getAuthToken();
    if (!token) { router.push('/login'); return; }
    setCardModalVisible(true);
    setIsShareCopied(false);
    setPayError('');
  }

  function handleLinkTutor() { setLinkTutorVisible(true); }
  function handleShareEventTutor() { setIsShareCopied(false); setShareEventVisible(true); }

  async function handleGetPay() {
    if (isPaying || !event) return;
    setIsPaying(true);
    setPayError('');
    try {
      const [token, role, cards] = await Promise.all([
        getAuthToken(),
        getAuthRole(),
        getPaymentMethods(),
      ]);
      if (!token) throw new Error('Для оплаты нужно войти в аккаунт');

      if (!cards?.length) {
        setCardModalVisible(false);
        router.push('/(tabs)/profile/payments');
        return;
      }

      // Use the default card; fall back to first card
      const defaultCard = cards.find((c) => c.isDefault) ?? cards[0];

      const res = await fetch(`${endpoints.events}/${event.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payment_method_id: defaultCard.id }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          // Already registered — treat as success
          setEvent((prev) => prev ? { ...prev, isRegistered: true, isPaid: true } : prev);
          setCardModalVisible(false);
          setDonePaymentPending(false);
          setCardModalDoneVisible(true);
          return;
        }
        throw new Error(data?.message ?? `Ошибка регистрации (${res.status})`);
      }

      // 3DS redirect: open browser, then re-fetch event for real status
      const redirectUrl = data?.redirect_url ?? data?.confirmationUrl ?? data?.userEvent?.redirect_url;
      if (redirectUrl) {
        setCardModalVisible(false);
        await WebBrowser.openBrowserAsync(redirectUrl);
        const active = { value: true };
        await loadEvent(active);
        return;
      }

      // Check actual payment status from server response
      const payStatus = (data?.userEvent?.payment_status ?? data?.payment_status ?? '').toLowerCase();
      const isPendingPayment = payStatus === 'pending';

      setEvent((prev) => prev ? {
        ...prev,
        isRegistered: true,
        isPaid: !isPendingPayment,
        currentUserParticipation: isPendingPayment
          ? { status: 'pending', paymentStatus: 'pending' }
          : prev?.currentUserParticipation,
      } : prev);
      setCardModalVisible(false);
      setDonePaymentPending(isPendingPayment);
      setCardModalDoneVisible(true);
    } catch (e: any) {
      const rawMessage = e?.message ?? 'Не удалось зарегистрироваться';
      const message = rawMessage.toLowerCase().includes('token expired') ? 'Авторизуйтесь заново' : rawMessage;
      setPayError(message);
      setPaymentFailedModalVisible(true);
    } finally {
      setIsPaying(false);
    }
  }

  async function handleJoin() {
    if (isJoining || !event) return;
    setIsJoining(true);
    try {
      const token = await getAuthToken();
      if (!token) { router.push('/login'); return; }
      const res = await fetch(`${endpoints.events}/${event.id}/join`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const url = data?.join_url ?? data?.joinUrl ?? data?.url;
        if (url) { await Linking.openURL(url); return; }
      }
      // Fallback: use video_room.url if available
      const fallbackUrl = event.videoRoom?.url;
      if (fallbackUrl) await Linking.openURL(fallbackUrl);
    } catch { /* ignore */ } finally {
      setIsJoining(false);
    }
  }

  function handleCloseCard() {
    setCardModalDoneVisible(false);
    router.replace('/(tabs)/events');
  }

  const eventUrl = `https://platformaapp.ru/events/${id}`;
  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(eventUrl);
    setIsShareCopied(true);
  };

  // ─── Loading / not-found ─────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#181818" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <Pressable style={[styles.backButton, { top: insets.top + 12 }]} onPress={() => router.back()}>
          <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <Path d="M17.1436 21.9004L7.22266 12.0103L17.1436 2.09918" stroke="#181818"/>
          </Svg>
        </Pressable>
        <Text style={styles.errorText}>Событие не найдено</Text>
      </View>
    );
  }

  const isOwnEvent = currentUserId != null && event.mentor?.id === currentUserId;
  const paymentPending =
    event.isRegistered &&
    !event.isPaid &&
    event.currentUserParticipation?.paymentStatus === 'pending';

  // Allow joining when server says canJoin, OR when user is registered and event is
  // happening right now (server may return canJoin=false for pending-payment users)
  const MEETING_DURATION_MS = 90 * 60 * 1000;
  const JOIN_EARLY_MS = 15 * 60 * 1000;
  const eventStartMs = event.datetimeStart ? new Date(event.datetimeStart).getTime() : null;
  const nowMs = Date.now();
  const isEventHappening =
    eventStartMs != null &&
    nowMs >= eventStartMs - JOIN_EARLY_MS &&
    nowMs <= eventStartMs + MEETING_DURATION_MS;
  const canJoinEffective = event.canJoin || (event.isRegistered && isEventHappening);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Pressable style={[styles.backButton, { top: insets.top + 12 }]} onPress={() => router.replace('/(tabs)/events')}>
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <Path d="M17.1436 21.9004L7.22266 12.0103L17.1436 2.09918" stroke="#181818"/>
        </Svg>
      </Pressable>

      {/* Main Event Card */}
      <View style={[styles.mainCard, { marginTop: insets.top + 60 }]}>
        {event.coverUrl ? (
          <Image source={{ uri: event.coverUrl }} style={styles.mainImage} resizeMode="cover" />
        ) : (
          <View style={[styles.mainImage, styles.mainImagePlaceholder]} />
        )}
        <View style={styles.mainCardBody}>
          <Text style={styles.mainTitle}>{event.title}</Text>
          {event.description ? (
            <Text style={styles.mainDescription}>{event.description}</Text>
          ) : null}
        </View>
        <View style={styles.mainFooter}>
          <Text style={styles.mainFooterTime}>{formatDatetime(event.datetimeStart)}</Text>
          {event.price != null ? (
            <View style={styles.mainPriceContainer}>
              <Text style={styles.mainFooterPrice}>{formatPrice(event.price)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Join / Recording / Register button */}
      {event.recordingUrl ? (
        // Event ended — show recording
        <Pressable
          style={styles.joinButton}
          onPress={() => Linking.openURL(event.recordingUrl!)}
        >
          <Text style={styles.joinButtonText}>Смотреть запись</Text>
        </Pressable>
      ) : canJoinEffective ? (
        // Event is live (or starts in <15 min) — show join button
        <Pressable
          style={[styles.joinButton, isJoining && styles.joinButtonDisabled]}
          onPress={handleJoin}
          disabled={isJoining}
        >
          {isJoining ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.joinButtonText}>Войти в конференцию</Text>
          )}
        </Pressable>
      ) : isOwnEvent ? (
        <View style={[styles.registerButton, styles.registerButtonDisabled]}>
          <Text style={styles.registerButtonText}>Вы не можете зарегистрироваться на своё мероприятие</Text>
        </View>
      ) : (
        <Pressable
          style={[styles.registerButton, event.isRegistered && styles.registerButtonDisabled]}
          onPress={event.isRegistered ? undefined : handleLinkNow}
          disabled={event.isRegistered}
        >
          <Text style={styles.registerButtonText}>
            {event.isRegistered ? 'Вы уже зарегистрированы' : 'Зарегистрироваться'}
          </Text>
        </Pressable>
      )}

      {/* Payment pending notice */}
      {paymentPending ? (
        <View style={styles.paymentPendingBadge}>
          <Text style={styles.paymentPendingText}>Оплата в обработке</Text>
        </View>
      ) : null}

      {/* Curator Section */}
      {event.mentor && (
        <View style={styles.curatorSection}>
          <Pressable
            style={styles.curatorSectionWrapper}
            onPress={() => event.mentor?.id ? router.push(`/(tabs)/explore/${event.mentor.id}` as any) : undefined}
          >
            {event.mentor.avatarUrl ? (
              <Image source={{ uri: event.mentor.avatarUrl }} style={styles.curatorAvatar} />
            ) : (
              <View style={[styles.curatorAvatar, styles.curatorAvatarPlaceholder]} />
            )}
            <View style={[styles.curatorNameWrapper, { width: width - 96 - 32 - 16 }]}>
              <Text style={styles.curatorName}>{event.mentor.name}</Text>
              {event.mentor.bio ? (
                <Text style={styles.curatorRole}>{event.mentor.bio}</Text>
              ) : null}
            </View>
          </Pressable>
          <Pressable style={styles.writeToCuratorButton} onPress={handleLinkTutor}>
            <Text style={styles.writeToCuratorText}>Написать наставнику</Text>
          </Pressable>
        </View>
      )}

      {/* Share Button */}
      <Pressable style={styles.shareButton} onPress={handleShareEventTutor}>
        <Text style={styles.shareButtonText}>Поделиться событием</Text>
        <View style={styles.shareButtonIcon}>
          <Svg width="25" height="25" viewBox="0 0 25 25" fill="none">
            <Path d="M16.0961 11.2467H19.7603V22.203H5.10352V11.2467H8.76772M12.4319 2.66064L17.0381 7.26684M12.4319 2.66064L7.82569 7.26684M12.4319 2.66064V15.9086" stroke="#181818"/>
          </Svg>
        </View>
      </Pressable>

      {/* Other Events */}
      {otherEvents.length > 0 && (
        <>
          <Text style={styles.otherEventsTitle}>ДРУГИЕ СОБЫТИЯ</Text>
          {otherEvents.map((item) => (
            <Pressable
              key={item.id}
              style={styles.otherCard}
              onPress={() => router.replace(`/(tabs)/events/${item.id}`)}
            >
              {item.coverUrl ? (
                <Image source={{ uri: item.coverUrl }} style={styles.otherImage} resizeMode="cover" />
              ) : (
                <View style={[styles.otherImage, styles.otherImagePlaceholder]} />
              )}
              <View style={styles.otherCardBody}>
                <Text style={styles.otherCardTitleText}>{item.title}</Text>
                {item.description ? (
                  <Text style={styles.otherDescription} numberOfLines={2}>{item.description}</Text>
                ) : null}
              </View>
              <View style={styles.otherFooter}>
                <Text style={styles.otherFooterTime}>{formatDatetime(item.datetimeStart)}</Text>
                {item.price != null ? (
                  <View style={styles.otherPriceContainer}>
                    <Text style={styles.otherFooterPrice}>{formatPrice(item.price)}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          ))}
        </>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* Registration modal */}
      <Modal transparent animationType="fade" visible={isCardModalVisible} onRequestClose={() => setCardModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCardModalVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>РЕГИСТРАЦИЯ</Text>
            <View style={styles.modalEventCard}>
              <Text style={styles.modalEventTitle}>{event.title}</Text>
              <View style={styles.modalEventFooter}>
                <View style={styles.modalEventCell}>
                  <Text style={styles.modalEventText}>{formatDatetime(event.datetimeStart)}</Text>
                </View>
                <View style={[styles.modalEventCell, styles.modalEventCellRight]}>
                  <Text style={styles.modalEventText}>{formatPrice(event.price)}</Text>
                </View>
              </View>
            </View>
            {payError ? <Text style={styles.payErrorText}>{payError}</Text> : null}
            <Pressable
              style={[styles.modalPayButton, isPaying && styles.modalPayButtonDisabled]}
              onPress={handleGetPay}
              disabled={isPaying}
            >
              <Text style={styles.modalPayButtonText}>{isPaying ? 'Оплата...' : 'Оплатить'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Share event modal */}
      <Modal transparent animationType="fade" visible={isShareEventVisible} onRequestClose={() => setShareEventVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShareEventVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Поделиться событием</Text>
            <View style={styles.modalEventCard}>
              <Text style={styles.modalEventTitle}>{eventUrl}</Text>
            </View>
            {isShareCopied ? <Text style={styles.shareCopiedText}>Ссылка скопирована</Text> : null}
            <Pressable style={styles.modalPayButton} onPress={handleCopyLink}>
              <Text style={styles.modalPayButtonText}>Скопировать ссылку</Text>
            </Pressable>
            <Pressable style={[styles.writeToCuratorButton, { marginTop: 12 }]} onPress={() => setShareEventVisible(false)}>
              <Text style={styles.writeToCuratorText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Payment done / pending modal */}
      <Modal transparent animationType="fade" visible={isCardModalDoneVisible} onRequestClose={() => setCardModalDoneVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCardModalDoneVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {isDonePaymentPending ? 'Оплата в обработке' : 'Оплата прошла'}
            </Text>
            <View style={styles.modalEventCard}>
              <Text style={styles.modalEventTitle}>
                {isDonePaymentPending
                  ? 'Вы успешно зарегистрированы.\n\nОплата обрабатывается — это может занять несколько минут. Вы получите уведомление, когда платёж будет подтверждён.'
                  : 'Чек отправлен вам на почту.\n\nВозврат возможен не позднее, чем за 24 часа до начала'}
              </Text>
            </View>
            <Pressable style={styles.modalPayButton} onPress={handleCloseCard}>
              <Text style={styles.modalPayButtonText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Write to tutor modal */}
      <Modal transparent animationType="fade" visible={isLinkTutorVisible} onRequestClose={() => setLinkTutorVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setLinkTutorVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Пожалуйста, проводите встречи на платформе</Text>
            <View style={styles.modalEventCard}>
              <Text style={styles.modalEventTitle}>
                Мы оставили вам возможность связаться напрямую и уточнить нужные вопросы, но просим итоговые встречи проводить на нашей платформе.{'\n\n'}Иначе мы обидимся и не будем с вами дружить.
              </Text>
            </View>
            <Link href="https://t.me/p34forma" asChild>
              <Pressable style={styles.modalPayButton}>
                <Text style={styles.modalPayButtonText}>Окей, давайте дружить</Text>
              </Pressable>
            </Link>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Payment failed modal */}
      <Modal transparent animationType="fade" visible={isPaymentFailedModalVisible} onRequestClose={() => setPaymentFailedModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPaymentFailedModalVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.paymentFailedTitle}>ОПЛАТА НЕ ПРОШЛА</Text>
            <Text style={styles.paymentFailedMessage}>
              Повторите попытку или попробуйте привязать другую карту
            </Text>
            <Pressable
              style={styles.modalPayButton}
              onPress={() => { setPaymentFailedModalVisible(false); setCardModalVisible(true); }}
            >
              <Text style={styles.modalPayButtonText}>Попробовать еще раз</Text>
            </Pressable>
            <Pressable
              style={styles.modalSecondaryButton}
              onPress={() => {
                setPaymentFailedModalVisible(false);
                setCardModalVisible(false);
                router.push('/(tabs)/profile/payments');
              }}
            >
              <Text style={styles.modalSecondaryButtonText}>Сменить карту</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  contentContainer: { paddingBottom: 24, marginHorizontal: 16 },
  backButton: { position: 'absolute', top: 12, left: 0, zIndex: 1, padding: 8, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20 },
  errorText: { padding: 24, textAlign: 'center', fontFamily: 'Inter-Regular', fontSize: 16, color: '#181818', marginTop: 60 },

  mainCard: { backgroundColor: '#fff', marginTop: 60, marginBottom: 0, borderWidth: 1, borderColor: '#1E1E1E' },
  mainImage: { width: '100%', height: 250, borderBottomWidth: 1, borderColor: '#1E1E1E' },
  mainImagePlaceholder: { backgroundColor: '#E5E5E5' },
  mainCardBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, backgroundColor: '#fff' },
  mainTitle: { marginBottom: 14, fontSize: 20, lineHeight: 24, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#1E1E1E' },
  mainDescription: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#1E1E1E' },
  mainFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', minHeight: 46 },
  mainFooterTime: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#1E1E1E', borderColor: '#1E1E1E', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderBottomWidth: 0, borderLeftWidth: 0 },
  mainPriceContainer: { borderWidth: 1, borderColor: '#1E1E1E', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 0, borderRightWidth: 0 },
  mainFooterPrice: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#1E1E1E' },

  // Join conference / recording button (prominent, dark red)
  joinButton: { backgroundColor: '#E02D2D', paddingVertical: 16, alignItems: 'center', marginBottom: 8, minHeight: 52, justifyContent: 'center' },
  joinButtonDisabled: { opacity: 0.6 },
  joinButtonText: { fontSize: 16, fontFamily: 'Inter-Regular', fontWeight: '500', color: '#FFFFFF' },

  // Register button
  registerButton: { backgroundColor: '#181818', paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  registerButtonDisabled: { backgroundColor: '#9B9B9B' },
  registerButtonText: { fontSize: 16, fontFamily: 'Inter-Regular', fontWeight: '500', color: '#FFFFFF' },

  // Payment pending badge
  paymentPendingBadge: { backgroundColor: '#FFF3CD', borderWidth: 1, borderColor: '#F0C040', paddingVertical: 8, paddingHorizontal: 12, marginBottom: 16, alignItems: 'center' },
  paymentPendingText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#856404' },

  curatorSection: { alignItems: 'center', marginBottom: 24, width: '100%', marginTop: 16 },
  curatorSectionWrapper: { flexDirection: 'row', borderWidth: 1, borderColor: '#1E1E1E', width: '100%', borderBottomWidth: 0 },
  curatorAvatar: { width: 96, height: 96, borderRightWidth: 1, borderColor: '#1E1E1E' },
  curatorAvatarPlaceholder: { backgroundColor: '#E5E5E5' },
  curatorNameWrapper: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 },
  curatorName: { fontSize: 18, fontWeight: 'bold', fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 4 },
  curatorRole: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818', textAlign: 'center' },
  writeToCuratorButton: { borderWidth: 1, borderColor: '#1E1E1E', paddingHorizontal: 14, paddingVertical: 8, height: 52, width: '100%', justifyContent: 'center', alignItems: 'center' },
  writeToCuratorText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },

  shareButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#1E1E1E', marginBottom: 32 },
  shareButtonIcon: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderColor: '#1E1E1E' },
  shareButtonText: { fontSize: 20, fontFamily: 'Inter-Regular', color: '#181818', flex: 1, textAlign: 'center' },

  otherEventsTitle: { fontSize: 24, fontWeight: 'bold', fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 16 },
  otherCard: { backgroundColor: '#fff', marginBottom: 12, borderWidth: 1, borderColor: '#1E1E1E' },
  otherImage: { width: '100%', height: 200, borderBottomWidth: 1, borderColor: '#1E1E1E' },
  otherImagePlaceholder: { backgroundColor: '#E5E5E5' },
  otherCardBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  otherCardTitleText: { marginBottom: 14, fontSize: 20, lineHeight: 24, fontFamily: 'Inter-Regular', color: '#1E1E1E' },
  otherDescription: { fontSize: 14, lineHeight: 24, fontFamily: 'Inter-Regular', color: '#1E1E1E' },
  otherFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', minHeight: 44 },
  otherFooterTime: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#FFFFFF', backgroundColor: '#1E1E1E', paddingHorizontal: 16, paddingVertical: 10 },
  otherPriceContainer: { borderWidth: 1, borderColor: '#1E1E1E', paddingHorizontal: 14, paddingVertical: 8 },
  otherFooterPrice: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#1E1E1E' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  modalTitle: { marginBottom: 8, fontFamily: 'Inter-Regular', fontWeight: '700', fontSize: 28, textTransform: 'uppercase', lineHeight: 36, letterSpacing: -1, color: '#181818' },
  modalEventCard: { borderWidth: 1, borderColor: '#1E1E1E', backgroundColor: '#FFFFFF' },
  modalEventTitle: { paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#1E1E1E' },
  modalEventFooter: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#1E1E1E' },
  modalEventCell: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  modalEventCellRight: { borderLeftWidth: 1, borderColor: '#1E1E1E' },
  modalEventText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#1E1E1E' },
  modalPayButton: { marginTop: 16, backgroundColor: '#1E1E1E', paddingVertical: 14, alignItems: 'center' },
  modalPayButtonDisabled: { opacity: 0.6 },
  modalPayButtonText: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#FFFFFF' },
  modalSecondaryButton: { marginTop: 12, borderWidth: 1, borderColor: '#1E1E1E', paddingVertical: 14, alignItems: 'center', backgroundColor: '#fff' },
  modalSecondaryButtonText: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#181818' },
  payErrorText: { marginTop: 8, fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#E02D2D' },
  paymentFailedTitle: { marginBottom: 12, fontFamily: 'Inter-Regular', fontWeight: '700', fontSize: 28, textTransform: 'uppercase', lineHeight: 36, letterSpacing: -1, color: '#E2372A' },
  paymentFailedMessage: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#E2372A', marginBottom: 4 },
  shareCopiedText: { marginTop: 4, fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: '#181818' },
});
