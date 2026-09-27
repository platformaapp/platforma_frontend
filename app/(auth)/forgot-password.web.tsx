import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PlusField } from '@/components/web/plus-field';
import { SiteShell } from '@/components/web/site-shell';
import { endpoints } from '@/constants/env';

/** Веб-версия экрана восстановления пароля (см. forgot-password.tsx для нативной). */
export default function ForgotPasswordScreenWeb() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validateEmail(emailValue: string): string | null {
    if (!emailValue) return 'Поле не заполнено!';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) return 'Неверный формат email';
    return null;
  }

  async function onSubmit() {
    const validationError = validateEmail(email);
    if (validationError) { setError(validationError); return; }

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
          credentials: 'include',
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

      // Бэкенд принял запрос — показываем check-email независимо от доставки письма
      router.push('/check-email' as any);
    } catch (e: any) {
      if (e?.name === 'AbortError') setError('Превышено время ожидания. Попробуйте позже.');
      else setError(e?.message ?? 'Неизвестная ошибка');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SiteShell>
      {/* Modal (не обычный View с flex:1) — гарантированно перекрывает всю
          страницу независимо от окружающего flex-контекста, см. cookie-banner. */}
      <Modal transparent animationType="fade" visible onRequestClose={() => router.back()}>
      <View style={[styles.page, { pointerEvents: 'box-none' }]}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Авторизация</Text>
            <Pressable onPress={() => router.back()}><Text style={styles.close}>✕</Text></Pressable>
          </View>

          <Text style={styles.description}>
            Мы пришлем ссылку для восстановления на почту, указанную при регистрации
          </Text>

          <PlusField
            label="Почта"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            error={error ?? undefined}
            onChangeText={(text) => { setEmail(text); if (error) setError(null); }}
          />

          <View style={styles.footerRow}>
            <Pressable onPress={onSubmit} disabled={isSubmitting}>
              <Text style={styles.submitLink}>{isSubmitting ? 'Отправляем…' : 'Отправить'}</Text>
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
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 40, lineHeight: 36, color: '#010101' },
  close: { fontSize: 20, color: '#010101' },
  description: { fontFamily: 'Gramatika-Regular', fontSize: 18, lineHeight: 24, color: '#010101', marginBottom: 20 },
  footerRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  submitLink: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 15, color: '#E02D2D' },
});
