import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PlusField } from '@/components/web/plus-field';
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
      {/* Modal (не обычный View с flex:1) — гарантированно перекрывает всю
          страницу независимо от окружающего flex-контекста, см. cookie-banner. */}
      <Modal transparent animationType="fade" visible onRequestClose={handleClose}>
      <View style={[styles.page, { pointerEvents: 'box-none' }]}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Удаление аккаунта</Text>
            <Pressable onPress={handleClose}><Text style={styles.close}>✕</Text></Pressable>
          </View>

          <Text style={styles.description}>
            Это действие необратимо. Личные данные (имя, email, телефон, telegram, фото, способы оплаты) будут
            удалены. Записи о прошедших событиях и платежах сохранятся обезличенными для истории и бухгалтерии.
          </Text>

          <PlusField
            label="Подтвердите паролем"
            value={password}
            secureTextEntry
            error={error || undefined}
            onChangeText={(t) => { setPassword(t); if (error) setError(''); }}
          />

          <View style={styles.footerRow}>
            <Pressable onPress={handleClose}><Text style={styles.cancelLink}>Отменить</Text></Pressable>
            <Pressable onPress={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#E02D2D" /> : <Text style={styles.deleteLink}>Удалить аккаунт</Text>}
            </Pressable>
          </View>
        </View>
      </View>
      </Modal>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 },
  card: { width: '100%', maxWidth: 480, backgroundColor: '#fff', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 40, lineHeight: 36, color: '#010101' },
  close: { fontSize: 20, color: '#010101' },
  description: { fontFamily: 'Gramatika-Regular', fontSize: 18, lineHeight: 24, color: '#687076', marginBottom: 20 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  cancelLink: { fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#687076' },
  deleteLink: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 15, color: '#E02D2D', textDecorationLine: 'underline' },
});
