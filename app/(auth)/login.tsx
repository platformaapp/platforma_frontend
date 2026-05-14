import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { endpoints } from '@/constants/env';
import { getStudentProfile } from '@/lib/api/student';
import {
  extractRefreshTokenFromResponse,
  extractTokenFromResponse,
  extractUserFromResponse,
  getAuthRole,
  saveAuthToken,
  UserProfile,
} from '@/lib/auth';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role: roleParam, showLogin: showLoginParam } = useLocalSearchParams<{ role?: string; showLogin?: string }>();
  const [showLogin, setShowLogin] = useState(showLoginParam === '1');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [isMentor, setIsMentor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const initRole = async () => {
      const resolved = typeof roleParam === 'string' ? roleParam : Array.isArray(roleParam) ? roleParam[0] : undefined;
      const stored = await getAuthRole();
      const role = resolved || stored;
      if (isMounted && role === 'tutor') setIsMentor(true);
    };
    initRole();
    return () => { isMounted = false; };
  }, [roleParam]);

  const handleClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/events');
  };

  async function onSubmit() {
    if (!email || !password) { Alert.alert('Введите почту и пароль'); return; }
    setLoginError('');
    setIsSubmitting(true);
    try {
      const role = isMentor ? 'tutor' : 'student';
      const res = await fetch(endpoints.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password, role }),
      });
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await res.json() : await res.text();
      if (!res.ok) {
        if (res.status >= 500) throw new Error('Ошибка сервера. Попробуйте позже.');
        throw new Error(typeof data === 'string' ? data : data?.message || 'Не удалось войти');
      }
      const token = extractTokenFromResponse(data);
      const refreshToken = extractRefreshTokenFromResponse(data);
      const user = extractUserFromResponse(data);
      if (token) {
        // Save initial profile from login response so navigation works immediately
        await saveAuthToken(token, role, refreshToken, user ? { ...user, role } : undefined);

        // Fetch fresh profile from server — overwrites login-response data with authoritative data
        // This fixes stale name/avatar persisting across re-logins
        if (role === 'student') {
          try {
            const sp = await getStudentProfile();
            const fresh: UserProfile = {
              id: String((sp as any).id ?? user?.id ?? ''),
              email: sp.email ?? user?.email,
              full_name: sp.full_name ?? (sp as any).fullName ?? (sp as any).name ?? user?.full_name,
              phone: sp.phone ?? user?.phone,
              avatar_url: (sp as any).avatar_url ?? (sp as any).avatarUrl ?? user?.avatar_url,
              role,
            };
            if (fresh.id) await saveAuthToken(token, role, refreshToken, fresh);
          } catch { /* ignore — initial save above is enough to proceed */ }
        }
      }
      router.replace(user?.id ? `/(tabs)/profile/${user.id}` : '/(tabs)/events');
    } catch (e: any) {
      const message = e?.message ?? 'Неизвестная ошибка';
      const n = message.toLowerCase();
      const roleMismatch = n.includes('forbidden') || n.includes('роль') || n.includes('role') ||
        n.includes('доступ') || n.includes('student') || n.includes('tutor');
      setLoginError(roleMismatch ? 'Аккаунт зарегистрирован с другой ролью' : message);
      Alert.alert('Ошибка', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const closeBtn = (
    <Pressable style={[styles.close, { top: insets.top + 12 }]} onPress={handleClose}>
      <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <Path d="M2 2L22 22M22 2L2 22" stroke="#181818" />
      </Svg>
    </Pressable>
  );

  // ── Экран регистрации (по умолчанию) ─────────────────────────────────────
  if (!showLogin) {
    return (
      <View style={styles.screen}>
        {closeBtn}
        <View style={styles.centerArea}>
          <Text style={styles.title}>РЕГИСТРАЦИЯ</Text>
          <Pressable
            style={[styles.btn, styles.btnPrimary, { marginBottom: 12 }]}
            onPress={() => router.push('/register-student' as any)}
          >
            <Text style={[styles.btnText, styles.btnPrimaryText]}>Хочу учиться</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnOutline]}
            onPress={() => router.push('/register-tutor' as any)}
          >
            <Text style={[styles.btnText, styles.btnOutlineText]}>Хочу учить</Text>
          </Pressable>
        </View>
        <View style={[styles.bottomLinks, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <Pressable onPress={() => setShowLogin(true)}>
            <Text style={styles.linkText}>У меня уже есть профиль</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Форма авторизации ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}
    >
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.centerArea}>
          <Text style={styles.title}>АВТОРИЗАЦИЯ</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              placeholder="Почта"
              placeholderTextColor="#888"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
            {email.length > 0 && (
              <Pressable onPress={() => setEmail('')} style={styles.eye} hitSlop={8}>
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <Path d="M2 2L22 22M22 2L2 22" stroke="#9B9B9B" strokeWidth="1.8" strokeLinecap="round" />
                </Svg>
              </Pressable>
            )}
          </View>
          <View style={{ position: 'relative' }}>
            <TextInput
              placeholder="Пароль"
              placeholderTextColor="#888"
              secureTextEntry={!showPwd}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable onPress={() => setShowPwd(p => !p)} style={styles.eye}>
              <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <Path d="M2 12C3.7 7.6 7.5 5 12 5C16.5 5 20.3 7.6 22 12C20.3 16.4 16.5 19 12 19C7.5 19 3.7 16.4 2 12Z" stroke="#181818" strokeWidth="1.5" />
                <Circle cx="12" cy="12" r="3" stroke="#181818" strokeWidth="1.5" />
              </Svg>
            </Pressable>
          </View>
          <Pressable style={styles.checkboxRow} onPress={() => { setIsMentor(p => !p); setLoginError(''); }}>
            <View style={styles.checkbox}>
              {isMentor && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Войти как наставник</Text>
          </Pressable>
          {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
          <Pressable
            style={[styles.btn, styles.btnPrimary, isSubmitting && { opacity: 0.6 }]}
            onPress={onSubmit}
            disabled={isSubmitting}
          >
            <Text style={[styles.btnText, styles.btnPrimaryText]}>Войти</Text>
          </Pressable>
        </View>
        <View style={[styles.bottomLinks, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <Pressable onPress={() => router.push('/forgot-password')}>
            <Text style={styles.linkText}>Забыли пароль?</Text>
          </Pressable>
          <Pressable onPress={() => setShowLogin(false)}>
            <Text style={styles.linkText}>Нет аккаунта? Зарегистрироваться</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: '#fff' },
  close: { position: 'absolute', right: 16, zIndex: 10, padding: 8 },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 60,
  },
  title: {
    fontFamily: 'Inter-Regular',
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 36,
    letterSpacing: -2,
    color: '#181818',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#181818',
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#181818',
  },
  eye: { position: 'absolute', right: 12, top: 6, padding: 6 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 4 },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#181818',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: { fontSize: 16, color: '#181818', fontWeight: 'bold', lineHeight: 20 },
  checkboxLabel: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: '#181818' },
  errorText: { marginTop: 4, fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: '#E02D2D' },
  btn: { height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginTop: 4 },
  btnPrimary: { backgroundColor: '#111', borderColor: '#181818' },
  btnOutline: { backgroundColor: 'transparent', borderColor: '#181818' },
  btnText: { fontFamily: 'Inter-Regular', fontSize: 14, fontWeight: '400', lineHeight: 20 },
  btnPrimaryText: { color: '#FFF' },
  btnOutlineText: { color: '#181818' },
  bottomLinks: { alignItems: 'center', gap: 16, paddingHorizontal: 16 },
  linkText: { textAlign: 'center', fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: '#181818' },
});
