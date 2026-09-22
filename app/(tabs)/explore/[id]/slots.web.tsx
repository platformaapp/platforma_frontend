import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PlusField } from '@/components/web/plus-field';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { endpoints } from '@/constants/env';
import { bindPaymentMethod, getPaymentMethods } from '@/lib/api/student-payments';
import { getPublicTutorList, getPublicTutors, getStudentTutorSlots } from '@/lib/api/tutor';
import { getAuthToken } from '@/lib/auth';
import { authedFetch } from '@/lib/authed-fetch';

type SlotItem = { id: string; rawDate: string; time: string; price?: number };

/**
 * Шаг веб-версии страницы "Слоты": "запись" (список, сгруппированный по
 * датам) → "Подтверждение" (выбранный слот) → "новая карта" (если карта не
 * привязана) → "оплата прошла" (успех) / "оплата не прошла" (ошибка оплаты —
 * "Сменить карту" ведёт на "новая карта", "Попробовать ещё раз" повторяет
 * попытку с той же картой). В макете это модальное окно поверх профиля
 * наставника; здесь — состояния одной страницы с тем же визуальным
 * оформлением (карточка на затемнённом фоне), т.к. в expo-router это
 * отдельный маршрут, а не оверлей над предыдущим экраном.
 */
type Step = 'pick' | 'confirm' | 'addCard' | 'success' | 'failed';

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function formatDateHeading(rawDate: string): string {
  const parts = rawDate.split('-');
  if (parts.length !== 3) return rawDate;
  const day = parseInt(parts[2], 10);
  const month = MONTHS_GEN[parseInt(parts[1], 10) - 1];
  return month ? `${day} ${month}` : rawDate;
}

/**
 * Веб-версия страницы "Слоты" (в макете — модальное окно поверх профиля
 * наставника). Логика бронирования/оплаты продублирована из
 * app/(tabs)/explore/[id].tsx (handleBook) — тот же эндпоинт и разбор ответа.
 * Привязка карты (шаг "новая карта") использует тот же bindPaymentMethod,
 * что и app/(tabs)/profile/payments.tsx — тоже уводит на хостед-страницу
 * YooKassa, вернуться на этот же шаг брони после привязки нельзя (return_url
 * настроен на бэкенде на страницу платежей). Поля "Номер карты"/MM-ГГ/CVV
 * ниже — визуальное соответствие макету: реальный ввод номера карты и CVV
 * должен идти через хостед-форму YooKassa (PCI DSS), поэтому значения этих
 * полей никуда не отправляются — кнопка "Оплата" всё равно просто запускает
 * тот же редирект на bindPaymentMethod().
 */
