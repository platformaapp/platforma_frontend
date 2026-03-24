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

import { endpoints } from '@/constants/env';
import { getAuthRole, getAuthToken } from '@/lib/auth';
import { getStudentPayments } from '@/lib/api/student-payments';

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

function formatDatetime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('ru-RU', { month: 'long' });
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

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [otherEvents, setOtherEvents] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCardModalVisible, setCardModalVisible] = useState(false);
  const [isCardModalDoneVisible, setCardModalDoneVisible] = useState(false);
  const [isLinkTutorVisible, setLinkTutorVisible] = useState(false);
  const [isShareEventVisible, setShareEventVisible] = useState(false);
  const [isShareCopied, setIsShareCopied] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [isPaymentFailedModalVisible, setPaymentFailedModalVisible] = useState(false);

  // Load event + feed
  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = async () => {
      try {
        const token = await getAuthToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        const [detailRes, feedRes] = await Promise.allSettled([
          fetch(`${endpoints.events}/${id}`, { headers }),
          fetch(endpoints.eventsFeed, { headers }),
        ]);

        if (detailRes.status === 'fulfilled' && detailRes.value.ok) {
          const d = await detailRes.value.json();
          if (active) setEvent(d);
        }

        if (feedRes.status === 'fulfilled' && feedRes.value.ok) {
          const d = await feedRes.value.json();
          const items: FeedItem[] = Array.isArray(d) ? d : (d?.items ?? []);
          if (active) setOtherEvents(items.filter((e) => e.id !== id).slice(0, 4));
        }
      } catch { /* ignore */ } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  async function handleLinkNow() {
    const token = await getAuthToken();
    if (!token) { router.push('/login'); return; }
    setCardModalVisible(true);
    setIsShareCopied(false);
    setPayError('');
  }

  function handleLinkTutor() {
    setLinkTutorVisible(true);
    setIsShareCopied(false);
  }

  function handleShareEventTutor() {
    setIsShareCopied(false);
    setShareEventVisible(true);
  }

  async function handleGetPay() {
    if (isPaying || !event) return;
    setIsPaying(true);
    setIsShareCopied(false);
    setPayError('');
    try {
      const [token, role, paymentsData] = await Promise.all([
        getAuthToken(),
        getAuthRole(),
        getStudentPayments(),
      ]);
      if (!token) throw new Error('Для оплаты нужно войти в аккаунт');
      if (role && role !== 'student') throw new Error('Оплата доступна только для студентов');

      if (!paymentsData.cards?.length) {
        setCardModalVisible(false);
        router.push('/(tabs)/profile/payments');
        return;
      }

      // POST /api/events/{id}/register — correct event registration endpoint
      const res = await fetch(`${endpoints.events}/${event.id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payment_method_id: paymentsData.cards[0].id }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          // Already registered — treat as success
          setCardModalVisible(false);
          setCardModalDoneVisible(true);
          return;
        }
        throw new Error(data?.message ?? `Ошибка регистрации (${res.status})`);
      }

      if (data?.redirect_url) {
        await WebBrowser.openBrowserAsync(data.redirect_url);
      }

      setCardModalVisible(false);
      setCardModalDoneVisible(true);
    } catch (e: any) {
      const rawMessage = e?.message ?? 'Не удалось оплатить';
      const message = rawMessage.toLowerCase().includes('token expired')
        ? 'Авторизуйтесь заново'
        : rawMessage;
      setPayError(message);
      setPaymentFailedModalVisible(true);
    } finally {
      setIsPaying(false);
    }
  }

  function handleCloseCard() {
    setCardModalDoneVisible(false);
    router.replace('/(tabs)/events');
  }

  const eventUrl = Linking.createURL(`/events/${id}`);
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
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <Path d="M17.1436 21.9004L7.22266 12.0103L17.1436 2.09918" stroke="#181818"/>
          </Svg>
        </Pressable>
        <Text style={styles.errorText}>Событие не найдено</Text>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Pressable style={styles.backButton} onPress={() => router.replace('/(tabs)/events')}>
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <Path d="M17.1436 21.9004L7.22266 12.0103L17.1436 2.09918" stroke="#181818"/>
        </Svg>
      </Pressable>

      {/* Main Event Card */}
      <View style={styles.mainCard}>
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

      {/* Register Button */}
      <Pressable style={styles.registerButton} onPress={handleLinkNow}>
        <Text style={styles.registerButtonText}>
          {event.isRegistered ? 'Вы записаны' : 'Зарегистрироваться'}
        </Text>
      </Pressable>

      {/* Curator Section */}
      {event.mentor && (
        <View style={styles.curatorSection}>
          <View style={styles.curatorSectionWrapper}>
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
          </View>
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
      <Modal transparent animationType="none" visible={isCardModalVisible} onRequestClose={() => setCardModalVisible(false)}>
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
      <Modal transparent animationType="none" visible={isShareEventVisible} onRequestClose={() => setShareEventVisible(false)}>
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

      {/* Payment done modal */}
      <Modal transparent animationType="none" visible={isCardModalDoneVisible} onRequestClose={() => setCardModalDoneVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCardModalDoneVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Оплата прошла</Text>
            <View style={styles.modalEventCard}>
              <Text style={styles.modalEventTitle}>
                Чек отправлен вам на почту.{'\n\n'}Возврат возможен не позднее, чем за 24 часа до начала
              </Text>
            </View>
            <Pressable style={styles.modalPayButton} onPress={handleCloseCard}>
              <Text style={styles.modalPayButtonText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Write to tutor modal */}
      <Modal transparent animationType="none" visible={isLinkTutorVisible} onRequestClose={() => setLinkTutorVisible(false)}>
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
      <Modal transparent animationType="none" visible={isPaymentFailedModalVisible} onRequestClose={() => setPaymentFailedModalVisible(false)}>
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

  registerButton: { backgroundColor: '#181818', paddingVertical: 16, alignItems: 'center', marginBottom: 24 },
  registerButtonText: { fontSize: 16, fontFamily: 'Inter-Regular', fontWeight: '500', color: '#FFFFFF' },

  curatorSection: { alignItems: 'center', marginBottom: 24, width: '100%' },
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
  payErrorText: { marginTop: 8, fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  paymentFailedTitle: { marginBottom: 12, fontFamily: 'Inter-Regular', fontWeight: '700', fontSize: 28, textTransform: 'uppercase', lineHeight: 36, letterSpacing: -1, color: '#E2372A' },
  paymentFailedMessage: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#E2372A' },
  shareCopiedText: { marginTop: 4, fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: '#181818' },
});
