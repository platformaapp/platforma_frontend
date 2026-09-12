import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { endpoints } from '@/constants/env';
import { clearAuth } from '@/lib/auth';
import { authedFetch } from '@/lib/authed-fetch';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!password) {
      setError('Введите пароль, чтобы подтвердить удаление');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await authedFetch(endpoints.deleteAccount, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? `Не удалось удалить аккаунт (${res.status})`);
        return;
      }
      await clearAuth();
      router.replace('/login');
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось удалить аккаунт');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <Path d="M15 18L9 12L15 6" stroke="#181818" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      </View>

      <Text style={styles.title}>УДАЛЕНИЕ АККАУНТА</Text>

      <Text style={styles.description}>
        Это действие необратимо. Личные данные (имя, email, телефон, telegram, фото, способы оплаты) будут удалены.
        Записи о прошедших событиях и платежах сохранятся обезличенными для истории и бухгалтерии.
      </Text>

      <Text style={styles.label}>Подтвердите паролем</Text>
      <TextInput
        value={password}
        onChangeText={(t) => { setPassword(t); if (error) setError(null); }}
        placeholder="Пароль"
        placeholderTextColor="#9B9B9B"
        secureTextEntry
        style={[styles.input, error && styles.inputError]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        style={[styles.deleteButton, isSubmitting && styles.deleteButtonDisabled]}
        onPress={handleDelete}
        disabled={isSubmitting}
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteButtonText}>Удалить аккаунт</Text>}
      </Pressable>

      <Pressable style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>Отменить</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  header: { paddingTop: 16 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 12, marginBottom: 20, fontSize: 20, lineHeight: 26, fontFamily: 'Inter-Regular', color: '#181818' },
  description: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 24 },
  label: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#181818', paddingVertical: 12, paddingHorizontal: 12, fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
  inputError: { borderColor: '#E02D2D' },
  errorText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D', marginTop: 6 },
  deleteButton: { marginTop: 24, backgroundColor: '#E02D2D', paddingVertical: 16, alignItems: 'center', justifyContent: 'center', height: 52 },
  deleteButtonDisabled: { opacity: 0.6 },
  deleteButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#fff' },
  cancelButton: { marginTop: 12, marginBottom: 24, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  cancelButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#687076' },
});
