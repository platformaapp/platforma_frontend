import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteShell } from '@/components/web/site-shell';
import { endpoints } from '@/constants/env';
import { getPaymentMethods } from '@/lib/api/student-payments';
import { getPublicTutorList, getPublicTutors, getStudentTutorSlots } from '@/lib/api/tutor';
import { getAuthToken } from '@/lib/auth';
import { authedFetch } from '@/lib/authed-fetch';

type SlotItem = { id: string; date: string; time: string; price?: number };

function formatSlotDate(apiDate: string): string {
  const parts = apiDate.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}` : apiDate;
}

/**
 * Веб-версия страницы "Слоты" (в макете — отдельная страница, а не модалка,
 * как в нативном приложении). Логика бронирования/оплаты продублирована из
 * app/(tabs)/explore/[id].tsx (handleBook) — тот же эндпоинт и разбор ответа.
 */
export default function TutorSlotsScreenWeb() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [mentorName, setMentorName] = useState('');
  const [mentorPrice, setMentorPrice] = useState('');
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SlotItem | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookError, setBookError] = useState('');
  const [bookedOk, setBookedOk] = useState(false);

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

  async function handleBook() {
    if (!selected || isBooking) return;
    setIsBooking(true);
    setBookError('');
    try {
      const cards = await getPaymentMethods();
      if (!cards.length) { router.push('/(tabs)/profile/payments' as any); return; }
      const card = cards.find((c) => c.isDefault) ?? cards[0];

      const res = await authedFetch(endpoints.studentBookings, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: selected.id, payment_method_id: card.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) { setBookedOk(true); return; }
        throw new Error(data?.message ?? `Ошибка бронирования (${res.status})`);
      }

      const confirmUrl = data?.confirmation_url ?? data?.confirmationUrl ?? data?.redirect_url ?? null;
      if (confirmUrl) {
        const w = (globalThis as any).window;
        if (w) w.location.href = confirmUrl;
        return;
      }
      setBookedOk(true);
    } catch (e: any) {
      setBookError(e?.message ?? 'Не удалось оплатить встречу');
    } finally {
      setIsBooking(false);
    }
  }

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{mentorName || 'Наставник'}</Text>
        <Text style={styles.subtitle}>Запись на встречу</Text>
        {mentorPrice ? <Text style={styles.price}>Стоимость консультации: {mentorPrice} в час</Text> : null}

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : bookedOk ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Встреча забронирована</Text>
            <Text style={styles.successText}>Чек придёт на почту. Возврат возможен в течение 24 часов.</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/myevents' as any)}>
              <Text style={styles.primaryButtonText}>Мои записи</Text>
            </Pressable>
          </View>
        ) : slots.length === 0 ? (
          <Text style={styles.emptyText}>Нет доступных слотов</Text>
        ) : (
          <>
            <View style={styles.slotGrid}>
              {slots.map((slot) => {
                const active = selected?.id === slot.id;
                return (
                  <Pressable key={slot.id} style={[styles.slotCard, active && styles.slotCardActive]} onPress={() => setSelected(slot)}>
                    <Text style={[styles.slotDate, active && styles.slotTextActive]}>{slot.date}</Text>
                    <Text style={[styles.slotTime, active && styles.slotTextActive]}>{slot.time}</Text>
                  </Pressable>
                );
              })}
            </View>

            {selected ? (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmText}>{selected.date} в {selected.time}{selected.price != null ? ` — ${selected.price.toLocaleString('ru-RU')} ₽` : ''}</Text>
                {bookError ? <Text style={styles.errorText}>{bookError}</Text> : null}
                <Pressable style={[styles.primaryButton, isBooking && styles.btnDisabled]} onPress={handleBook} disabled={isBooking}>
                  <Text style={styles.primaryButtonText}>{isBooking ? 'Оплата…' : 'Далее'}</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 48, maxWidth: 640 },
  title: { fontSize: 24, fontFamily: 'Inter-Bold', color: '#181818' },
  subtitle: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#687076', marginTop: 4, marginBottom: 8 },
  price: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 24 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D', marginTop: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#687076' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  slotCard: { width: 84, height: 76, borderWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
  slotCardActive: { backgroundColor: '#181818' },
  slotDate: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818' },
  slotTime: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#181818', marginTop: 2 },
  slotTextActive: { color: '#FAFAFA' },
  confirmBox: { borderWidth: 1, borderColor: '#1E1E1E', padding: 20 },
  confirmText: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#181818', marginBottom: 16 },
  primaryButton: { backgroundColor: '#E02D2D', paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  primaryButtonText: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#FFFFFF' },
  successBox: { borderWidth: 1, borderColor: '#1E1E1E', padding: 24 },
  successTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#181818', marginBottom: 8 },
  successText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#687076', marginBottom: 16 },
});