export default function TutorSlotsScreenWeb() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isMobile = useIsMobileWeb();

  const [mentorName, setMentorName] = useState('');
  const [mentorPrice, setMentorPrice] = useState('');
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SlotItem | null>(null);
  const [step, setStep] = useState<Step>('pick');
  const [isBooking, setIsBooking] = useState(false);
  const [bookError, setBookError] = useState('');
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [addCardError, setAddCardError] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [rememberCard, setRememberCard] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      try {
        const token = await getAuthToken();
        if (!token) { router.replace('/login' as any); return; }

        const [authList, publicList] = await Promise.all([getPublicTutorList(), getPublicTutors()]);
        const tutor = authList.find((t) => t.id === id) ?? publicList.find((t) => t.id === id);
        if (active && tutor) {
          setMentorName(tutor.fullName ?? '');
          const rate = (tutor as any).hourlyRate ?? (tutor as any).hourly_rate ?? (tutor as any).pricePerHour;
          if (typeof rate === 'number' && rate > 0) setMentorPrice(`${rate.toLocaleString('ru-RU')} ₽`);
        }

        const apiSlots = await getStudentTutorSlots(id);
        const nowTs = Date.now();
        const filtered = apiSlots.filter((s) => {
          if (s.status !== 'free' && s.status !== 'available') return false;
          return new Date(`${s.date}T${s.time}:00`).getTime() > nowTs;
        });
        if (active) setSlots(filtered.map((s) => ({ id: s.id, rawDate: s.date, time: s.time.slice(0, 5), price: s.price })));
      } catch (e: any) {
        if (active) setError(e?.message ?? 'Не удалось загрузить слоты');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id, router]);

  const groupedSlots = useMemo(() => {
    const map = new Map<string, SlotItem[]>();
    slots.forEach((s) => {
      const list = map.get(s.rawDate) ?? [];
      list.push(s);
      map.set(s.rawDate, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  function handleClose() {
    if (router.canGoBack()) router.back();
    else router.replace(`/(tabs)/explore/${id}` as any);
  }

  function handleNext() {
    if (!selected) return;
    setBookError('');
    setStep('confirm');
  }

  async function handleBook() {
    if (!selected || isBooking) return;
    setIsBooking(true);
    setBookError('');
    try {
      const cards = await getPaymentMethods();
      if (!cards.length) { setStep('addCard'); return; }
      const card = cards.find((c) => c.isDefault) ?? cards[0];

      const res = await authedFetch(endpoints.studentBookings, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: selected.id, payment_method_id: card.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) { setStep('success'); return; }
        throw new Error(data?.message ?? 'Повторите попытку или попробуйте оплатить с другой карты');
      }

      const confirmUrl = data?.confirmation_url ?? data?.confirmationUrl ?? data?.redirect_url ?? null;
      if (confirmUrl) {
        const w = (globalThis as any).window;
        if (w) w.location.href = confirmUrl;
        return;
      }
      setStep('success');
    } catch (e: any) {
      setBookError(e?.message ?? 'Повторите попытку или попробуйте оплатить с другой карты');
      setStep('failed');
    } finally {
      setIsBooking(false);
    }
  }

  async function handleAddCard() {
    if (isAddingCard) return;
    setIsAddingCard(true);
    setAddCardError('');
    try {
      const { confirmationUrl } = await bindPaymentMethod();
      const w = (globalThis as any).window;
      if (w) w.location.href = confirmationUrl;
    } catch (e: any) {
      setAddCardError(e?.message ?? 'Не удалось привязать карту');
    } finally {
      setIsAddingCard(false);
    }
  }

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.backdrop}>
        <View style={[styles.modalCard, isMobile && styles.modalCardMobile]}>
          <Pressable style={styles.closeButton} onPress={handleClose} hitSlop={8}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>

          {step === 'pick' ? (
            <>
              <Text style={styles.title}>{mentorName || 'Наставник'}</Text>
              <Text style={styles.subtitle}>Запись на встречу</Text>
              {mentorPrice ? <Text style={styles.price}>Стоимость консультации: {mentorPrice} в час</Text> : null}
            </>
          ) : (
            <Text style={[styles.title, step === 'failed' && styles.titleError]}>
              {step === 'confirm' ? 'Подтверждение записи'
                : step === 'addCard' ? 'Новая карта'
                : step === 'failed' ? 'Оплата не прошла'
                : 'Оплата прошла'}
            </Text>
          )}

          {loading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color="#010101" /></View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : step === 'success' ? (
            <View style={styles.successBody}>
              <Text style={styles.successText}>Чек отправили вам на почту</Text>
              <Text style={styles.successText}>Возврат возможен не позднее, чем за 24 часа до начала</Text>
            </View>
          ) : step === 'failed' ? (
            <View style={styles.failedBody}>
              <Text style={styles.failedMessage}>{bookError}</Text>
              <View style={styles.cardFooterRow}>
                <Pressable onPress={() => { setBookError(''); setStep('addCard'); }}>
                  <Text style={styles.changeCardLink}>Сменить карту</Text>
                </Pressable>
                <Pressable onPress={handleBook} disabled={isBooking}>
                  <Text style={[styles.payLink, isBooking && styles.payLinkDisabled]}>{isBooking ? 'Оплата…' : 'Попробовать ещё раз'}</Text>
                </Pressable>
              </View>
            </View>
          ) : step === 'addCard' ? (
            <View style={styles.cardForm}>
              <PlusField label="Номер карты" value={cardNumber} onChangeText={setCardNumber} keyboardType="numeric" />
              <View style={styles.cardRow}>
                <View style={styles.cardRowItem}>
                  <PlusField label="ММ/ГГ" value={cardExpiry} onChangeText={setCardExpiry} />
                </View>
                <View style={styles.cardRowItem}>
                  <PlusField label="CVV" value={cardCvv} onChangeText={setCardCvv} keyboardType="numeric" />
                </View>
              </View>

              {addCardError ? <Text style={styles.errorText}>{addCardError}</Text> : null}

              <View style={styles.cardFooterRow}>
                <Pressable style={styles.checkboxRow} onPress={() => setRememberCard((v) => !v)} hitSlop={8}>
                  <View style={[styles.checkboxCircle, rememberCard && styles.checkboxCircleActive]} />
                  <Text style={styles.checkboxLabel}>Запомнить карту</Text>
                </Pressable>
                <Pressable onPress={handleAddCard} disabled={isAddingCard}>
                  <Text style={[styles.payLink, isAddingCard && styles.payLinkDisabled]}>{isAddingCard ? 'Открываем…' : 'Оплатить'}</Text>
                </Pressable>
              </View>
            </View>
          ) : step === 'confirm' && selected ? (
            <View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmMentorName}>{mentorName || 'Наставник'}</Text>
                <Text style={styles.confirmDate}>{formatDateHeading(selected.rawDate)}, {selected.time}</Text>
              </View>
              {selected.price != null ? <Text style={styles.confirmPrice}>{selected.price.toLocaleString('ru-RU')} ₽</Text> : null}

              <Pressable style={styles.payLinkSpacing} onPress={handleBook} disabled={isBooking}>
                <Text style={[styles.payLink, isBooking && styles.payLinkDisabled]}>{isBooking ? 'Оплата…' : 'Оплатить'}</Text>
              </Pressable>
            </View>
          ) : groupedSlots.length === 0 ? (
            <Text style={styles.emptyText}>Нет доступных слотов</Text>
          ) : (
            <View>
              {groupedSlots.map(([rawDate, list]) => (
                <View key={rawDate} style={styles.dateGroup}>
                  <Text style={styles.dateHeading}>{formatDateHeading(rawDate)}</Text>
                  <View style={styles.timeRow}>
                    {list.map((slot) => {
                      const active = selected?.id === slot.id;
                      return (
                        <Pressable key={slot.id} style={[styles.timeChip, active && styles.timeChipActive]} onPress={() => setSelected(slot)}>
                          <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>{slot.time}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
              <Pressable
                style={[styles.nextLink, !selected && styles.nextLinkDisabled]}
                onPress={handleNext}
                disabled={!selected}
              >
                <Text style={[styles.nextLinkText, !selected && styles.nextLinkTextDisabled]}>Далее</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  backdrop: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 16, backgroundColor: 'rgba(24,24,24,0.45)' },
  modalCard: { width: '100%', maxWidth: 560, backgroundColor: '#fff', padding: 32 },
  modalCardMobile: { maxWidth: 420, padding: 20 },
  closeButton: { position: 'absolute', top: 16, right: 16, padding: 4 },
  closeText: { fontSize: 18, color: '#687076' },

  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
  subtitle: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#687076', marginTop: 4, marginBottom: 8 },
  price: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101', marginBottom: 24 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  errorText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#E02D2D', marginTop: 12, marginBottom: 4 },
  emptyText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#687076' },

  dateGroup: { marginTop: 20 },
  dateHeading: { fontSize: 14, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 10 },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { paddingVertical: 10, paddingHorizontal: 18, borderWidth: 1, borderColor: '#D6DBE0', borderRadius: 24 },
  timeChipActive: { backgroundColor: '#010101', borderColor: '#010101' },
  timeChipText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101' },
  timeChipTextActive: { color: '#FAFAFA' },

  nextLink: { alignSelf: 'flex-start', marginTop: 28 },
  nextLinkDisabled: { opacity: 0.5 },
  nextLinkText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 15, color: '#E02D2D' },
  nextLinkTextDisabled: { color: '#9B9B9B' },

  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  confirmMentorName: { fontSize: 15, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
  confirmDate: { fontSize: 15, fontFamily: 'Gramatika-Regular', color: '#010101' },
  confirmPrice: { fontSize: 15, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginTop: 8 },

  payLink: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 15, color: '#E02D2D' },
  payLinkDisabled: { color: '#9B9B9B' },
  payLinkSpacing: { alignSelf: 'flex-end', marginTop: 40 },

  cardForm: { marginTop: 8 },
  cardRow: { flexDirection: 'row', gap: 16 },
  cardRowItem: { flex: 1 },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 12 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkboxCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#D6DBE0' },
  checkboxCircleActive: { backgroundColor: '#010101', borderColor: '#010101' },
  checkboxLabel: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#687076' },

  successBody: { marginTop: 8, gap: 8 },
  successText: { fontSize: 14, lineHeight: 20, fontFamily: 'Gramatika-Regular', color: '#687076' },

  titleError: { color: '#E02D2D' },
  failedBody: { marginTop: 8 },
  failedMessage: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#E02D2D', marginBottom: 40 },
  changeCardLink: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101' },
});
