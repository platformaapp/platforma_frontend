import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthError } from '@/lib/api/auth-error';
import {
  bindPaymentMethod,
  PENDING_CARD_BINDING_INITIAL_COUNT_KEY,
  PENDING_CARD_BINDING_PAYMENT_ID_KEY,
} from '@/lib/api/student-payments';

export default function RegistrationCompleteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLinking, setIsLinking] = useState(false);

  const pendingCallbackRef = useRef(false);
  const pendingBindParams = useRef<{ yookassaPaymentId?: string }>({});

  const navigateToCallback = () => {
    const { yookassaPaymentId } = pendingBindParams.current;
    router.push({
      pathname: '/(tabs)/profile/payment-methods-callback',
      params: {
        yookassaPaymentId: yookassaPaymentId ?? '',
        orderId: yookassaPaymentId ?? '',
        initialCardCount: '0',
      },
    });
  };

  const handleLinkNow = async () => {
    if (isLinking) return;
    setIsLinking(true);
    try {
      const { confirmationUrl, yookassaPaymentId } = await bindPaymentMethod({ provider: 'yookassa' });
      const paymentId = yookassaPaymentId;
      pendingBindParams.current = { yookassaPaymentId: paymentId };
      try {
        const ls = (globalThis as any)?.localStorage;
        if (ls && paymentId) {
          ls.setItem(PENDING_CARD_BINDING_PAYMENT_ID_KEY, paymentId);
          ls.setItem(PENDING_CARD_BINDING_INITIAL_COUNT_KEY, '0');
        }
      } catch { /* ignore */ }
      pendingCallbackRef.current = true;
      WebBrowser.openBrowserAsync(confirmationUrl).then(() => {
        if (pendingCallbackRef.current) {
          pendingCallbackRef.current = false;
          navigateToCallback();
        }
      });
    } catch (e: unknown) {
      pendingCallbackRef.current = false;
      pendingBindParams.current = {};
      try {
        const ls = (globalThis as any)?.localStorage;
        ls?.removeItem(PENDING_CARD_BINDING_PAYMENT_ID_KEY);
        ls?.removeItem(PENDING_CARD_BINDING_INITIAL_COUNT_KEY);
      } catch { /* ignore */ }
      if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
        router.replace('/login');
        return;
      }
      // On error just go to events — card can be added later
      router.replace('/(tabs)/events');
    } finally {
      setIsLinking(false);
    }
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && pendingCallbackRef.current) {
        pendingCallbackRef.current = false;
        navigateToCallback();
      }
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLinkLater() {
    router.replace('/(tabs)/events');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.inner}>
          <Pressable
            style={[styles.close, { top: insets.top + 12 }]}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)/events');
            }}
          >
            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <Path d="M2 2L22 22M22 2L2 22" stroke="#181818"/>
            </Svg>
          </Pressable>

          <View style={styles.content}>
            <ThemedText type="title" style={styles.title}>
              РЕГИСТРАЦИЯ{"\n"}ЗАВЕРШЕНА!
            </ThemedText>

            <ThemedText style={styles.description}>
              Привяжите карту, чтобы ни в чём себе{"\n"}не отказывать
            </ThemedText>
          </View>

          <View style={styles.buttonsContainer}>
            <Pressable
              style={[styles.btn, styles.btnPrimary, isLinking && { opacity: 0.6 }]}
              onPress={handleLinkNow}
              disabled={isLinking}
            >
              <ThemedText style={[styles.btnPrimaryText, styles.btnPrimaryTextCustom]}>
                {isLinking ? 'Открываем YooKassa...' : 'Привязать сейчас'}
              </ThemedText>
            </Pressable>

            <Pressable style={[styles.btn, styles.btnOutline]} onPress={handleLinkLater}>
              <ThemedText style={[styles.btnOutlineText, styles.btnOutlineTextCustom]}>
                Привяжу потом
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  inner: {
    flex: 1,
    minHeight: '100%',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'baseline',
    marginBottom: 48,
  },
  title: {
    marginTop: 48,
    marginBottom: 24,
    fontFamily: 'Inter-Regular',
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 36,
    letterSpacing: -2,
    color: '#181818',
    textAlign: 'left',
  },
  description: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#181818',
    textAlign: 'left',
  },
  buttonsContainer: {
    gap: 12,
    marginTop: 'auto',
    paddingBottom: 32,
  },
  btn: {
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    height: 52,
  },
  btnPrimary: {
    backgroundColor: '#111',
    borderColor: '#181818',
  },
  btnPrimaryText: { color: '#FFF' },
  btnPrimaryTextCustom: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: '#FAFAFA',
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderColor: '#181818',
  },
  btnOutlineText: { color: '#111' },
  btnOutlineTextCustom: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: '#181818',
  },
  close: {
    position: 'absolute',
    right: 16,
    zIndex: 1,
    padding: 16,
  },
});
