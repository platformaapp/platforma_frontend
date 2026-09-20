import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { SiteShell } from '@/components/web/site-shell';
import {
  fetchPaymentBindingCallback,
  getPaymentMethods,
  PENDING_CARD_BINDING_INITIAL_COUNT_KEY,
  PENDING_CARD_BINDING_PAYMENT_ID_KEY,
} from '@/lib/api/student-payments';
import { getAuthToken } from '@/lib/auth';

/**
 * return_url после YooKassa: https://platformaapp.ru/payment-methods/callback
 *
 * 1) Читает pendingCardBindingPaymentId из localStorage (yookassaPaymentId с /bind)
 * 2) GET /api/student/payments/callback?payment_id=... с Bearer
 * 3) Редирект в приложение на экран платежей
 *
 * Без payment_id в storage — сразу на профиль платежей (нет активной привязки).
 * Нет отдельного макета — минимальный центрированный статус в каркасе сайта.
 */
export default function PaymentMethodCallbackPageWeb() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'done' | 'fallback'>('loading');
  const [message, setMessage] = useState('Подтверждаем привязку карты...');
  const [initialCardCount, setInitialCardCount] = useState<number | null>(null);

  useEffect(() => {
    const ls = (globalThis as any)?.localStorage;
    const readStoredCount = (): number | null => {
      try {
        const raw = ls?.getItem(PENDING_CARD_BINDING_INITIAL_COUNT_KEY);
        if (raw == null || raw === '') return null;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? n : null;
      } catch {
        return null;
      }
    };

    const run = async () => {
      const token = await getAuthToken();
      if (!token) {
        setMessage('Войдите в приложение и проверьте карты в разделе «Платежи».');
        setStatus('done');
        setTimeout(() => router.replace('/login' as any), 2000);
        return;
      }

      const yookassaPaymentId = ls?.getItem(PENDING_CARD_BINDING_PAYMENT_ID_KEY) || ls?.getItem('pending_payment_id');
      const storedCount = readStoredCount();
      setInitialCardCount(storedCount);

      if (!yookassaPaymentId) {
        try {
          ls?.removeItem(PENDING_CARD_BINDING_INITIAL_COUNT_KEY);
        } catch {
          /* ignore */
        }
        router.replace('/(tabs)/profile/payments' as any);
        return;
      }

      try {
        const result = await fetchPaymentBindingCallback(yookassaPaymentId);
        try {
          ls?.removeItem(PENDING_CARD_BINDING_PAYMENT_ID_KEY);
          ls?.removeItem('pending_payment_id');
          ls?.removeItem('pending_attachment_id');
          ls?.removeItem(PENDING_CARD_BINDING_INITIAL_COUNT_KEY);
        } catch {
          /* ignore */
        }

        if (result.status === 'succeeded') {
          setMessage('Карта успешно привязана.');
          setStatus('done');
        } else {
          setMessage(result.message || 'Ошибка привязки карты');
          setStatus('done');
        }
        setTimeout(() => router.replace('/(tabs)/profile/payments' as any), 1500);
      } catch {
        try {
          ls?.removeItem(PENDING_CARD_BINDING_PAYMENT_ID_KEY);
          ls?.removeItem('pending_payment_id');
        } catch {
          /* ignore */
        }
        setMessage('Не удалось подтвердить привязку. Проверьте статус ниже.');
        setStatus('fallback');
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckStatus = async () => {
    setStatus('loading');
    setMessage('Проверяем карты...');
    try {
      const methods = await getPaymentMethods();
      const baseline = initialCardCount ?? 0;
      try {
        (globalThis as any)?.localStorage?.removeItem(PENDING_CARD_BINDING_INITIAL_COUNT_KEY);
      } catch {
        /* ignore */
      }
      if (methods.length > baseline) {
        setMessage('Карта успешно привязана.');
        setStatus('done');
        setTimeout(() => router.replace('/(tabs)/profile/payments' as any), 1500);
      } else {
        setMessage('Активная карта не найдена. Привяжите карту снова в разделе «Платежи».');
        setStatus('done');
        setTimeout(() => router.replace('/(tabs)/profile/payments' as any), 2500);
      }
    } catch {
      setMessage('Ошибка соединения. Откройте раздел «Платежи» позже.');
      setStatus('done');
      setTimeout(() => router.replace('/(tabs)/profile/payments' as any), 2000);
    }
  };

  return (
    <SiteShell>
      <View style={styles.container}>
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color="#010101" style={styles.spinner} />
            <Text style={styles.text}>{message}</Text>
          </>
        )}
        {status === 'fallback' && (
          <>
            <Text style={styles.text}>{message}</Text>
            <Pressable style={styles.button} onPress={handleCheckStatus}>
              <Text style={styles.buttonText}>Проверить статус привязки</Text>
            </Pressable>
          </>
        )}
        {status === 'done' && <Text style={styles.text}>{message}</Text>}
        <Text style={styles.hint}>{status === 'loading' ? 'Это окно закроется после перехода в приложение.' : ''}</Text>
      </View>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 96, paddingHorizontal: 24 },
  spinner: { marginBottom: 20 },
  text: { fontSize: 16, lineHeight: 24, fontFamily: 'Gramatika-Regular', color: '#010101', textAlign: 'center', marginBottom: 16, maxWidth: 420 },
  hint: { fontSize: 13, lineHeight: 18, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', textAlign: 'center' },
  button: { marginTop: 4, backgroundColor: '#010101', paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  buttonText: { fontSize: 14, fontFamily: 'Gramatika-Bold', color: '#fff' },
});
