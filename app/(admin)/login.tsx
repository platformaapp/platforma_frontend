import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { endpoints } from '@/constants/env';
import { saveAdminToken } from '@/lib/admin-auth';

export default function AdminLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Введите логин и пароль');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(endpoints.adminLogin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? `Ошибка входа (${res.status})`);
        return;
      }
      const token = data?.token ?? data?.access_token ?? data?.accessToken ?? data?.data?.token;
      if (!token) {
        setError('Сервер не вернул токен');
        return;
      }
      await saveAdminToken(token);
      router.replace('/(admin)/dashboard');
    } catch {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>АДМИНКА</Text>
        <Text style={styles.subtitle}>Управление заявками наставников</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9B9B9B"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Пароль"
          placeholderTextColor="#9B9B9B"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Войти</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  title: {
    fontSize: 32, lineHeight: 36, fontFamily: 'Inter-Regular',
    fontWeight: '700', color: '#181818', marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular',
    color: '#9B9B9B', marginBottom: 40,
  },
  input: {
    borderWidth: 1, borderColor: '#1E1E1E',
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13, fontFamily: 'Inter-Regular',
    color: '#E02D2D', marginBottom: 12,
  },
  button: {
    backgroundColor: '#181818', height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#fff' },
});
