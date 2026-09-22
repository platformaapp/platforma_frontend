import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PlusField } from '@/components/web/plus-field';
import { SiteShell } from '@/components/web/site-shell';
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

/**
 * Веб-версия экрана логина (см. login.tsx для нативной). Как и в нативной —
 * два состояния одного экрана: выбор регистрации (по умолчанию) и форма
 * авторизации (showLogin=1 в query, или после клика "У меня уже есть профиль").
 * Фигма даёт только форму авторизации — состояние выбора регистрации
 * оформлено как index.web.tsx (тот же макет "Регистрация").
 */
export default function LoginScreenWeb() {
  const router = useRouter();
  const { role: roleParam, showLogin: showLoginParam, redirect: redirectParam } = useLocalSearchParams<{ role?: string; showLogin?: string; redirect?: string }>();
  const [showLogin, setShowLogin] = useState(showLoginParam === '1');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    else router.replace('/(tabs)/events' as any);
  };

  async function onSubmit() {
    if (!email || !password) { setLoginError('Введите почту и пароль'); return; }
    setLoginError('');
    setIsSubmitting(true);
    try {
      const role = isMentor ? 'tutor' : 'student';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let res: Response;
      try {
        res = await fetch(endpoints.login, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({ email: email.trim(), password, role }),
        });
      } catch (fetchErr: any) {
        if (fetchErr?.name === 'AbortError') throw new Error('Сервер не отвечает. Проверьте соединение и попробуйте ещё раз.');
        throw fetchErr;
      } finally {
        clearTimeout(timeoutId);
      }
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
        // Сохраняем профиль из ответа логина сразу, чтобы навигация сработала без задержки
        await saveAuthToken(token, role, refreshToken, user ? { ...user, role } : undefined);

        // Подтягиваем свежий профиль с сервера — перекрывает данные из логина
        // авторитетными (иначе после повторного логина остаётся старое имя/аватар)
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
          } catch { /* ignore — исходного сохранения выше достаточно, чтобы продолжить */ }
        }
      }
      const redirectTo = typeof redirectParam === 'string' && redirectParam ? redirectParam : null;
      router.replace((redirectTo ?? (user?.id ? `/(tabs)/profile/${user.id}` : '/(tabs)/events')) as any);
    } catch (e: any) {
      const message = e?.message ?? 'Неизвестная ошибка';
      const n = message.toLowerCase();
      const roleMismatch = n.includes('forbidden') || n.includes('роль') || n.includes('role') ||
        n.includes('доступ') || n.includes('student') || n.includes('tutor');
      setLoginError(roleMismatch ? 'Аккаунт зарегистрирован с другой ролью' : message);
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
          {!showLogin ? (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.title}>Регистрация</Text>
                <Pressable onPress={handleClose}><Text style={styles.close}>✕</Text></Pressable>
              </View>

              <View style={styles.choiceLinks}>
                <Pressable style={styles.choiceLinkRow} onPress={() => router.push('/register-student' as any)}>
                  <Text style={styles.choiceLinkText}>Хочу учиться</Text>
                </Pressable>
                <Pressable style={styles.choiceLinkRow} onPress={() => router.push('/register-tutor' as any)}>
                  <Text style={styles.choiceLinkText}>Хочу учить</Text>
                </Pressable>
              </View>

              <Pressable onPress={() => setShowLogin(true)} style={styles.switchLink}>
                <Text style={styles.switchLinkText}>У меня уже есть профиль</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.title}>Авторизация</Text>
                <Pressable onPress={handleClose}><Text style={styles.close}>✕</Text></Pressable>
              </View>

              <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
                <PlusField label="Логин" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                <PlusField label="Пароль" value={password} onChangeText={setPassword} secureTextEntry />

                <Pressable style={styles.checkboxRow} onPress={() => { setIsMentor((p) => !p); setLoginError(''); }}>
                  <View style={styles.checkbox}>
                    {isMentor && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Войти как наставник</Text>
                </Pressable>

                {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
              </ScrollView>

              <View style={styles.footerRow}>
                <Pressable onPress={() => router.push('/forgot-password' as any)}>
                  <Text style={styles.linkText}>Забыли пароль?</Text>
                </Pressable>
                <Pressable onPress={onSubmit} disabled={isSubmitting}>
                  <Text style={styles.submitLink}>{isSubmitting ? 'Входим…' : 'Войти'}</Text>
                </Pressable>
              </View>

              <Pressable onPress={() => setShowLogin(false)} style={styles.switchLink}>
                <Text style={styles.switchLinkText}>Нет аккаунта? Зарегистрироваться</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
      </Modal>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 },
  card: { width: '100%', maxWidth: 420, maxHeight: '85%', backgroundColor: '#fff', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 40, lineHeight: 36, color: '#010101' },
  close: { fontSize: 20, color: '#010101' },
  scroll: { flexGrow: 0 },

  choiceLinks: { gap: 4, marginBottom: 8 },
  choiceLinkRow: { paddingVertical: 10 },
  choiceLinkText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 18, color: '#E02D2D' },
  switchLink: { marginTop: 16, alignItems: 'center' },
  switchLinkText: { fontFamily: 'Gramatika-Regular', fontSize: 13, color: '#687076' },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 4 },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderColor: '#010101', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  checkmark: { fontSize: 14, color: '#010101', fontWeight: 'normal', lineHeight: 18 },
  checkboxLabel: { fontFamily: 'Gramatika-Regular', fontSize: 14, lineHeight: 20, color: '#010101' },
  errorText: { fontFamily: 'Gramatika-Regular', fontSize: 13, color: '#E02D2D', marginTop: 8 },

  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 16 },
  linkText: { fontFamily: 'Gramatika-Regular', fontSize: 13, color: '#687076' },
  submitLink: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 15, color: '#E02D2D' },
});
