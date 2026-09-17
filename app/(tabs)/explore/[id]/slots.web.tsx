import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
 * привязана) → "оплата прошла" (успех). В макете это модальное окно поверх
 * профиля наставника; здесь — состояния одной страницы с тем же визуальным
 * оформлением (карточка на затемнённом фоне), т.к. в expo-router это
 * отдельный маршрут, а не оверлей над предыдущим экраном.
 */
type Step = 'pick' | 'confirm' | 'addCard' | 'success';

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
 * настроен на бэкенде на страницу платежей), поэтому шаг лишь готовит
 * пользователя к редиректу, а не имитирует ввод номера карты в самом приложении.
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

  function handleBackToPick() {
    setBookError('');
    setStep('pick');
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
        throw new Error(data?.message ?? `Ошибка бронирования (${res.status})`);
      }

      const confirmUrl = data?.confirmation_url ?? data?.confirmationUrl ?? data?.redirect_url ?? null;
      if (confirmUrl) {
        const w = (globalThis as any).window;
        if (w) w.location.href = confirmUrl;
        return;
      }
      setStep('success');
    } catch (e: any) {
      setBookError(e?.message ?? 'Не удалось оплатить встречу');
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

          <Text style={styles.title}>{mentorName || 'Наставник'}</Text>
          <Text style={styles.subtitle}>
            {step === 'confirm' ? 'Подтверждение записи' : step === 'addCard' ? 'Привязка карты' : step === 'success' ? 'Оплата прошла' : 'Запись на встречу'}
          </Text>
          {mentorPrice && step === 'pick' ? <Text style={styles.price}>Стоимость консультации: {mentorPrice} в час</Text> : null}

          {loading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : step === 'success' ? (
            <View>
              <Text style={styles.successText}>Чек придёт на почту. Возврат возможен в течение 24 часов.</Text>
              <Pressable style={styles.primaryButton} onPress={() => router.push('/myevents' as any)}>
                <Text style={styles.primaryButtonText}>Мои записи</Text>
              </Pressable>
            </View>
          ) : step === 'addCard' ? (
            <View>
              <Text style={styles.successText}>
                Чтобы оплатить встречу{selected ? ` ${formatDateHeading(selected.rawDate)} в ${selected.time}` : ''}, привяжите карту — вы будете перенаправлены на страницу оплаты YooKassa.
              </Text>
              {addCardError ? <Text style={styles.errorText}>{addCardError}</Text> : null}
              <Pressable style={[styles.primaryButton, isAddingCard && styles.btnDisabled]} onPress={handleAddCard} disabled={isAddingCard}>
                <Text style={styles.primaryButtonText}>{isAddingCard ? 'Открываем…' : 'Привязать карту'}</Text>
              </Pressable>
              <Pressable onPress={() => setStep('confirm')} style={styles.backLinkSpacing}>
                <Text style={styles.backLink}>Назад</Text>
              </Pressable>
            </View>
          ) : step === 'confirm' && selected ? (
            <View>
              <Text style={styles.confirmLabel}>Дата и время</Text>
              <Text style={styles.confirmText}>{formatDateHeading(selected.rawDate)} в {selected.time}</Text>
              {selected.price != null ? (
                <>
                  <Text style={styles.confirmLabel}>Стоимость</Text>
                  <Text style={styles.confirmText}>{selected.price.toLocaleString('ru-RU')} ₽</Text>
                </>
              ) : null}
              <Text style={styles.cancellationNote}>Возврат возможен в течение 24 часов после оплаты.</Text>
              {bookError ? <Text style={styles.errorText}>{bookError}</Text> : null}
              <Pressable style={[styles.primaryButton, isBooking && styles.btnDisabled]} onPress={handleBook} disabled={isBooking}>
                <Text style={styles.primaryButtonText}>{isBooking ? 'Оплата…' : 'Оплатить'}</Text>
              </Pressable>
              <Pressable onPress={handleBackToPick} style={styles.backLinkSpacing}>
                <Text style={styles.backLink}>Изменить время</Text>
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
  modalCard: { width: '100%', maxWidth: 560, backgroundColor: '#fff', borderRadius: 12, padding: 32 },
  modalCardMobile: { maxWidth: 420, padding: 20, borderRadius: 8 },
  closeButton: { position: 'absolute', top: 16, right: 16, padding: 4 },
  closeText: { fontSize: 18, color: '#687076' },

  title: { fontSize: 24, fontFamily: 'Inter-Bold', color: '#181818' },
  subtitle: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#687076', marginTop: 4, marginBottom: 8 },
  price: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 24 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D', marginTop: 12, marginBottom: 4 },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#687076' },

  dateGroup: { marginTop: 20 },
  dateHeading: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#181818', marginBottom: 10 },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { paddingVertical: 10, paddingHorizontal: 18, borderWidth: 1, borderColor: '#D6DBE0', borderRadius: 24 },
  timeChipActive: { backgroundColor: '#181818', borderColor: '#181818' },
  timeChipText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  timeChipTextActive: { color: '#FAFAFA' },

  nextLink: { alignSelf: 'flex-start', marginTop: 28 },
  nextLinkDisabled: { opacity: 0.5 },
  nextLinkText: { fontFamily: 'Inter-Medium', fontSize: 15, color: '#E02D2D' },
  nextLinkTextDisabled: { color: '#9B9B9B' },

  confirmLabel: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 2 },
  confirmText: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#181818', marginBottom: 12 },
  cancellationNote: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 16 },
  primaryButton: { backgroundColor: '#E02D2D', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  primaryButtonText: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#FFFFFF' },
  backLinkSpacing: { marginTop: 16, alignSelf: 'flex-start' },
  backLink: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#687076' },
  successText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#687076', marginBottom: 16 },
});
