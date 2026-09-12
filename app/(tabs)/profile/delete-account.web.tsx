import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SiteShell } from '@/components/web/site-shell';
import { endpoints } from '@/constants/env';
import { clearAuth } from '@/lib/auth';
import { authedFetch } from '@/lib/authed-fetch';

/** Веб-версия экрана "Удаление аккаунта" (см. delete-account.tsx для нативной). */
export default function DeleteAccountScreenWeb() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleClose() {
    router.back();
  }

  async function handleDelete() {
    if (!password) {
      setError('Введите пароль, чтобы подтвердить удаление');
      return;
    }
    setError('');
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
    <SiteShell>
      <View style={styles.page}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Удаление аккаунта</Text>
            <Pressable onPress={handleClose}><Text style={styles.close}>✕</Text></Pressable>
          </View>

          <Text style={styles.description}>
            Это действие необратимо. Личные данные (имя, email, телефон, telegram, фото, способы оплаты) будут
            удалены. Записи о прошедших событиях и платежах сохранятся обезличенными для истории и бухгалтерии.
          </Text>

          <Text style={styles.fieldLabel}>Подтвердите паролем</Text>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={password}
            onChangeText={(t) => { setPassword(t); if (error) setError(''); }}
            secureTextEntry
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.footerRow}>
            <Pressable onPress={handleClose}><Text style={styles.cancelLink}>Отменить</Text></Pressable>
            <Pressable onPress={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#E02D2D" /> : <Text style={styles.deleteLink}>Удалить аккаунт</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 },
  card: { width: '100%', maxWidth: 480, backgroundColor: '#fff', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontFamily: 'Inter-Bold', fontSize: 22, color: '#181818' },
  close: { fontSize: 20, color: '#181818' },
  description: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: '#687076', marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#181818', paddingVertical: 12, paddingHorizontal: 12, fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
  inputError: { borderColor: '#E02D2D' },
  errorText: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#E02D2D', marginTop: 6 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  cancelLink: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#687076' },
  deleteLink: { fontFamily: 'Inter-Medium', fontSize: 15, color: '#E02D2D' },
});
