import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { SiteShell } from '@/components/web/site-shell';
import { endpoints } from '@/constants/env';
import { extractRefreshTokenFromResponse, extractTokenFromResponse, saveAuthToken } from '@/lib/auth';

const REGISTER_URL = endpoints.register;

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered with role: tutor')) return 'Этот аккаунт уже зарегистрирован как наставник. Войдите в аккаунт.';
  if (m.includes('already registered with role: student')) return 'Этот аккаунт уже зарегистрирован как студент. Войдите в аккаунт.';
  if (m.includes('already registered')) return 'Пользователь с такими данными уже зарегистрирован. Войдите в аккаунт.';
  if (m.includes('email already exists') || (m.includes('email') && m.includes('already'))) return 'Такой email уже зарегистрирован';
  if (m.includes('already exists')) return 'Пользователь с такими данными уже существует';
  return message;
}

/**
 * Веб-версия регистрации наставника, шаг 1 (см. register-tutor.tsx для
 * нативной — там есть ещё поле "Телефон", в макете для веба его нет;
 * бэкенд его и не требует, phone опционален в RegistrationDto).
 */
export default function RegisterTutorScreenWeb() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string; password2?: string }>({});

  async function onSubmit() {
    const newErrors: typeof errors = {};
    if (!fullName.trim()) newErrors.fullName = 'Поле не заполнено!';
    if (!email.trim()) newErrors.email = 'Поле не заполнено!';
    else if (!email.includes('@')) newErrors.email = 'Неверный формат email';
    if (password.length < 7) newErrors.password = 'Пароль слишком короткий!';
    if (!password2.trim()) newErrors.password2 = 'Поле не заполнено!';
    else if (password !== password2) newErrors.password2 = 'Пароли не совпадают!';

    setErrors(newErrors);
    setGeneralError(null);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const requestBody: Record<string, string> = {
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role: 'tutor',
        bio: '',
      };
      if (telegram.trim()) requestBody.telegram = telegram.trim().replace(/^@/, '');

      const res = await fetch(REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          const errorMessage = data?.message || data?.error || '';
          const lowerMessage = errorMessage.toLowerCase();
          const translated = translateAuthError(errorMessage);
          if (lowerMessage.includes('already registered') || lowerMessage.includes('уже зарегистрирован')) {
            setGeneralError(translated);
          } else if (lowerMessage.includes('email') || lowerMessage.includes('почта')) {
            setErrors((e) => ({ ...e, email: translated }));
          } else {
            setGeneralError(translated || 'Пользователь с такими данными уже существует');
          }
          setIsSubmitting(false);
          return;
        }
        if (res.status === 400) {
          setErrors((e) => ({ ...e, email: data?.message || data?.error || 'Ошибка регистрации' }));
          setIsSubmitting(false);
          return;
        }
        setGeneralError(data?.message || data?.error || `Ошибка регистрации (${res.status})`);
        setIsSubmitting(false);
        return;
      }

      const token = extractTokenFromResponse(data);
      const refreshToken = extractRefreshTokenFromResponse(data);
      if (token) await saveAuthToken(token, 'tutor', refreshToken);

      router.push('/register-tutor-step2');
    } catch (e: any) {
      setGeneralError(translateAuthError(e?.message ?? '') || 'Неизвестная ошибка');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SiteShell>
      <View style={styles.page}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Регистрация наставника</Text>
            <Pressable onPress={() => router.back()}><Text style={styles.close}>✕</Text></Pressable>
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <LabeledInput placeholder="Имя и фамилия" value={fullName} error={errors.fullName}
              onChangeText={(t: string) => { setFullName(t); if (errors.fullName) setErrors((e) => ({ ...e, fullName: undefined })); }} />
            {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}

            <LabeledInput placeholder="Почта" value={email} error={errors.email} autoCapitalize="none" keyboardType="email-address"
              onChangeText={(t: string) => { setEmail(t); if (errors.email) setErrors((e) => ({ ...e, email: undefined })); }} />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

            <LabeledInput placeholder="Телеграм" value={telegram} autoCapitalize="none"
              onChangeText={(t: string) => setTelegram(t.replace(/^@/, ''))} />

            <PasswordInput placeholder="Пароль" value={password} visible={show1} onToggle={() => setShow1(!show1)} error={errors.password}
              onChangeText={(t: string) => { setPassword(t); if (errors.password) setErrors((e) => ({ ...e, password: undefined })); }} />
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

            <PasswordInput placeholder="Ещё раз пароль" value={password2} visible={show2} onToggle={() => setShow2(!show2)} error={errors.password2}
              onChangeText={(t: string) => { setPassword2(t); if (errors.password2) setErrors((e) => ({ ...e, password2: undefined })); }} />
            {errors.password2 ? <Text style={styles.errorText}>{errors.password2}</Text> : null}

            <Text style={styles.hint}>Пароль должен быть не менее 7 символов и содержать буквы, цифры и спецсимволы</Text>

            {generalError ? <Text style={styles.errorText}>{generalError}</Text> : null}
          </ScrollView>

          <View style={styles.footerRow}>
            <Text style={styles.terms}>
              Нажимая кнопку «Далее», вы принимаете{' '}
              <Text style={styles.termsLink} onPress={() => router.push('/offer' as any)}>публичную оферту</Text>
              {' '}и{' '}
              <Text style={styles.termsLink} onPress={() => router.push('/privacy' as any)}>политику конфиденциальности</Text>
            </Text>
            <Pressable onPress={onSubmit} disabled={isSubmitting}>
              <Text style={styles.nextLink}>{isSubmitting ? 'Отправляем…' : 'Далее'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SiteShell>
  );
}

function LabeledInput({ error, ...props }: any) {
  return <TextInput placeholderTextColor={error ? '#E02D2D' : '#888'} style={[styles.input, error && styles.inputError]} {...props} />;
}

function PasswordInput({ visible, onToggle, error, ...props }: any) {
  return (
    <View style={{ position: 'relative' }}>
      <TextInput placeholderTextColor={error ? '#E02D2D' : '#888'} style={[styles.input, error && styles.inputError]} secureTextEntry={!visible} {...props} />
      <Pressable onPress={onToggle} style={styles.eye}>
        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <Path d="M2 12C3.7 7.6 7.5 5 12 5C16.5 5 20.3 7.6 22 12C20.3 16.4 16.5 19 12 19C7.5 19 3.7 16.4 2 12Z" stroke="#181818" strokeWidth="1.5" />
          <Circle cx="12" cy="12" r="3" stroke="#181818" strokeWidth="1.5" />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 },
  card: { width: '100%', maxWidth: 520, maxHeight: '85%', backgroundColor: '#fff', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontFamily: 'Inter-Bold', fontSize: 22, color: '#181818' },
  close: { fontSize: 20, color: '#181818' },
  scroll: { flexGrow: 0 },
  input: { borderWidth: 1, borderColor: '#181818', paddingVertical: 12, paddingHorizontal: 12, marginBottom: 12, fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
  inputError: { borderColor: '#E02D2D', color: '#E02D2D' },
  errorText: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#E02D2D', marginTop: -8, marginBottom: 12 },
  hint: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16, color: '#687076', marginBottom: 4 },
  eye: { position: 'absolute', right: 10, top: 10 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginTop: 16 },
  terms: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16, color: '#181818' },
  termsLink: { textDecorationLine: 'underline' },
  nextLink: { fontFamily: 'Inter-Medium', fontSize: 15, color: '#E02D2D' },
});
