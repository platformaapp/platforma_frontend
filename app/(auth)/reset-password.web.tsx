import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PlusField } from '@/components/web/plus-field';
import { SiteShell } from '@/components/web/site-shell';
import { endpoints } from '@/constants/env';

/** Веб-версия экрана нового пароля (см. reset-password.tsx для нативной). */
export default function ResetPasswordScreenWeb() {
  const router = useRouter();
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();

  // Фолбэк: читаем token прямо из URL, если роутер ещё не гидрировал search params
  // (SPA-фолбэк статического экспорта через nginx).
  const [token, setToken] = useState<string | undefined>(tokenParam || undefined);
  useEffect(() => {
    if (!token && typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('token');
      if (t) setToken(t);
    }
  }, []);
  useEffect(() => {
    if (tokenParam) setToken(tokenParam);
  }, [tokenParam]);

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error1, setError1] = useState<string | null>(null);
  const [error2, setError2] = useState<string | null>(null);

  function validatePassword(passwordValue: string): string | null {
    if (passwordValue.length < 7) return 'Пароль слишком короткий!';
    if (!/[a-zA-Zа-яА-Я0-9]/.test(passwordValue)) return 'Должна быть хотя бы одна буква или цифра!';
    return null;
  }

  function validatePasswordMatch(passwordValue: string, password2Value: string): string | null {
    if (passwordValue !== password2Value) return 'Пароли не совпадают!';
    return null;
  }

  async function onSubmit() {
    const error1Value = validatePassword(password);
    const error2Value = password2 ? validatePasswordMatch(password, password2) : null;

    if (error1Value) setError1(error1Value);
    if (error2Value) setError2(error2Value);
    if (error1Value || error2Value) return;

    if (!token) {
      setError1('Ссылка для сброса пароля недействительна. Запросите новую.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(endpoints.resetPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_token: token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError1(data?.message ?? data?.error ?? `Ошибка сброса пароля (${res.status})`);
        return;
      }
      router.replace('/login' as any);
    } catch (e: any) {
      setError1(e?.message ?? 'Ошибка при сбросе пароля');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SiteShell>
      {/* Modal (не обычный View с flex:1) — гарантированно перекрывает всю
          страницу независимо от окружающего flex-контекста, см. cookie-banner. */}
      <Modal transparent animationType="fade" visible onRequestClose={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/events' as any); }}>
      <View style={[styles.page, { pointerEvents: 'box-none' }]}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Новый пароль</Text>
            <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/events' as any); }}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <PlusField
            label="Новый пароль"
            value={password}
            secureTextEntry
            error={error1 ?? undefined}
            onChangeText={(text) => {
              setPassword(text);
              if (error1) setError1(null);
              if (password2 && text !== password2) setError2('Пароли не совпадают!');
              else if (password2 && text === password2 && error2 === 'Пароли не совпадают!') setError2(null);
            }}
          />

          <PlusField
            label="Повторите новый пароль"
            value={password2}
            secureTextEntry
            error={error2 ?? undefined}
            onChangeText={(text) => {
              setPassword2(text);
              if (error2) setError2(null);
              if (password && text !== password) setError2('Пароли не совпадают!');
              else if (password && text === password && error2 === 'Пароли не совпадают!') setError2(null);
            }}
          />

          <Text style={styles.hint}>Пароль должен быть не меньше 7 символов и состоять из букв, цифр и прикольных символов</Text>

          <View style={styles.footerRow}>
            <Pressable onPress={onSubmit} disabled={isSubmitting}>
              <Text style={styles.submitLink}>{isSubmitting ? 'Сохраняем…' : 'Сохранить и войти'}</Text>
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
  hint: { fontFamily: 'Gramatika-Regular', fontSize: 12, lineHeight: 16, color: '#9B9B9B', marginTop: -12 },
  footerRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 },
  submitLink: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 15, color: '#E02D2D' },
});
