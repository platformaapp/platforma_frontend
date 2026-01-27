import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { endpoints } from '@/constants/env';
import { extractTokenFromResponse, saveAuthToken } from '@/lib/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit() {
    if (!email || !password) {
      Alert.alert('Введите почту и пароль');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(endpoints.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await res.json() : await res.text();
      if (!res.ok) {
        const message = typeof data === 'string' ? data : data?.message || 'Не удалось войти';
        throw new Error(message);
      }
      const token = extractTokenFromResponse(data);
      if (token) {
        await saveAuthToken(token, data?.role || data?.user?.role);
      }
      router.replace('/(tabs)/events');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Неизвестная ошибка');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })} keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Pressable style={styles.close} onPress={() => router.back()}>
            <ThemedText style={{ fontSize: 22 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 2L22 22M22 2L2 22" stroke="#181818"/>
                </svg>
            </ThemedText>
          </Pressable>

          <View style={{ marginBottom: 54 }}>
            <ThemedText type="title" style={styles.title}>АВТОРИЗАЦИЯ</ThemedText>

            <TextInput
              placeholder="Почта"
              placeholderTextColor="#888"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />

            <View style={{ position: 'relative' }}>
              <TextInput
                placeholder="Пароль"
                placeholderTextColor="#888"
                secureTextEntry={!show}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShow(!show)} style={styles.eye}>
                <ThemedText>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <mask id="path-1-inside-1_4159_5081" fill="white">
                    <path d="M12.002 6C17.2261 6 21.6675 8.50517 23.3154 12C21.6675 15.4948 17.2261 18 12.002 18C6.7776 18 2.33524 15.495 0.6875 12C2.33524 8.50497 6.7776 6 12.002 6Z"/>
                    </mask>
                    <path d="M23.3154 12L24.2199 12.4265L24.421 12L24.2199 11.5735L23.3154 12ZM0.6875 12L-0.217017 11.5736L-0.418062 12L-0.217017 12.4264L0.6875 12ZM12.002 6V7C16.9557 7 20.9727 9.37624 22.4109 12.4265L23.3154 12L24.2199 11.5735C22.3624 7.6341 17.4965 5 12.002 5V6ZM23.3154 12L22.4109 11.5735C20.9727 14.6238 16.9557 17 12.002 17V18V19C17.4965 19 22.3624 16.3659 24.2199 12.4265L23.3154 12ZM12.002 18V17C7.04788 17 3.03009 14.6239 1.59202 11.5736L0.6875 12L-0.217017 12.4264C1.64039 16.3662 6.50732 19 12.002 19V18ZM0.6875 12L1.59202 12.4264C3.03009 9.37614 7.04788 7 12.002 7V6V5C6.50732 5 1.64039 7.63381 -0.217017 11.5736L0.6875 12Z" fill="black" mask="url(#path-1-inside-1_4159_5081)"/>
                    <circle cx="12" cy="12" r="2.5" stroke="black"/>
                  </svg>
                </ThemedText>
              </Pressable>
            </View>

            <Pressable style={[styles.btn, styles.btnPrimary, isSubmitting && { opacity: 0.6 }]} onPress={onSubmit} disabled={isSubmitting}>
              <ThemedText style={[styles.btnPrimaryText, styles.btnPrimaryTextCustom]}>Войти</ThemedText>
            </Pressable>
          </View>

          
        </ThemedView>
        <Pressable style={{ marginTop: 24, position: 'absolute', bottom: 32, left: 0, right: 0 }} onPress={() => router.push('/forgot-password')}>
          <ThemedText style={{ textAlign: 'center' }}>Забыли пароль?</ThemedText>
        </Pressable>
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
    color: "#181818"
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(24, 24, 24, 1.0)",
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontFamily: "Inter-Regular",
    fontSize: 14,
  },
  eye: {
    position: 'absolute',
    right: 12,
    top: 6,
    padding: 6,
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


