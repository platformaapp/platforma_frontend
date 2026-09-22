import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';

import { PlusField } from '@/components/web/plus-field';
import { SiteShell } from '@/components/web/site-shell';
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
    <SiteShell>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Modal (не обычный View с flex:1) — гарантированно перекрывает всю
          страницу независимо от окружающего flex-контекста, см. cookie-banner. */}
      <Modal transparent animationType="fade" visible onRequestClose={() => router.back()}>
      <View style={[styles.page, { pointerEvents: 'box-none' }]}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Регистрация ученика</Text>
          <Pressable onPress={() => router.back()}><Text style={styles.close}>✕</Text></Pressable>
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <PlusField label="Имя" value={fullName} error={errors.fullName}
          onChangeText={(t) => { setFullName(t); if (errors.fullName) setErrors((e) => ({ ...e, fullName: undefined })); }} />

        <PlusField label="Почта" value={email} error={errors.email} autoCapitalize="none" keyboardType="email-address"
          onChangeText={(t) => { setEmail(t); if (errors.email) setErrors((e) => ({ ...e, email: undefined })); }} />

        <PlusField label="Телеграм" value={telegram} autoCapitalize="none"
          onChangeText={(t) => setTelegram(t.replace(/^@/, ''))} />

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Фото</Text>
          {avatarUri ? (
            <Pressable style={styles.uploadWithPhoto} onPress={pickImage}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
              <Text style={styles.replacePhotoText}>Заменить фото</Text>
            </Pressable>
          ) : (
            <Pressable onPress={pickImage} hitSlop={8} style={styles.plusButton}>
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="10" stroke="#010101" strokeWidth="1" />
                <Path d="M12 7.5V16.5M7.5 12H16.5" stroke="#010101" strokeWidth="1" strokeLinecap="round" />
              </Svg>
            </Pressable>
          )}
        </View>
        {avatarUploadError ? <Text style={styles.errorText}>{avatarUploadError}</Text> : null}

        <PlusField label="Пароль" value={password} error={errors.password} secureTextEntry
          onChangeText={(t) => { setPassword(t); if (errors.password) setErrors((e) => ({ ...e, password: undefined })); }} />

        <PlusField label="Еще раз пароль" value={password2} error={errors.password2} secureTextEntry
          onChangeText={(t) => { setPassword2(t); if (errors.password2) setErrors((e) => ({ ...e, password2: undefined })); }} />

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
      </Modal>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 },
  card: { width: '100%', maxWidth: 480, maxHeight: '85%', backgroundColor: '#fff', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 40, lineHeight: 36, color: '#010101' },
  close: { fontSize: 20, color: '#010101' },
  scroll: { flexGrow: 0 },
  errorText: { fontFamily: 'Gramatika-Regular', fontSize: 13, color: '#E02D2D', marginBottom: 12 },
  hint: { fontFamily: 'Gramatika-Regular', fontSize: 12, lineHeight: 16, color: '#687076', marginBottom: 4 },
  fieldWrap: { marginBottom: 24 },
  label: { fontFamily: 'Gramatika-Regular', fontSize: 13, color: '#010101', marginBottom: 8 },
  plusButton: { paddingVertical: 2, alignSelf: 'flex-start' },
  uploadWithPhoto: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, backgroundColor: '#E5E5E5' },
  replacePhotoText: { fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#010101' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginTop: 16 },
  terms: { flex: 1, fontFamily: 'Gramatika-Regular', fontSize: 12, lineHeight: 16, color: '#010101' },
  termsLink: { textDecorationLine: 'underline' },
  nextLink: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 15, color: '#E02D2D' },
});
