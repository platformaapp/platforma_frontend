import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { endpoints } from '@/constants/env';
import { extractRefreshTokenFromResponse, extractTokenFromResponse, saveAuthToken } from '@/lib/auth';

const REGISTER_URL = endpoints.register;

export default function RegisterStudentScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    phone?: string;
    password?: string;
    password2?: string;
  }>({});

  const phone = useMemo(() => formatPhoneRU(phoneRaw), [phoneRaw]);

  async function pickImage() {
    // Запрашиваем разрешение на доступ к медиатеке
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Ошибка', 'Необходимо разрешение на доступ к фотографиям');
      return;
    }

    // Открываем выбор изображения
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      // Здесь можно загрузить изображение на сервер и получить URL
      // Пока сохраняем локальный URI
      setAvatarUrl(result.assets[0].uri);
    }
  }

  async function onSubmit() {
    const newErrors: typeof errors = {};
    
    // Валидация обязательных полей
    if (!fullName.trim()) {
      newErrors.fullName = 'Поле не заполнено!';
    }
    if (!email.trim()) {
      newErrors.email = 'Поле не заполнено!';
    } else if (!email.includes('@')) {
      newErrors.email = 'Неверный формат email';
    }
    if (!phoneRaw.trim()) {
      newErrors.phone = 'Поле не заполнено!';
    } else if (!isValidPhoneRU(phoneRaw)) {
      newErrors.phone = 'Неверный формат телефона';
    }
    if (password.length < 7) {
      newErrors.password = 'Пароль слишком короткий!';
    }
    if (password !== password2) {
      newErrors.password2 = 'Пароли не совпадают!';
    }
    
    setErrors(newErrors);
    
    // Если есть ошибки, не отправляем запрос
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      const requestBody = {
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role: 'student',
        phone: normalizePhoneRU(phoneRaw),
        avatarUrl: avatarUrl || '',
        bio: '',
      };
      
      console.log('Отправка запроса на:', REGISTER_URL);
      console.log('Тело запроса:', { ...requestBody, password: '***' });
      
      const res = await fetch(REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        // Обработка ошибки 409 Conflict (телефон / email уже существуют)
        if (res.status === 409) {
          const errorMessage = data?.message || data?.error || '';
          const lowerMessage = errorMessage.toLowerCase();

          // Если конфликт по телефону
          if (lowerMessage.includes('phone') || lowerMessage.includes('телефон') || lowerMessage.includes('номер')) {
            setErrors({ ...errors, phone: errorMessage });
            setIsSubmitting(false);
            return;
          }

          // Если конфликт по email
          if (lowerMessage.includes('email') || lowerMessage.includes('почта') || lowerMessage.includes('e-mail')) {
            setErrors({ ...errors, email: errorMessage });
            setIsSubmitting(false);
            return;
          }
        }
        
        // Для других ошибок показываем общее сообщение
        const errorMessage = data?.message || data?.error || `Ошибка регистрации (${res.status})`;
        Alert.alert('Ошибка', errorMessage);
        setIsSubmitting(false);
        return;
      }
      
      console.log('Статус ответа:', res.status);
      console.log('Данные ответа:', JSON.stringify(data, null, 2));
      
      // Пытаемся извлечь токен из ответа
      const token = extractTokenFromResponse(data);
      const refreshToken = extractRefreshTokenFromResponse(data);
      console.log('Извлеченный токен:', token ? `есть (${token.substring(0, 20)}...)` : 'нет');
      
      // Сохраняем токен, если он есть
      if (token) {
        try {
          await saveAuthToken(token, 'student', refreshToken);
          console.log('Токен сохранен успешно');
        } catch (saveError) {
          console.error('Ошибка сохранения токена:', saveError);
          // Продолжаем выполнение даже если не удалось сохранить токен
        }
      } else {
        console.warn('Токен не найден в ответе сервера. Проверьте формат ответа.');
      }

      // Успешная регистрация: переходим на экран завершения регистрации
      // Переход происходит независимо от наличия токена
      console.log('Переход на экран завершения регистрации...');
      try {
        router.push('/registration-complete');
        console.log('Навигация выполнена');
      } catch (navError) {
        console.error('Ошибка навигации:', navError);
        // Пробуем альтернативный способ
        router.replace('/registration-complete');
      }
    } catch (e: any) {
      // Обработка сетевых ошибок и других исключений
      const msg = e?.message ?? '';
      const lowerMsg = msg.toLowerCase();

      if (lowerMsg.includes('phone') || lowerMsg.includes('телефон') || lowerMsg.includes('номер')) {
        setErrors({ ...errors, phone: msg });
      } else if (lowerMsg.includes('email') || lowerMsg.includes('почта') || lowerMsg.includes('e-mail')) {
        setErrors({ ...errors, email: msg });
      } else {
        Alert.alert('Ошибка', msg || 'Неизвестная ошибка');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })} keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView>
      <Pressable style={styles.close} onPress={() => router.back()}>
        <ThemedText style={{ fontSize: 22 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 2L22 22M22 2L2 22" stroke="#181818"/>
            </svg>
        </ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.title}>РЕГИСТРАЦИЯ{"\n"}УЧЕНИКА</ThemedText>

      <View>
        <LabeledInput 
          placeholder="Имя и фамилия" 
          value={fullName} 
          onChangeText={(text: string) => {
            setFullName(text);
            if (errors.fullName) {
              setErrors({ ...errors, fullName: undefined });
            }
          }}
          error={errors.fullName}
        />
        {errors.fullName && (
          <ThemedText style={styles.errorText}>{errors.fullName}</ThemedText>
        )}
      </View>

      <View>
        <LabeledInput 
          placeholder="Почта" 
          value={email} 
          onChangeText={(text: string) => {
            setEmail(text);
            if (errors.email) {
              setErrors({ ...errors, email: undefined });
            }
          }}
          autoCapitalize="none" 
          keyboardType="email-address"
          error={errors.email}
        />
        {errors.email && (
          <ThemedText style={styles.errorText}>{errors.email}</ThemedText>
        )}
      </View>

      <View>
        <LabeledInput 
          placeholder="Телефон" 
          value={phone} 
          onChangeText={(text: string) => {
            const digits = text.replace(/\D/g, '');
            setPhoneRaw(digits);
            if (errors.phone) {
              setErrors({ ...errors, phone: undefined });
            }
          }} 
          keyboardType="phone-pad"
          error={errors.phone}
        />
        {errors.phone && (
          <ThemedText style={styles.errorText}>{errors.phone}</ThemedText>
        )}
      </View>

      <Pressable style={[styles.upload, avatarUri && styles.uploadWithPhotoContainer]} onPress={pickImage}>
        {avatarUri ? (
          <View style={styles.uploadWithPhoto}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
            <View style={styles.replacePhotoContainer}>
              <ThemedText style={styles.replacePhotoText}>Заменить фото</ThemedText>
            </View>
          </View>
        ) : (
          <ThemedText style={{ textAlign: 'center' }}>Загрузить фото</ThemedText>
        )}
      </Pressable>

      <View>
        <PasswordInput 
          placeholder="Пароль" 
          value={password} 
          onChangeText={(text: string) => {
            setPassword(text);
            if (errors.password) {
              setErrors({ ...errors, password: undefined });
            }
          }} 
          visible={show1} 
          onToggle={() => setShow1(!show1)}
          error={errors.password}
        />
        {errors.password && (
          <ThemedText style={styles.errorText}>{errors.password}</ThemedText>
        )}
      </View>

      <View>
        <PasswordInput 
          placeholder="Еще раз пароль" 
          value={password2} 
          onChangeText={(text: string) => {
            setPassword2(text);
            if (errors.password2) {
              setErrors({ ...errors, password2: undefined });
            }
          }} 
          visible={show2} 
          onToggle={() => setShow2(!show2)}
          error={errors.password2}
        />
        {errors.password2 && (
          <ThemedText style={styles.errorText}>{errors.password2}</ThemedText>
        )}
      </View>

      <Pressable 
        style={[styles.btn, styles.btnPrimary, isSubmitting && { opacity: 0.6 }]} 
        onPress={onSubmit} 
        disabled={isSubmitting}
        android_ripple={{ color: 'rgba(255, 255, 255, 0.2)' }}
      >
        <ThemedText style={[styles.btnPrimaryText, styles.btnPrimaryTextCustom]}>Далее</ThemedText>
      </Pressable>

      <ThemedText style={[styles.terms && {fontSize: 12, lineHeight: 16, marginTop: 16}]}>
        Нажимая кнопку «Далее», вы принимаете{' '}
        <ThemedText 
          type="link" 
          style={{ fontSize: 12, lineHeight: 16 }}
          onPress={() => router.push('/user-agreement')}
        >
          пользовательское
        </ThemedText>
        , <ThemedText type="link" style={{ fontSize: 12, lineHeight: 16 }}>лицензионное</ThemedText> и <ThemedText type="link" style={{ fontSize: 12, lineHeight: 16 }}>другие</ThemedText> важные нам для работы соглашения
      </ThemedText>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LabeledInput({ error, ...props }: any) {
  return (
    <TextInput 
      placeholderTextColor={error ? "#E02D2D" : "#888"} 
      style={[styles.input, error && styles.inputError]} 
      {...props} 
    />
  );
}

function PasswordInput({ visible, onToggle, error, ...props }: any) {
  return (
    <View style={{ position: 'relative' }}>
      <TextInput 
        placeholderTextColor={error ? "#E02D2D" : "#888"} 
        style={[styles.input, error && styles.inputError]} 
        secureTextEntry={!visible} 
        {...props} 
      />
      <Pressable onPress={onToggle} style={styles.eye}>
        <ThemedText>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <mask id="path-1-inside-1_4159_5081" fill="white">
          <path d="M12.002 6C17.2261 6 21.6675 8.50517 23.3154 12C21.6675 15.4948 17.2261 18 12.002 18C6.7776 18 2.33524 15.495 0.6875 12C2.33524 8.50497 6.7776 6 12.002 6Z"/>
          </mask>
          <path d="M23.3154 12L24.2199 12.4265L24.421 12L24.2199 11.5735L23.3154 12ZM0.6875 12L-0.217017 11.5736L-0.418062 12L-0.217017 12.4264L0.6875 12ZM12.002 6V7C16.9557 7 20.9727 9.37624 22.4109 12.4265L23.3154 12L24.2199 11.5735C22.3624 7.6341 17.4965 5 12.002 5V6ZM23.3154 12L22.4109 11.5735C20.9727 14.6238 16.9557 17 12.002 17V18V19C17.4965 19 22.3624 16.3659 24.2199 12.4265L23.3154 12ZM12.002 18V17C7.04788 17 3.03009 14.6239 1.59202 11.5736L0.6875 12L-0.217017 12.4264C1.64039 16.3662 6.50732 19 12.002 19V18ZM0.6875 12L1.59202 12.4264C3.03009 9.37614 7.04788 7 12.002 7V6V5C6.50732 5 1.64039 7.63381 -0.217017 11.5736L0.6875 12Z" fill="black" mask="url(#path-1-inside-1_4159_5081)"/>
          <circle cx="12" cy="12" r="2.5" stroke="black"/>
        </svg>

        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    marginTop: 48,
    marginBottom: 24,
    fontFamily: "Inter-Regular",
    fontSize: 28,
    fontWeight: "400",
    fontStyle: "normal",
    lineHeight: 36,
    letterSpacing: -2,
    color: "#181818"
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(24, 24, 24, 1.0)",
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 4,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: "#181818",
  },
  inputError: {
    borderColor: "#E02D2D",
    color: "#E02D2D",
  },
  errorText: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: "#E02D2D",
    marginBottom: 8,
    marginTop: 4,
  },
  eye: {
    position: 'absolute',
    right: 12,
    top: 6,
    padding: 6,
  },
  upload: {
    borderWidth: 1,
    borderColor: "rgba(24, 24, 24, 1.0)",
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 52,
    justifyContent: 'center',
  },
  uploadWithPhotoContainer: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  uploadWithPhoto: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  avatar: {
    width: 52,
    height: 52,
    backgroundColor: '#f0f0f0',
    marginLeft: 0,
  },
  replacePhotoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 16,
    height: 52,
  },
  replacePhotoText: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: "#181818",
    textAlign: 'center',
  },
  btn: {
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#111',
    marginTop: 4,
  },
  btnPrimary: {
    backgroundColor: '#111',
    borderRadius: 0,
    height: 52,
    borderWidth: 1,
    borderColor: "rgba(24, 24, 24, 1.0)",
  },
  btnPrimaryText: {
    color: '#FFF',
  },
  btnPrimaryTextCustom: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    fontWeight: "400",
    fontStyle: "normal",
    lineHeight: 20,
    color: "#FAFAFA",
  },
  terms: {
    marginTop: 12,
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
});

function formatPhoneRU(input: string) {
  const digits = input.replace(/\D/g, '');
  let value = digits;
  if (value.startsWith('8')) value = '7' + value.slice(1);
  if (!value.startsWith('7')) value = '7' + value;
  value = value.slice(0, 11);
  const parts = [value.slice(0, 1), value.slice(1, 4), value.slice(4, 7), value.slice(7, 9), value.slice(9, 11)];
  let out = '+' + parts[0];
  if (parts[1]) out += ' (' + parts[1] + ')';
  if (parts[2]) out += ' ' + parts[2];
  if (parts[3]) out += '-' + parts[3];
  if (parts[4]) out += '-' + parts[4];
  return out;
}

function normalizePhoneRU(input: string) {
  const digits = input.replace(/\D/g, '');
  let value = digits;
  if (value.startsWith('8')) value = '7' + value.slice(1);
  if (!value.startsWith('7')) value = '7' + value;
  return '+' + value.slice(0, 11);
}

function isValidPhoneRU(input: string) {
  const digits = input.replace(/\D/g, '');
  const normalized = digits.startsWith('8') ? '7' + digits.slice(1) : digits.startsWith('7') ? digits : '7' + digits;
  return normalized.length === 11;
}


