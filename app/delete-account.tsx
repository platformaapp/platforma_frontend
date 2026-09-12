import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { endpoints } from '@/constants/env';

/**
 * Публичная веб-страница для запроса/подтверждения удаления аккаунта — доступна
 * без установки приложения и без входа (требование Google Play для приложений
 * с регистрацией). Без ?token в URL — форма запроса (вводите email, получаете
 * письмо со ссылкой). Со ?token — подтверждение удаления по ссылке из письма.
 */
export default function DeleteAccountPublicScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();

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

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validateEmail(value: string): string | null {
    if (!value) return 'Поле не заполнено';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Неверный формат email';
    return null;
  }

  async function handleRequest() {
    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(endpoints.accountDeletionRequest, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      await res.json().catch(() => ({}));
      // Бэкенд намеренно не раскрывает, существует ли email — просто показываем успех.
      setRequestSent(true);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось отправить запрос. Попробуйте позже.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (!token) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(endpoints.accountDeletionConfirm, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? `Ссылка недействительна или истекла (${res.status})`);
        return;
      }
      setConfirmed(true);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось удалить аккаунт. Попробуйте позже.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.replace('/')}>
            <Text style={styles.backText}>← На главную</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Удаление аккаунта Platforma</Text>

          {token ? (
            confirmed ? (
              <>
                <Text style={styles.description}>Аккаунт удалён.</Text>
                <Text style={styles.hint}>
                  Личные данные (имя, email, телефон, telegram, фото, способы оплаты) удалены. Записи о прошедших
                  событиях и платежах сохранены обезличенными для истории и бухгалтерии.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.description}>
                  Вы запросили удаление аккаунта. Это действие необратимо.
                </Text>
                <Text style={styles.hint}>
                  Будут удалены: имя, email, телефон, telegram, фото профиля, способы оплаты. Нажмите кнопку ниже,
                  чтобы подтвердить.
                </Text>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <Pressable style={[styles.btnDanger, isSubmitting && styles.btnDisabled]} onPress={handleConfirm} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnDangerText}>Подтвердить удаление</Text>}
                </Pressable>
              </>
            )
          ) : requestSent ? (
            <>
              <Text style={styles.description}>
                Если такой email зарегистрирован, на него отправлена ссылка для подтверждения удаления.
              </Text>
              <Text style={styles.hint}>Проверьте почту и перейдите по ссылке в течение часа.</Text>
            </>
          ) : (
            <>
              <Text style={styles.description}>
                Укажите email, привязанный к аккаунту. Мы пришлём ссылку для подтверждения удаления.
              </Text>
              <TextInput
                placeholder="Почта"
                placeholderTextColor="#9B9B9B"
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, error && styles.inputError]}
                value={email}
                onChangeText={(t) => { setEmail(t); if (error) setError(null); }}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable style={[styles.btnDanger, isSubmitting && styles.btnDisabled]} onPress={handleRequest} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnDangerText}>Отправить ссылку</Text>}
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  backBtn: { paddingVertical: 12 },
  backText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#687076' },
  content: { paddingHorizontal: 16, paddingBottom: 48, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { fontFamily: 'Inter-Bold', fontSize: 24, color: '#181818', marginTop: 24, marginBottom: 16 },
  description: { fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 22, color: '#181818', marginBottom: 12 },
  hint: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 19, color: '#687076', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#181818', paddingVertical: 14, paddingHorizontal: 12, marginBottom: 8, fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
  inputError: { borderColor: '#E02D2D' },
  errorText: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#E02D2D', marginBottom: 12 },
  btnDanger: { backgroundColor: '#E02D2D', paddingVertical: 16, alignItems: 'center', justifyContent: 'center', height: 52, marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnDangerText: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#fff' },
});
