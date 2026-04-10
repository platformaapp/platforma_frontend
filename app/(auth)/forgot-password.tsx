import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { endpoints } from '@/constants/env';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validateEmail(emailValue: string): string | null {
    if (!emailValue) {
      return 'Поле не заполнено!';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      return 'Неверный формат email';
    }
    return null;
  }

  async function onSubmit() {
    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      let res: Response;
      try {
        res = await fetch(endpoints.forgotPassword, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMessage = data?.message || data?.error || `Ошибка восстановления пароля (${res.status})`;
        if (res.status === 504 || res.status === 502 || res.status === 503) {
          setError('Сервис отправки почты недоступен. Попробуйте позже.');
        } else if (res.status === 404 || errorMessage.toLowerCase().includes('не найден') || errorMessage.toLowerCase().includes('not found')) {
          setError('Пользователь не найден!');
        } else if (res.status >= 500) {
          setError('Ошибка сервера. Попробуйте позже.');
        } else {
          setError(errorMessage);
        }
        setIsSubmitting(false);
        return;
      }

      // Backend accepted the request — show check-email screen regardless of email delivery
      router.push('/check-email');
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setError('Превышено время ожидания. Попробуйте позже.');
      } else {
        setError(e?.message ?? 'Неизвестная ошибка');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })} keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Pressable style={styles.close} onPress={() => router.back()}>
            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <Path d="M2 2L22 22M22 2L2 22" stroke="#181818"/>
            </Svg>
          </Pressable>

          <View style={{ marginBottom: 54 }}>
            <ThemedText type="title" style={styles.title}>АВТОРИЗАЦИЯ</ThemedText>

            <ThemedText style={styles.description}>
              Мы пришлем ссылку для восстановления на почту, указанную при регистрации
            </ThemedText>

            <View>
              <TextInput
                placeholder="Почта"
                placeholderTextColor={error ? "#E02D2D" : "#888"}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, error && styles.inputError]}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) {
                    setError(null);
                  }
                }}
              />
              {error && (
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              )}
            </View>

            <Pressable 
              style={[styles.btn, styles.btnPrimary, isSubmitting && { opacity: 0.6 }]} 
              onPress={onSubmit} 
              disabled={isSubmitting}
            >
              <ThemedText style={[styles.btnPrimaryText, styles.btnPrimaryTextCustom]}>Отправить</ThemedText>
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
  title: {
    marginTop: 48,
    marginBottom: 24,
    fontFamily: "Inter-Regular",
    fontSize: 28,
    fontWeight: "400",
    fontStyle: "normal",
    lineHeight: 36,
    letterSpacing: -2,
    color: "#181818",
    textAlign: 'center',
  },
  description: {
    marginBottom: 24,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#181818",
    textAlign: 'left',
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(24, 24, 24, 1.0)",
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 4,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: "#181818",
  },
  inputError: {
    borderColor: "#E02D2D",
    color: "#E02D2D",
  },
  errorText: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: "#E02D2D",
    marginBottom: 8,
    marginTop: 4,
  },
  btn: {
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#111',
    marginTop: 4,
  },
  btnPrimary: {
    backgroundColor: '#111',
    borderRadius: 0,
    height: 52,
    borderWidth: 1,
    borderColor: "rgba(24, 24, 24, 1.0)",
  },
  btnPrimaryText: {
    color: '#FFF',
  },
  btnPrimaryTextCustom: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    fontWeight: "400",
    fontStyle: "normal",
    lineHeight: 20,
    color: "#FAFAFA",
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
});

