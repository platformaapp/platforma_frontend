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
      router.replace('/events');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Неизвестная ошибка');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })} keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView>
      <Pressable style={styles.close} onPress={() => router.back()}>
        <ThemedText style={{ fontSize: 22 }}>✕</ThemedText>
      </Pressable>

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
          <ThemedText>👁️</ThemedText>
        </Pressable>
      </View>

      <Pressable style={[styles.btn, styles.btnPrimary, isSubmitting && { opacity: 0.6 }]} onPress={onSubmit} disabled={isSubmitting}>
        <ThemedText style={styles.btnPrimaryText}>Войти</ThemedText>
      </Pressable>

      <Pressable style={{ marginTop: 24 }} onPress={() => Alert.alert('Напоминание пароля', 'Экран восстановления добавим позже')}>
        <ThemedText style={{ textAlign: 'center' }}>Забыли пароль?</ThemedText>
      </Pressable>
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
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  eye: {
    position: 'absolute',
    right: 12,
    top: 12,
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
  },
  btnPrimaryText: {
    color: '#FFF',
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
});


