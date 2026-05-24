import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthError } from '@/lib/api/auth-error';
import { fetchPaymentBindingCallback } from '@/lib/api/student-payments';

type ScreenStatus = 'loading' | 'success' | 'error';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

export default function PaymentMethodsCallbackScreen() {
  const router = useRouter();
  const { yookassaPaymentId, orderId, returnTo } = useLocalSearchParams<{
    yookassaPaymentId?: string;
    orderId?: string;
    returnTo?: string;
    initialCardCount?: string;
  }>();
  const [status, setStatus] = useState<ScreenStatus>('loading');
  const [message, setMessage] = useState('Проверяем привязку карты...');
  const stopRef = useRef(false);

  const paymentsRoute = returnTo === 'tutor-payments'
    ? '/(tabs)/profile/tutor-payments'
    : '/(tabs)/profile/payments';

  const effectivePaymentId =
    (yookassaPaymentId && String(yookassaPaymentId)) ||
    (orderId && String(orderId)) ||
    '';

  useEffect(() => {
    if (!effectivePaymentId) {
      setStatus('error');
      setMessage('Нет данных о платеже.');
      return;
    }

    const refresh = Date.now().toString();
    const goPayments = (delay = 1500) => {
      setTimeout(
        () => router.replace({ pathname: paymentsRoute, params: { refresh } } as never),
        delay,
      );
    };

    const startMs = Date.now();

    const poll = async () => {
      if (stopRef.current) return;
      try {
        const result = await fetchPaymentBindingCallback(effectivePaymentId);

        if (stopRef.current) return;

        if (result.status === 'succeeded') {
          setStatus('success');
          setMessage(result.message || 'Карта успешно привязана!');
          goPayments(1500);
          return;
        }

        if (result.status === 'failed') {
          setStatus('error');
          setMessage(result.message || 'Привязка карты не удалась');
          return;
        }

        // pending — keep polling if within timeout
        if (Date.now() - startMs < POLL_TIMEOUT_MS) {
          setMessage('Проверяем привязку карты...');
          setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          setStatus('error');
          setMessage('Время ожидания истекло. Попробуйте привязать карту снова.');
        }
      } catch (e) {
        if (stopRef.current) return;
        if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
          router.replace('/login');
          return;
        }
        setStatus('error');
        setMessage((e as Error)?.message ?? 'Не удалось проверить статус привязки.');
      }
    };

    poll();

    return () => { stopRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoToPayments = () => {
    router.replace({ pathname: paymentsRoute, params: { refresh: Date.now().toString() } } as never);
  };

  return (
    <View style={styles.container}>
      {status === 'loading' && (
        <>
          <ActivityIndicator size="large" color="#181818" style={{ marginBottom: 16 }} />
          <Text style={styles.text}>{message}</Text>
        </>
      )}

      {status === 'success' && (
        <Text style={styles.text}>{message}</Text>
      )}

      {status === 'error' && (
        <>
          <Text style={styles.text}>{message}</Text>
          <Pressable style={styles.button} onPress={handleGoToPayments}>
            <Text style={styles.buttonText}>К платежам</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  text: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  button: {
    marginTop: 12,
    backgroundColor: '#111',
    paddingVertical: 14,
    paddingHorizontal: 32,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
});
