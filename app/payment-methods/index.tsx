import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthError } from '@/lib/api/auth-error';
import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';

type ScreenStatus = 'loading' | 'success' | 'error';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

// Handles YooKassa return URL: https://platformaapp.ru/payment-methods/?status=success|pending|failed&tx=<id>
export default function PaymentMethodsIndexScreen() {
  const router = useRouter();
  const { status: statusParam, tx: txParam, returnTo } = useLocalSearchParams<{
    status?: string;
    tx?: string;
    returnTo?: string;
  }>();

  const [status, setStatus] = useState<ScreenStatus>('loading');
  const [message, setMessage] = useState('Проверяем привязку карты...');
  const [cardMasked, setCardMasked] = useState<string | null>(null);
  const stopRef = useRef(false);

  const paymentsRoute = returnTo === 'tutor-payments'
    ? '/(tabs)/profile/tutor-payments'
    : '/(tabs)/profile/payments';

  const effectiveTransactionId = txParam ? String(txParam) : '';

  const handleSuccess = async () => {
    try {
      const token = await getAuthToken();
      if (token) {
        const res = await fetch(endpoints.studentPaymentMethods, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const methods: Array<{ cardMasked?: string; card_masked?: string }> =
            data?.data?.paymentMethods ?? data?.cards ?? [];
          const first = methods[0];
          if (first) {
            setCardMasked(first.cardMasked ?? first.card_masked ?? null);
          }
        }
      }
    } catch { /* show success without card details */ }
    setStatus('success');
    setMessage('А теперь время приключений');
  };

  useEffect(() => {
    // Case 1: YooKassa returned ?status=success
    if (statusParam === 'success') {
      handleSuccess();
      return;
    }

    // Case 2: YooKassa returned ?status=failed / ?status=error
    if (statusParam === 'failed' || statusParam === 'error') {
      setStatus('error');
      setMessage('Привязка карты не удалась. Попробуйте снова.');
      return;
    }

    // Case 3: poll binding-status with ?status=pending&tx=<id>
    if (!effectiveTransactionId) {
      // No tx and no recognized status — go to payments directly
      router.replace(paymentsRoute as never);
      return;
    }

    const startMs = Date.now();

    const poll = async () => {
      if (stopRef.current) return;
      try {
        const token = await getAuthToken();
        if (!token) { router.replace('/login'); return; }

        const params = new URLSearchParams({ tx: effectiveTransactionId });
        const res = await fetch(`${endpoints.paymentMethodsBindingStatus}?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Ошибка проверки статуса (${res.status})`);
        const data = await res.json().catch(() => ({}));
        const statusStr = (data?.status ?? '').toLowerCase();

        if (stopRef.current) return;

        if (statusStr === 'active') {
          await handleSuccess();
          return;
        }

        if (statusStr === 'failed' || statusStr === 'not_found') {
          setStatus('error');
          setMessage(
            statusStr === 'not_found'
              ? 'Транзакция не найдена. Попробуйте привязать карту снова.'
              : 'Привязка карты не удалась.',
          );
          return;
        }

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
        <>
          <Text style={styles.successTitle}>КАРТА ПРИВЯЗАНА</Text>
          {cardMasked ? (
            <Text style={styles.cardText}>**** {cardMasked.replace(/\*/g, '').trim() || cardMasked}</Text>
          ) : null}
          <Text style={styles.text}>{message}</Text>
          <Pressable style={styles.button} onPress={handleGoToPayments}>
            <Text style={styles.buttonText}>Начнем</Text>
          </Pressable>
        </>
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
  successTitle: {
    fontSize: 28,
    fontFamily: 'Inter-Regular',
    fontWeight: '700',
    color: '#181818',
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 36,
    marginBottom: 12,
  },
  cardText: {
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    textAlign: 'center',
    marginBottom: 8,
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
