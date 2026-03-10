import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthError } from '@/lib/api/auth-error';
import { confirmCardBinding, getPaymentMethods } from '@/lib/api/student-payments';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

export default function PaymentMethodsCallbackScreen() {
  const router = useRouter();
  const { orderId, attachmentId, returnTo } = useLocalSearchParams<{
    orderId?: string;
    attachmentId?: string;
    returnTo?: string;
  }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'not_found'>('loading');
  const initialCountRef = useRef<number | null>(null);
  const cardFoundRef = useRef(false);

  const paymentsRoute = returnTo === 'tutor-payments'
    ? '/(tabs)/profile/tutor-payments'
    : '/(tabs)/profile/payments';

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const methods = await getPaymentMethods();
        const count = methods.length;

        if (initialCountRef.current === null) {
          initialCountRef.current = count;
        }

        if (count > initialCountRef.current) {
          cardFoundRef.current = true;
          setStatus('success');
          if (pollInterval) clearInterval(pollInterval);
          if (timeout) clearTimeout(timeout);
          setTimeout(() => router.replace(paymentsRoute as never), 1500);
        }
      } catch (e) {
        if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
          router.replace('/login');
          return;
        }
      }
    };

    // Call the backend confirmation endpoint so it verifies the payment with YooKassa
    // and saves the card to the DB. The browser redirect from YooKassa doesn't carry
    // an auth token, so this call must be made explicitly from the app.
    const triggerConfirmation = async () => {
      if (!orderId && !attachmentId) return;
      try {
        await confirmCardBinding(orderId || undefined, attachmentId || undefined);
      } catch (e) {
        if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
          router.replace('/login');
          return;
        }
        // Ignore other errors — polling will detect the card if confirmation succeeds async
      }
    };

    // Fire confirmation immediately, then start polling
    triggerConfirmation();
    pollInterval = setInterval(poll, POLL_INTERVAL_MS);
    poll();

    timeout = setTimeout(() => {
      if (pollInterval) clearInterval(pollInterval);
      if (!cardFoundRef.current) {
        setStatus('not_found');
      }
    }, POLL_TIMEOUT_MS);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (timeout) clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      {status === 'loading' && (
        <Text style={styles.text}>Обрабатываем привязку карты...</Text>
      )}
      {status === 'success' && (
        <Text style={styles.text}>Карта успешно привязана!</Text>
      )}
      {status === 'not_found' && (
        <>
          <Text style={styles.text}>
            Карта не появилась за 30 секунд.{'\n\n'}
            Возможно, бэкенд ещё обрабатывает запрос — проверьте раздел «Платежи» через несколько секунд.
          </Text>
          <Pressable style={styles.button} onPress={() => router.replace(paymentsRoute as never)}>
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
  },
  button: {
    marginTop: 24,
    backgroundColor: '#111',
    paddingVertical: 14,
    paddingHorizontal: 32,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
});
