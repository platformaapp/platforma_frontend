import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { endpoints } from '@/constants/env';
import { uploadEventImage } from '@/lib/api/events';
import { getStudentProfile, updateStudentProfile } from '@/lib/api/student';
import { extractRefreshTokenFromResponse, extractTokenFromResponse, extractUserFromResponse, saveAuthToken, UserProfile } from '@/lib/auth';

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
 * Веб-версия регистрации студента (см. register-student.tsx для нативной).
 * ВАЖНО: макет для веба не содержит поля телефона — в отличие от нативной формы,
 * где оно обязательное. Бэкенду нужно принимать /api/auth/register без `phone`
 * (см. итоговое резюме в чате) — иначе тут будет падать 400.
 */
export default function RegisterStudentScreenWeb() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarFileSize, setAvatarFileSize] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string; password2?: string }>({});

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Ошибка', 'Необходимо разрешение на доступ к фотографиям');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const MAX_SIZE = 8 * 1024 * 1024;
      if (asset.fileSize && asset.fileSize > MAX_SIZE) {
        Alert.alert('Фото слишком большое', 'Размер файла превышает 8 МБ. Выберите фото меньшего размера.');
        return;
      }
      setAvatarUri(asset.uri);
      setAvatarFileSize(asset.fileSize ?? null);
    }
  }

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

    const MAX_SIZE = 8 * 1024 * 1024;
    if (avatarUri && avatarFileSize && avatarFileSize > MAX_SIZE) {
      Alert.alert('Фото слишком большое', 'Выберите фото меньшего размера (до 8 МБ).');
      return;
    }

    setIsSubmitting(true);
    try {
      const requestBody: Record<string, string> = {
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role: 'student',
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
            Alert.alert('Аккаунт уже существует', translated, [
              { text: 'Войти', onPress: () => router.replace('/login?showLogin=1' as any) },
              { text: 'Отмена', style: 'cancel' },
            ]);
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
      const user = extractUserFromResponse(data);

      if (token) {
        const userProfile = user ? { ...user, role: 'student' } : undefined;
        await saveAuthToken(token, 'student', refreshToken, userProfile);

        let uploadedAvatarUrl: string | undefined;
        if (avatarUri) {
          try {
            uploadedAvatarUrl = await uploadEventImage(avatarUri);
            await updateStudentProfile({ avatarUrl: uploadedAvatarUrl });
          } catch (uploadErr: any) {
            setAvatarUploadError(uploadErr?.message ?? 'Не удалось загрузить фото. Добавьте его позже в профиле.');
          }
        }

        try {
          const sp = await getStudentProfile();
          const fresh: UserProfile = {
            id: String((sp as any).id ?? user?.id ?? ''),
            email: sp.email ?? user?.email ?? email.trim(),
            full_name: sp.full_name ?? (sp as any).fullName ?? user?.full_name ?? fullName.trim(),
            avatar_url: (sp as any).avatar_url ?? (sp as any).avatarUrl ?? user?.avatar_url ?? uploadedAvatarUrl,
            role: 'student',
          };
          if (fresh.id) await saveAuthToken(token, 'student', refreshToken, fresh);
        } catch { /* ignore */ }
      }

      router.push('/registration-complete');
    } catch (e: any) {
      const translatedMsg = translateAuthError(e?.message ?? '');
      setGeneralError(translatedMsg || 'Неизвестная ошибка');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.card}>
        <Text style={styles.title}>РЕГИСТРАЦИЯ УЧАСТНИКА</Text>

        <LabeledInput placeholder="Имя и фамилия" value={fullName} error={errors.fullName}
          onChangeText={(t: string) => { setFullName(t); if (errors.fullName) setErrors((e) => ({ ...e, fullName: undefined })); }} />
        {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}

        <LabeledInput placeholder="Почта" value={email} error={errors.email} autoCapitalize="none" keyboardType="email-address"
          onChangeText={(t: string) => { setEmail(t); if (errors.email) setErrors((e) => ({ ...e, email: undefined })); }} />
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

        <LabeledInput placeholder="Телеграм" value={telegram} autoCapitalize="none"
          onChangeText={(t: string) => setTelegram(t.replace(/^@/, ''))} />

        <Pressable style={[styles.upload, avatarUri && styles.uploadWithPhotoContainer]} onPress={pickImage}>
          {avatarUri ? (
            <View style={styles.uploadWithPhoto}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
              <Text style={styles.replacePhotoText}>Заменить фото</Text>
            </View>
          ) : (
            <Text style={styles.uploadText}>Загрузить фото</Text>
          )}
        </Pressable>
        {avatarUploadError ? <Text style={styles.errorText}>{avatarUploadError}</Text> : null}

        <PasswordInput placeholder="Пароль" value={password} visible={show1} onToggle={() => setShow1(!show1)} error={errors.password}
          onChangeText={(t: string) => { setPassword(t); if (errors.password) setErrors((e) => ({ ...e, password: undefined })); }} />
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

        <PasswordInput placeholder="Ещё раз пароль" value={password2} visible={show2} onToggle={() => setShow2(!show2)} error={errors.password2}
          onChangeText={(t: string) => { setPassword2(t); if (errors.password2) setErrors((e) => ({ ...e, password2: undefined })); }} />
        {errors.password2 ? <Text style={styles.errorText}>{errors.password2}</Text> : null}

        <Text style={styles.hint}>Пароль должен быть не менее 7 символов и содержать буквы, цифры и спецсимволы</Text>

        {generalError ? <Text style={styles.errorText}>{generalError}</Text> : null}

        <Pressable style={[styles.btnPrimary, isSubmitting && styles.btnDisabled]} onPress={onSubmit} disabled={isSubmitting}>
          <Text style={styles.btnPrimaryText}>{isSubmitting ? 'Отправляем…' : 'Далее'}</Text>
        </Pressable>

        <Text style={styles.terms}>
          Нажимая кнопку «Далее», вы принимаете{' '}
          <Text style={styles.termsLink} onPress={() => router.push('/offer' as any)}>публичную оферту</Text>
          {' '}и{' '}
          <Text style={styles.termsLink} onPress={() => router.push('/privacy' as any)}>политику конфиденциальности</Text>
        </Text>
      </View>
    </View>
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
  page: { flex: 1, minHeight: '100vh' as any, alignItems: 'center', backgroundColor: '#fff', padding: 24, paddingTop: 48, paddingBottom: 48 },
  card: { width: '100%', maxWidth: 420, borderWidth: 1, borderColor: '#CFCFCF', padding: 32 },
  title: { fontFamily: 'Inter-Bold', fontSize: 18, letterSpacing: 1, color: '#181818', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#181818', paddingVertical: 12, paddingHorizontal: 12, marginBottom: 12, fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
  inputError: { borderColor: '#E02D2D', color: '#E02D2D' },
  errorText: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#E02D2D', marginTop: -8, marginBottom: 12 },
  hint: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16, color: '#687076', marginBottom: 16 },
  eye: { position: 'absolute', right: 10, top: 10 },
  upload: { borderWidth: 1, borderColor: '#181818', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12, minHeight: 48 },
  uploadWithPhotoContainer: { paddingVertical: 0, paddingHorizontal: 0 },
  uploadWithPhoto: { flexDirection: 'row', width: '100%', alignItems: 'center', paddingHorizontal: 12, gap: 12 },
  uploadText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
  avatar: { width: 40, height: 40, backgroundColor: '#f0f0f0' },
  replacePhotoText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
  btnPrimary: { backgroundColor: '#111', height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#FAFAFA' },
  terms: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16, color: '#181818' },
  termsLink: { textDecorationLine: 'underline' },
});
