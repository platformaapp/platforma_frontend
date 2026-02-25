import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthError } from '@/lib/api/auth-error';
import { getPaymentMethods } from '@/lib/api/student-payments';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

export default function PaymentMethodsCallbackScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const initialCountRef = useRef<number | null>(null);

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
          setStatus('success');
          if (pollInterval) clearInterval(pollInterval);
          if (timeout) clearTimeout(timeout);
          setTimeout(() => router.replace('/(tabs)/profile/payments?status=success'), 1500);
        }
      } catch (e) {
        if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
          router.replace('/login');
          return;
        }
      }
    };

    pollInterval = setInterval(poll, POLL_INTERVAL_MS);
    poll();

    timeout = setTimeout(() => {
      if (pollInterval) clearInterval(pollInterval);
      setStatus('success');
      setTimeout(() => router.replace('/(tabs)/profile/payments'), 500);
    }, POLL_TIMEOUT_MS);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (timeout) clearTimeout(timeout);
    };
  }, [router]);

  return (
    <View style={styles.container}>
      {status === 'loading' && (
        <Text style={styles.text}>Обрабатываем привязку карты...</Text>
      )}
      {status === 'success' && (
        <Text style={styles.text}>Карта успешно привязана!</Text>
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
  },
});
