import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthError } from '@/lib/api/auth-error';
import { fetchPaymentBindingCallback, getPaymentMethods } from '@/lib/api/student-payments';

type ScreenStatus = 'loading' | 'success' | 'error' | 'fallback';

export default function PaymentMethodsCallbackScreen() {
  const router = useRouter();
  const { yookassaPaymentId, orderId, returnTo, initialCardCount } = useLocalSearchParams<{
    yookassaPaymentId?: string;
    orderId?: string;
    returnTo?: string;
    initialCardCount?: string;
  }>();
  const [status, setStatus] = useState<ScreenStatus>('loading');
  const [message, setMessage] = useState('Обрабатываем привязку карты...');
  const ranRef = useRef(false);

  const paymentsRoute = returnTo === 'tutor-payments'
    ? '/(tabs)/profile/tutor-payments'
    : '/(tabs)/profile/payments';

  const baselineCount = (() => {
    const n = parseInt(initialCardCount ?? '0', 10);
    return Number.isFinite(n) ? n : 0;
  })();

  const effectivePaymentId =
    (yookassaPaymentId && String(yookassaPaymentId)) ||
    (orderId && String(orderId)) ||
    '';

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const refresh = Date.now().toString();
    const goPayments = () => {
      setTimeout(() => router.replace({ pathname: paymentsRoute, params: { refresh } } as never), 1500);
    };

    const run = async () => {
      if (!effectivePaymentId) {
        setStatus('fallback');
        setMessage('Нет данных о платеже. Проверьте статус вручную.');
        return;
      }
      try {
        const result = await fetchPaymentBindingCallback(effectivePaymentId);
        if (result.status === 'succeeded') {
          setStatus('success');
          setMessage('Карта успешно привязана!');
          goPayments();
        } else {
          setStatus('error');
          setMessage(result.message || 'Ошибка привязки карты');
          setTimeout(() => router.replace({ pathname: paymentsRoute, params: { refresh } } as never), 2000);
        }
      } catch (e) {
        if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
          router.replace('/login');
          return;
        }
        setStatus('fallback');
        setMessage((e as Error)?.message ?? 'Не удалось подтвердить привязку.');
      }
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckStatus = async () => {
    setStatus('loading');
    setMessage('Проверяем карты...');
    const r = Date.now().toString();
    try {
      const methods = await getPaymentMethods();
      if (methods.length > baselineCount) {
        setStatus('success');
        setMessage('Карта успешно привязана!');
        setTimeout(() => router.replace({ pathname: paymentsRoute, params: { refresh: r } } as never), 1500);
      } else {
        setStatus('error');
        setMessage('Активная карта не найдена. Привяжите карту снова.');
        setTimeout(() => router.replace({ pathname: paymentsRoute, params: { refresh: r } } as never), 2000);
      }
    } catch (e) {
      if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
        router.replace('/login');
        return;
      }
      setStatus('error');
      setMessage('Ошибка соединения');
      setTimeout(() => router.replace({ pathname: paymentsRoute, params: { refresh: r } } as never), 2000);
    }
  };

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
      {status === 'fallback' && (
        <>
          <Text style={styles.text}>{message}</Text>
          <Pressable style={styles.button} onPress={handleCheckStatus}>
            <Text style={styles.buttonText}>Проверить статус привязки</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonSecondary]} onPress={handleGoToPayments}>
            <Text style={styles.buttonTextSecondary}>К платежам</Text>
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
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  buttonText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
  buttonTextSecondary: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
});
