import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { endpoints } from '@/constants/env';
import { bindPaymentMethod, getPaymentMethods } from '@/lib/api/student-payments';
import { getPublicTutorList, getPublicTutors, getStudentTutorSlots } from '@/lib/api/tutor';
import { getAuthToken } from '@/lib/auth';
import { authedFetch } from '@/lib/authed-fetch';

type SlotItem = { id: string; date: string; time: string; price?: number };

/**
 * Шаг веб-версии страницы "Слоты": "запись" (список) → "Подтверждение"
 * (выбранный слот) → "новая карта" (если карта не привязана) → "оплата
 * прошла" (успех). В макете это отдельные экраны; здесь — состояния одной
 * страницы (см. описание файла ниже).
 */
type Step = 'pick' | 'confirm' | 'addCard' | 'success';

function formatSlotDate(apiDate: string): string {
  const parts = apiDate.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}` : apiDate;
}

/**
 * Веб-версия страницы "Слоты" (в макете — отдельная страница, а не модалка,
 * как в нативном приложении). Логика бронирования/оплаты продублирована из
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
        if (active) setSlots(filtered.map((s) => ({ id: s.id, date: formatSlotDate(s.date), time: s.time.slice(0, 5), price: s.price })));
      } catch (e: any) {
        if (active) setError(e?.message ?? 'Не удалось загрузить слоты');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id, router]);

  function handleSelectSlot(slot: SlotItem) {
    setSelected(slot);
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, isMobile && styles.titleMobile]}>{mentorName || 'Наставник'}</Text>
        <Text style={styles.subtitle}>
          {step === 'confirm' ? 'Подтверждение записи' : step === 'addCard' ? 'Привязка карты' : step === 'success' ? 'Оплата прошла' : 'Запись на встречу'}
        </Text>
        {mentorPrice && step === 'pick' ? <Text style={styles.price}>Стоимость консультации: {mentorPrice} в час</Text> : null}

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : step === 'success' ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Встреча забронирована</Text>
            <Text style={styles.successText}>Чек придёт на почту. Возврат возможен в течение 24 часов.</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/myevents' as any)}>
              <Text style={styles.primaryButtonText}>Мои записи</Text>
            </Pressable>
          </View>
        ) : step === 'addCard' ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Нет привязанной карты</Text>
            <Text style={styles.successText}>
              Чтобы оплатить встречу{selected ? ` ${selected.date} в ${selected.time}` : ''}, привяжите карту — вы будете перенаправлены на страницу оплаты YooKassa.
            </Text>
            {addCardError ? <Text style={styles.errorText}>{addCardError}</Text> : null}
            <Pressable style={[styles.primaryButton, isAddingCard && styles.btnDisabled]} onPress={handleAddCard} disabled={isAddingCard}>
              <Text style={styles.primaryButtonText}>{isAddingCard ? 'Открываем…' : 'Привязать карту'}</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, isMobile && styles.secondaryButtonMobile, styles.backButtonSpacing]}
              onPress={() => setStep('confirm')}
            >
              <Text style={[styles.secondaryButtonText, isMobile && styles.secondaryButtonTextMobile]}>Назад</Text>
            </Pressable>
          </View>
        ) : step === 'confirm' && selected ? (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmLabel}>Дата и время</Text>
            <Text style={styles.confirmText}>{selected.date} в {selected.time}</Text>
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
            <Pressable
              style={[styles.secondaryButton, isMobile && styles.secondaryButtonMobile, styles.backButtonSpacing]}
              onPress={handleBackToPick}
            >
              <Text style={[styles.secondaryButtonText, isMobile && styles.secondaryButtonTextMobile]}>Изменить время</Text>
            </Pressable>
          </View>
        ) : slots.length === 0 ? (
          <Text style={styles.emptyText}>Нет доступных слотов</Text>
        ) : (
          <View style={styles.slotGrid}>
            {slots.map((slot) => {
              const active = selected?.id === slot.id;
              return (
                <Pressable key={slot.id} style={[styles.slotCard, active && styles.slotCardActive]} onPress={() => handleSelectSlot(slot)}>
                  <Text style={[styles.slotDate, active && styles.slotTextActive]}>{slot.date}</Text>
                  <Text style={[styles.slotTime, active && styles.slotTextActive]}>{slot.time}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 48, maxWidth: 640 },
  title: { fontSize: 24, fontFamily: 'Inter-Bold', color: '#181818' },
  titleMobile: { fontSize: 20 },
  subtitle: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#687076', marginTop: 4, marginBottom: 8 },
  price: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 24 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D', marginTop: 12, marginBottom: 4 },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#687076' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24, marginTop: 16 },
  slotCard: { width: 84, height: 76, borderWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
  slotCardActive: { backgroundColor: '#181818' },
  slotDate: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818' },
  slotTime: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#181818', marginTop: 2 },
  slotTextActive: { color: '#FAFAFA' },
  confirmBox: { borderWidth: 1, borderColor: '#1E1E1E', padding: 20, marginTop: 16 },
  confirmLabel: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 2 },
  confirmText: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#181818', marginBottom: 12 },
  cancellationNote: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 16 },
  primaryButton: { backgroundColor: '#E02D2D', paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  primaryButtonText: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#FFFFFF' },
  secondaryButton: { borderWidth: 1, borderColor: '#181818', paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
  // Mobile action-button convention: plain bordered/text buttons become a
  // filled light-blue chip on narrow widths (see MOBILE_BREAKPOINT usages).
  secondaryButtonMobile: { borderWidth: 0, backgroundColor: '#F0F5FB' },
  secondaryButtonTextMobile: { color: '#68717A' },
  backButtonSpacing: { marginTop: 12 },
  successBox: { borderWidth: 1, borderColor: '#1E1E1E', padding: 24, marginTop: 16 },
  successTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#181818', marginBottom: 8 },
  successText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#687076', marginBottom: 16 },
});
