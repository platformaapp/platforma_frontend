import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

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
 */
export default function PaymentMethodCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'done' | 'fallback'>('loading');
  const [message, setMessage] = useState('Подтверждаем привязку карты...');
  const [initialCardCount, setInitialCardCount] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      router.replace('/(tabs)/profile/payment-methods-callback');
      return;
    }

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
        setTimeout(() => router.replace('/login'), 2000);
        return;
      }

      const yookassaPaymentId =
        ls?.getItem(PENDING_CARD_BINDING_PAYMENT_ID_KEY) ||
        ls?.getItem('pending_payment_id');
      const storedCount = readStoredCount();
      setInitialCardCount(storedCount);

      if (!yookassaPaymentId) {
        try {
          ls?.removeItem(PENDING_CARD_BINDING_INITIAL_COUNT_KEY);
        } catch {
          /* ignore */
        }
        router.replace('/(tabs)/profile/payments');
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
        setTimeout(() => router.replace('/(tabs)/profile/payments'), 1500);
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
        setTimeout(() => router.replace('/(tabs)/profile/payments'), 1500);
      } else {
        setMessage('Активная карта не найдена. Привяжите карту снова в разделе «Платежи».');
        setStatus('done');
        setTimeout(() => router.replace('/(tabs)/profile/payments'), 2500);
      }
    } catch {
      setMessage('Ошибка соединения. Откройте раздел «Платежи» позже.');
      setStatus('done');
      setTimeout(() => router.replace('/(tabs)/profile/payments'), 2000);
    }
  };

  return (
    <View style={styles.container}>
      {status === 'loading' && (
        <>
          <ActivityIndicator size="large" color="#181818" style={styles.spinner} />
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
      <Text style={styles.hint}>
        {status === 'loading' ? 'Это окно закроется после перехода в приложение.' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  spinner: {
    marginBottom: 24,
  },
  text: {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    textAlign: 'center',
    marginBottom: 16,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#111',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  buttonText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
});
