import { useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { endpoints } from '@/constants/env';
import { extractRefreshTokenFromResponse, extractTokenFromResponse, saveAuthToken } from '@/lib/auth';

const REGISTER_URL = endpoints.register;
const OFERTA_URL = Platform.OS === 'web' ? '/oferta.pdf' : 'https://platformaapp.ru/oferta.pdf';
const CONF_URL   = Platform.OS === 'web' ? '/conf.pdf'   : 'https://platformaapp.ru/conf.pdf';

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered with role: tutor')) return 'Этот аккаунт уже зарегистрирован как наставник. Войдите в аккаунт.';
  if (m.includes('already registered with role: student')) return 'Этот аккаунт уже зарегистрирован как студент. Войдите в аккаунт.';
  if (m.includes('already registered')) return 'Пользователь с такими данными уже зарегистрирован. Войдите в аккаунт.';
  if (m.includes('phone number already exists') || (m.includes('phone') && m.includes('already'))) return 'Такой номер телефона уже зарегистрирован';
  if (m.includes('email already exists') || (m.includes('email') && m.includes('already'))) return 'Такой email уже зарегистрирован';
  if (m.includes('already exists')) return 'Пользователь с такими данными уже существует';
  return message;
}

export default function RegisterTutorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [telegram, setTelegram] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    phone?: string;
    telegram?: string;
    password?: string;
    password2?: string;
  }>({});

  const phone = useMemo(() => formatPhoneRU(phoneRaw), [phoneRaw]);

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
    if (!telegram.trim()) {
      newErrors.telegram = 'Поле не заполнено!';
    }
    if (password.length < 7) {
      newErrors.password = 'Пароль слишком короткий!';
    }
    if (!password2.trim()) {
      newErrors.password2 = 'Поле не заполнено!';
    } else if (password !== password2) {
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
        role: 'tutor',
        phone: normalizePhoneRU(phoneRaw),
        avatarUrl: '',
        bio: '',
        ...(telegram.trim() ? { telegram: telegram.trim().replace(/^@/, '') } : {}),
      };
      
      const res = await fetch(REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        // Обработка ошибки 409 Conflict (телефон / email уже существуют)
        if (res.status === 409) {
          const errorMessage = data?.message || data?.error || '';
          const lowerMessage = errorMessage.toLowerCase();
          const translated = translateAuthError(errorMessage);

          // Пользователь уже зарегистрирован с такой ролью
          if (lowerMessage.includes('already registered')) {
            setErrors({ ...errors, phone: translated });
            setIsSubmitting(false);
            return;
          }

          // Если конфликт по телефону
          if (lowerMessage.includes('phone') || lowerMessage.includes('телефон') || lowerMessage.includes('номер')) {
            setErrors({ ...errors, phone: translated });
            setIsSubmitting(false);
            return;
          }

          // Если конфликт по email
          if (lowerMessage.includes('email') || lowerMessage.includes('почта') || lowerMessage.includes('e-mail')) {
            setErrors({ ...errors, email: translated });
            setIsSubmitting(false);
            return;
          }

          // Прочие 409
          setErrors({ ...errors, phone: translated || 'Пользователь с такими данными уже существует' });
          setIsSubmitting(false);
          return;
        }
        
        // 400: validation / business rule error — show inline under email field
        if (res.status === 400) {
          const errorMsg = data?.message || data?.error || 'Ошибка регистрации';
          setErrors(prev => ({ ...prev, email: errorMsg }));
          setIsSubmitting(false);
          return;
        }

        // Для других ошибок показываем общее сообщение
        const errorMessage = translateAuthError(data?.message || data?.error || `Ошибка регистрации (${res.status})`);
        Alert.alert('Ошибка', errorMessage);
        setIsSubmitting(false);
        return;
      }

      const token = extractTokenFromResponse(data);
      const refreshToken = extractRefreshTokenFromResponse(data);
      
      if (token) {
        try {
          await saveAuthToken(token, 'tutor', refreshToken);
        } catch (saveError) {
          console.error('Ошибка сохранения токена:', saveError);
        }
      }

      router.push('/register-tutor-step2');
    } catch (e: any) {
      // Обработка сетевых ошибок и других исключений
      const msg = e?.message ?? '';
      const lowerMsg = msg.toLowerCase();

      const translatedMsg = translateAuthError(msg);
      if (lowerMsg.includes('phone') || lowerMsg.includes('телефон') || lowerMsg.includes('номер')) {
        setErrors({ ...errors, phone: translatedMsg });
      } else if (lowerMsg.includes('email') || lowerMsg.includes('почта') || lowerMsg.includes('e-mail')) {
        setErrors({ ...errors, email: translatedMsg });
      } else {
        Alert.alert('Ошибка', translatedMsg || 'Неизвестная ошибка');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })} keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 60 }]} keyboardShouldPersistTaps="handled">
        <ThemedView>
      <Pressable style={styles.close} onPress={() => router.back()}>
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <Path d="M2 2L22 22M22 2L2 22" stroke="#181818"/>
        </Svg>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ThemedText type="title" style={styles.title}>РЕГИСТРАЦИЯ{"\n"}НАСТАВНИКА</ThemedText>
        <View style={styles.stepBadge}><ThemedText>Шаг 1</ThemedText></View>
      </View>

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

      <View>
        <LabeledInput
          placeholder="Телеграм"
          value={telegram}
          onChangeText={(text: string) => {
            setTelegram(text.replace(/^@/, ''));
            if (errors.telegram) setErrors({ ...errors, telegram: undefined });
          }}
          autoCapitalize="none"
          error={errors.telegram}
        />
        {errors.telegram && (
          <ThemedText style={styles.errorText}>{errors.telegram}</ThemedText>
        )}
      </View>

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

      <ThemedText style={{ marginVertical: 8, fontSize: 14, lineHeight: 18 }}>
        Пароль должен быть не меньше 7 символов и состоять из букв, цифр и прикольных символов
      </ThemedText>

      <Pressable style={[styles.btn, styles.btnPrimary, isSubmitting && { opacity: 0.6 }]} onPress={onSubmit} disabled={isSubmitting}>
        <ThemedText style={[styles.btnPrimaryText, styles.btnPrimaryTextCustom]}>Далее</ThemedText>
      </Pressable>

      <ThemedText style={[styles.terms && {fontSize: 12, lineHeight: 16, marginTop: 16}]}>
        Нажимая кнопку «Далее», вы принимаете{' '}
        <ThemedText
          type="link"
          style={{ fontSize: 12, lineHeight: 16 }}
          onPress={() => router.push('/offer' as any)}
        >
          публичную оферту
        </ThemedText>
        {' '}и{' '}
        <ThemedText
          type="link"
          style={{ fontSize: 12, lineHeight: 16 }}
          onPress={() => router.push('/privacy' as any)}
        >
          политику конфиденциальности
        </ThemedText>
      </ThemedText>
      <ThemedText
        type="link"
        style={{ fontSize: 12, lineHeight: 16, marginTop: 8 }}
        onPress={() => router.push('/about' as any)}
      >
        О сервисе
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
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <Path d="M2 12C3.7 7.6 7.5 5 12 5C16.5 5 20.3 7.6 22 12C20.3 16.4 16.5 19 12 19C7.5 19 3.7 16.4 2 12Z" stroke="#181818" strokeWidth="1.5"/>
          <Circle cx="12" cy="12" r="3" stroke="#181818" strokeWidth="1.5"/>
        </Svg>
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
    marginTop: 0,
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
  stepBadge: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 0,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 0,
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
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 8,
  },
});

function formatPhoneRU(input: string) {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
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


