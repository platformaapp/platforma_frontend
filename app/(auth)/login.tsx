import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { endpoints } from '@/constants/env';
import { extractRefreshTokenFromResponse, extractTokenFromResponse, extractUserFromResponse, getAuthRole, saveAuthToken } from '@/lib/auth';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role: roleParam, showLogin: showLoginParam } = useLocalSearchParams<{ role?: string; showLogin?: string }>();
  const [showLogin, setShowLogin] = useState(showLoginParam === '1');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [isMentor, setIsMentor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const initRole = async () => {
      const resolvedRole =
        typeof roleParam === 'string' ? roleParam : Array.isArray(roleParam) ? roleParam[0] : undefined;
      const storedRole = await getAuthRole();
      const role = resolvedRole || storedRole;
      if (isMounted && role === 'tutor') setIsMentor(true);
    };
    initRole();
    return () => { isMounted = false; };
  }, [roleParam]);

  async function onSubmit() {
    if (!email || !password) { Alert.alert('Введите почту и пароль'); return; }
    setLoginError('');
    setIsSubmitting(true);
    try {
      const role = isMentor ? 'tutor' : 'student';
      const res = await fetch(endpoints.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, role }),
      });
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await res.json() : await res.text();
      if (!res.ok) {
        if (res.status >= 500) throw new Error('Ошибка сервера. Попробуйте позже.');
        const message = typeof data === 'string' ? data : data?.message || 'Не удалось войти';
        throw new Error(message);
      }
      const token = extractTokenFromResponse(data);
      const refreshToken = extractRefreshTokenFromResponse(data);
      const user = extractUserFromResponse(data);
      if (token) {
        const userProfile = user ? { ...user, role } : undefined;
        await saveAuthToken(token, role, refreshToken, userProfile);
      }
      if (user?.id) {
        router.replace(`/(tabs)/profile/${user.id}`);
      } else {
        router.replace('/(tabs)/events');
      }
    } catch (e: any) {
      const message = e?.message ?? 'Неизвестная ошибка';
      const normalized = message.toLowerCase();
      const roleMismatch =
        normalized.includes('forbidden') || normalized.includes('роль') ||
        normalized.includes('role') || normalized.includes('доступ') ||
        normalized.includes('student') || normalized.includes('tutor');
      setLoginError(roleMismatch ? 'Аккаунт зарегистрирован с другой ролью' : message);
      Alert.alert('Ошибка', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const closeButton = (
    <Pressable
      style={[styles.close, { top: insets.top + 12 }]}
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/events');
      }}
    >
      <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <Path d="M2 2L22 22M22 2L2 22" stroke="#181818"/>
      </Svg>
    </Pressable>
  );

  // ── Экран выбора регистрации (по умолчанию) ──────────────────────────────
  if (!showLogin) {
    return (
      <ThemedView style={styles.container}>
        {closeButton}
        <ThemedText type="title" style={styles.title}>РЕГИСТРАЦИЯ</ThemedText>
        <View>
          <Link href="/register-student" asChild>
            <Pressable style={[styles.btn, styles.btnPrimary, { marginBottom: 16 }]}>
              <ThemedText style={[styles.btnPrimaryText, styles.btnCustomText]}>Хочу учиться</ThemedText>
            </Pressable>
          </Link>
          <Link href="/register-tutor" asChild>
            <Pressable style={[styles.btn, styles.btnOutline]}>
              <ThemedText style={[styles.btnOutlineText, styles.btnCustomText]}>Хочу учить</ThemedText>
            </Pressable>
          </Link>
        </View>
        <Pressable style={{ marginTop: 'auto', paddingVertical: 24 }} onPress={() => setShowLogin(true)}>
          <ThemedText style={styles.linkText}>У меня уже есть профиль</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  // ── Форма авторизации ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })} keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {closeButton}

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
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <Path d="M2 12C3.7 7.6 7.5 5 12 5C16.5 5 20.3 7.6 22 12C20.3 16.4 16.5 19 12 19C7.5 19 3.7 16.4 2 12Z" stroke="#181818" strokeWidth="1.5"/>
                  <Circle cx="12" cy="12" r="3" stroke="#181818" strokeWidth="1.5"/>
                </Svg>
              </Pressable>
            </View>

            <Pressable style={styles.checkboxRow} onPress={() => { setIsMentor((p) => !p); setLoginError(''); }}>
              <View style={styles.checkbox}>
                {isMentor && <ThemedText style={styles.checkboxCheckmark}>✓</ThemedText>}
              </View>
              <ThemedText style={styles.checkboxLabel}>Войти как наставник</ThemedText>
            </Pressable>

            {loginError ? <ThemedText style={styles.loginErrorText}>{loginError}</ThemedText> : null}

            <Pressable style={[styles.btn, styles.btnPrimary, isSubmitting && { opacity: 0.6 }]} onPress={onSubmit} disabled={isSubmitting}>
              <ThemedText style={[styles.btnPrimaryText, styles.btnCustomText]}>Войти</ThemedText>
            </Pressable>
          </View>
        </ThemedView>

        <View style={{ position: 'absolute', bottom: 32, left: 0, right: 0, alignItems: 'center', gap: 16 }}>
          <Pressable onPress={() => router.push('/forgot-password')}>
            <ThemedText style={styles.linkText}>Забыли пароль?</ThemedText>
          </Pressable>
          <Pressable onPress={() => setShowLogin(false)}>
            <ThemedText style={styles.linkText}>Нет аккаунта? Зарегистрироваться</ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, backgroundColor: '#fff' },
  title: {
    marginTop: 48, marginBottom: 24,
    fontFamily: 'Inter-Regular', fontSize: 28, fontWeight: '400',
    lineHeight: 36, letterSpacing: -2, color: '#181818',
  },
  input: {
    borderWidth: 1, borderColor: 'rgba(24,24,24,1)', borderRadius: 0,
    paddingVertical: 14, paddingHorizontal: 12, marginBottom: 12,
    fontFamily: 'Inter-Regular', fontSize: 14,
  },
  eye: { position: 'absolute', right: 12, top: 6, padding: 6 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 4 },
  checkbox: { width: 24, height: 24, borderWidth: 1, borderColor: '#181818', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  checkboxCheckmark: { fontSize: 16, color: '#181818', fontWeight: 'bold', lineHeight: 20 },
  checkboxLabel: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: '#181818' },
  loginErrorText: { marginTop: 4, fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: '#181818' },
  btn: { borderRadius: 0, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#111', marginTop: 4 },
  btnPrimary: { backgroundColor: '#111', height: 52, borderColor: 'rgba(24,24,24,1)' },
  btnPrimaryText: { color: '#FFF' },
  btnOutline: { backgroundColor: 'transparent', height: 52, borderColor: 'rgba(24,24,24,1)' },
  btnOutlineText: { color: '#111' },
  btnCustomText: { fontFamily: 'Inter-Regular', fontSize: 14, fontWeight: '400', lineHeight: 20 },
  linkText: { textAlign: 'center', fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: '#181818' },
  close: { position: 'absolute', right: 16, zIndex: 1, padding: 8 },
});
