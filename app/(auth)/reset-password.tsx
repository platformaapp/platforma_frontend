import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { endpoints } from '@/constants/env';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();

  // Fallback: read token directly from the URL in case the router hasn't
  // hydrated search params yet (static-export SPA fallback via nginx).
  const [token, setToken] = useState<string | undefined>(tokenParam || undefined);
  React.useEffect(() => {
    if (!token && typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('token');
      if (t) setToken(t);
    }
  }, []);
  React.useEffect(() => {
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
    if (passwordValue.length < 7) {
      return 'Пароль слишком короткий!';
    }
    // Проверка на наличие хотя бы одной буквы или цифры
    if (!/[a-zA-Zа-яА-Я0-9]/.test(passwordValue)) {
      return 'Должна быть хотя бы одна буква или цифра!';
    }
    return null;
  }

  function validatePasswordMatch(passwordValue: string, password2Value: string): string | null {
    if (passwordValue !== password2Value) {
      return 'Пароли не совпадают!';
    }
    return null;
  }

  async function onSubmit() {
    const error1Value = validatePassword(password);
    const error2Value = password2 ? validatePasswordMatch(password, password2) : null;

    if (error1Value) {
      setError1(error1Value);
    }
    if (error2Value) {
      setError2(error2Value);
    }

    if (error1Value || error2Value) {
      return;
    }

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
      router.replace('/login');
    } catch (e: any) {
      setError1(e?.message ?? 'Ошибка при сбросе пароля');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })} keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView>
          <Pressable style={styles.close} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/events'); }}>
            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <Path d="M2 2L22 22M22 2L2 22" stroke="#181818"/>
            </Svg>
          </Pressable>

          <ThemedText type="title" style={styles.title}>НОВЫЙ ПАРОЛЬ</ThemedText>

          <ThemedText style={styles.description}>
            Пароль должен быть не меньше 7 символов и состоять из букв, цифр и прикольных символов
          </ThemedText>

          <View>
            <PasswordInput 
              placeholder="Новый пароль" 
              value={password} 
              onChangeText={(text: string) => {
                setPassword(text);
                if (error1) {
                  setError1(null);
                }
                // Проверяем совпадение паролей при изменении первого поля
                if (password2 && text !== password2) {
                  setError2('Пароли не совпадают!');
                } else if (password2 && text === password2 && error2 === 'Пароли не совпадают!') {
                  setError2(null);
                }
              }} 
              visible={show1} 
              onToggle={() => setShow1(!show1)}
              error={error1}
            />
            {error1 && (
              <ThemedText style={styles.errorText}>{error1}</ThemedText>
            )}
          </View>

          <View>
            <PasswordInput 
              placeholder="Повторите пароль" 
              value={password2} 
              onChangeText={(text: string) => {
                setPassword2(text);
                if (error2) {
                  setError2(null);
                }
                // Проверяем совпадение паролей при изменении второго поля
                if (password && text !== password) {
                  setError2('Пароли не совпадают!');
                } else if (password && text === password && error2 === 'Пароли не совпадают!') {
                  setError2(null);
                }
              }} 
              visible={show2} 
              onToggle={() => setShow2(!show2)}
              error={error2}
            />
            {error2 && (
              <ThemedText style={styles.errorText}>{error2}</ThemedText>
            )}
          </View>

          <Pressable 
            style={[styles.btn, styles.btnPrimary, isSubmitting && { opacity: 0.6 }]} 
            onPress={onSubmit} 
            disabled={isSubmitting}
          >
            <ThemedText style={[styles.btnPrimaryText, styles.btnPrimaryTextCustom]}>Сохранить и войти</ThemedText>
          </Pressable>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PasswordInput({ visible, onToggle, error, ...props }: any) {
  return (
    <View style={{ position: 'relative', marginBottom: 4 }}>
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
  description: {
    marginBottom: 24,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#181818",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(24, 24, 24, 1.0)",
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 12,
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
  close: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
});

