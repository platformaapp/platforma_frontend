import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

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
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
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
      <View style={styles.page}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Новый пароль</Text>
            <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/events' as any); }}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.fieldLabel}>Новый пароль</Text>
          <PasswordField
            value={password}
            visible={show1}
            onToggle={() => setShow1((v) => !v)}
            error={error1}
            onChangeText={(text: string) => {
              setPassword(text);
              if (error1) setError1(null);
              if (password2 && text !== password2) setError2('Пароли не совпадают!');
              else if (password2 && text === password2 && error2 === 'Пароли не совпадают!') setError2(null);
            }}
          />
          {error1 ? <Text style={styles.errorText}>{error1}</Text> : null}

          <Text style={styles.fieldLabel}>Повторите новый пароль</Text>
          <PasswordField
            value={password2}
            visible={show2}
            onToggle={() => setShow2((v) => !v)}
            error={error2}
            onChangeText={(text: string) => {
              setPassword2(text);
              if (error2) setError2(null);
              if (password && text !== password) setError2('Пароли не совпадают!');
              else if (password && text === password && error2 === 'Пароли не совпадают!') setError2(null);
            }}
          />
          {error2 ? <Text style={styles.errorText}>{error2}</Text> : null}

          <Text style={styles.hint}>Пароль должен быть не меньше 7 символов и состоять из букв, цифр и прикольных символов</Text>

          <View style={styles.footerRow}>
            <Pressable onPress={onSubmit} disabled={isSubmitting}>
              <Text style={styles.submitLink}>{isSubmitting ? 'Сохраняем…' : 'Сохранить и войти'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SiteShell>
  );
}

function PasswordField({ visible, onToggle, error, ...props }: any) {
  return (
    <View style={{ position: 'relative', marginBottom: 4 }}>
      <TextInput
        placeholderTextColor={error ? '#E02D2D' : '#888'}
        style={[styles.input, error && styles.inputError]}
        secureTextEntry={!visible}
        {...props}
      />
      <Pressable onPress={onToggle} style={styles.eye}>
        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <Path d="M2 12C3.7 7.6 7.5 5 12 5C16.5 5 20.3 7.6 22 12C20.3 16.4 16.5 19 12 19C7.5 19 3.7 16.4 2 12Z" stroke="#010101" strokeWidth="1.5" />
          <Circle cx="12" cy="12" r="3" stroke="#010101" strokeWidth="1.5" />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: 'Gramatika-Bold', fontSize: 40, lineHeight: 36, color: '#010101' },
  close: { fontSize: 20, color: '#010101' },
  fieldLabel: { fontFamily: 'Gramatika-Regular', fontSize: 12, color: '#9B9B9B', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#010101', paddingVertical: 12, paddingHorizontal: 12, fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#010101' },
  inputError: { borderColor: '#E02D2D', color: '#E02D2D' },
  eye: { position: 'absolute', right: 10, top: 10 },
  errorText: { fontFamily: 'Gramatika-Regular', fontSize: 13, color: '#E02D2D', marginTop: 4, marginBottom: 8 },
  hint: { fontFamily: 'Gramatika-Regular', fontSize: 12, lineHeight: 16, color: '#9B9B9B', marginTop: 4 },
  footerRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 },
  submitLink: { fontFamily: 'Gramatika-Bold', fontSize: 15, color: '#E02D2D' },
});
