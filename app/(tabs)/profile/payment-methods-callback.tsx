import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthError } from '@/lib/api/auth-error';
import { confirmCardBinding, getPaymentMethods } from '@/lib/api/student-payments';

const POLL_INTERVAL_MS = 2000;
// No hard timeout — we keep retrying until card appears or user navigates away.
// Each "cycle" is CYCLE_DURATION ms; after each cycle we stop auto-polling and
// show a manual "Повторить" button so the user can trigger another cycle.
const CYCLE_DURATION_MS = 30000;

export default function PaymentMethodsCallbackScreen() {
  const router = useRouter();
  const { orderId, attachmentId, returnTo } = useLocalSearchParams<{
    orderId?: string;
    attachmentId?: string;
    returnTo?: string;
  }>();

  const [status, setStatus] = useState<'polling' | 'success' | 'waiting_retry'>('polling');
  const [attemptCount, setAttemptCount] = useState(0);

  const initialCountRef = useRef<number | null>(null);
  const cardFoundRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cycleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const paymentsRoute = returnTo === 'tutor-payments'
    ? '/(tabs)/profile/tutor-payments'
    : '/(tabs)/profile/payments';

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    if (cycleTimeoutRef.current) { clearTimeout(cycleTimeoutRef.current); cycleTimeoutRef.current = null; }
  }, []);

  // Call backend confirmation endpoint so it verifies with YooKassa and saves card.
  // Called on app-foreground and on manual retry — this is the fallback when webhook missed.
  const triggerConfirmation = useCallback(async () => {
    try {
      await confirmCardBinding(orderId || undefined, attachmentId || undefined);
    } catch (e) {
      if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
        router.replace('/login');
      }
      // Other errors ignored — polling will detect the card if confirmation worked
    }
  }, [orderId, attachmentId, router]);

  const startPollingCycle = useCallback(() => {
    if (cardFoundRef.current) return;
    setStatus('polling');
    setAttemptCount((n) => n + 1);

    const poll = async () => {
      if (cardFoundRef.current) return;
      try {
        const methods = await getPaymentMethods();
        const count = methods.length;
        if (initialCountRef.current === null) {
          initialCountRef.current = count;
        }
        if (count > initialCountRef.current) {
          cardFoundRef.current = true;
          stopPolling();
          setStatus('success');
          setTimeout(() => router.replace(paymentsRoute as never), 1500);
        }
      } catch (e) {
        if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
          router.replace('/login');
        }
      }
    };

    poll(); // immediate first check
    pollIntervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    // After CYCLE_DURATION without finding card → stop auto-poll, show retry button
    cycleTimeoutRef.current = setTimeout(() => {
      if (!cardFoundRef.current) {
        stopPolling();
        setStatus('waiting_retry');
      }
    }, CYCLE_DURATION_MS);
  }, [paymentsRoute, router, stopPolling]);

  // On mount: trigger confirmation immediately + start first polling cycle
  useEffect(() => {
    triggerConfirmation();
    startPollingCycle();
    return stopPolling;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On app foreground (user closed browser): re-trigger confirmation + restart polling
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && !cardFoundRef.current) {
        triggerConfirmation();
        // If we're in waiting_retry, start a new cycle automatically
        if (status === 'waiting_retry') {
          startPollingCycle();
        }
      }
    });
    return () => sub.remove();
  }, [status, triggerConfirmation, startPollingCycle]);

  const handleRetry = () => {
    triggerConfirmation();
    startPollingCycle();
  };

  return (
    <View style={styles.container}>
      {status === 'polling' && (
        <>
          <Text style={styles.text}>Обрабатываем привязку карты...</Text>
          {attemptCount > 1 && (
            <Text style={styles.hint}>Попытка {attemptCount}</Text>
          )}
        </>
      )}

      {status === 'success' && (
        <Text style={styles.text}>Карта успешно привязана!</Text>
      )}

      {status === 'waiting_retry' && (
        <>
          <Text style={styles.text}>
            Карта ещё не появилась.{'\n\n'}
            Если вы уже ввели данные на YooKassa — нажмите «Проверить снова».
            Иногда это занимает до 1–2 минут.
          </Text>
          <Pressable style={styles.primaryButton} onPress={handleRetry}>
            <Text style={styles.primaryButtonText}>Проверить снова</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.replace(paymentsRoute as never)}
          >
            <Text style={styles.secondaryButtonText}>К платежам</Text>
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
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    textAlign: 'center',
    marginTop: 8,
  },
  primaryButton: {
    marginTop: 24,
    backgroundColor: '#111',
    paddingVertical: 14,
    paddingHorizontal: 32,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 14,
    paddingHorizontal: 32,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
});
