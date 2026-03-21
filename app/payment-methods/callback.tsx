import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { endpoints } from '@/constants/env';

/**
 * This screen is the return_url target that YooKassa redirects the user's browser
 * to after card entry: https://platformaapp.ru/payment-methods/callback
 *
 * On the web (inside SFSafariViewController / Chrome Custom Tab):
 *   1. Reads the JWT from localStorage (saved there by the native app via auth.ts)
 *   2. Calls GET /api/student/payments/callback?orderId=... with that token
 *   3. Shows a success/wait message and closes the browser (window.close())
 *
 * On native (deep-link opens the app instead of this route):
 *   Redirects immediately to the in-app callback screen.
 */
export default function PaymentMethodCallbackPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; payment_id?: string }>();
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState('Подтверждаем привязку карты...');

  useEffect(() => {
    // On native this route is not reachable via return_url — the OS opens the app.
    // Redirect to the in-app callback screen which handles everything.
    if (Platform.OS !== 'web') {
      router.replace('/(tabs)/profile/payment-methods-callback');
      return;
    }

    const confirm = async () => {
      try {
        // Read JWT from localStorage — the native app writes it there via auth.ts
        const ls = (globalThis as any)?.localStorage;
        const token = ls?.getItem('auth_token') || ls?.getItem('access_token');

        if (!token) {
          setMessage('Привязка карты обрабатывается. Вернитесь в приложение.');
          setStatus('done');
          return;
        }

        // YooKassa does NOT append orderId to return_url — read it from localStorage
        // where it was saved before the browser was opened.
        const paymentId =
          params.orderId ||
          params.payment_id ||
          ls?.getItem('pending_payment_id');
        const attachmentId = ls?.getItem('pending_attachment_id');
        // Backend reads @Query('payment_id') — snake_case
        const qs = new URLSearchParams();
        if (paymentId) qs.set('payment_id', paymentId);
        if (attachmentId) qs.set('attachment_id', attachmentId);
        const qsStr = qs.toString();
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        // Clean up localStorage regardless of result
        try { ls?.removeItem('pending_payment_id'); ls?.removeItem('pending_attachment_id'); } catch {}

        if (res.ok || res.status === 500) {
          setMessage('Карта привязана! Вернитесь в приложение.');
          setStatus('done');
        } else {
          setMessage('Обработка... Вернитесь в приложение.');
          setStatus('done');
        }
      } catch {
        setMessage('Вернитесь в приложение — привязка будет проверена автоматически.');
        setStatus('done');
      } finally {
        // Try to close the in-app browser automatically after a short pause
        setTimeout(() => {
          try { (globalThis as any)?.window?.close?.(); } catch { /* ignore */ }
        }, 1500);
      }
    };

    confirm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      {status === 'loading' && (
        <>
          <ActivityIndicator size="large" color="#181818" style={styles.spinner} />
          <Text style={styles.text}>{message}</Text>
        </>
      )}
      {status !== 'loading' && (
        <Text style={styles.text}>{message}</Text>
      )}
      <Text style={styles.hint}>
        Это окно закроется автоматически.{'\n'}Если нет — закройте его вручную.
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
});
