import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { endpoints } from '@/constants/env';
import { extractTokenFromResponse, saveAuthToken } from '@/lib/auth';

const REGISTER_URL = endpoints.register;

export default function RegisterTutorScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const phone = useMemo(() => formatPhoneRU(phoneRaw), [phoneRaw]);

  async function onSubmit() {
    if (password.length < 7) {
      Alert.alert('Пароль слишком короткий', 'Минимум 7 символов');
      return;
    }
    if (password !== password2) {
      Alert.alert('Пароли не совпадают');
      return;
    }
    if (!isValidPhoneRU(phoneRaw)) {
      Alert.alert('Неверный телефон', 'Введите номер в формате +7XXXXXXXXXX');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName,
          role: 'tutor',
          phone: normalizePhoneRU(phoneRaw),
          avatarUrl: '',
          bio: '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Ошибка регистрации');
      }
      const token = extractTokenFromResponse(data);
      await saveAuthToken(token || '', 'tutor');
      router.replace('/events');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Неизвестная ошибка');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })} keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView>
      <Pressable style={styles.close} onPress={() => router.back()}>
        <ThemedText style={{ fontSize: 22 }}>✕</ThemedText>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ThemedText type="title" style={styles.title}>РЕГИСТРАЦИЯ{"\n"}НАСТАВНИКА</ThemedText>
        <View style={styles.stepBadge}><ThemedText>Шаг 1</ThemedText></View>
      </View>

      <LabeledInput placeholder="Имя и фамилия" value={fullName} onChangeText={setFullName} />
      <LabeledInput placeholder="Почта" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <LabeledInput placeholder="Телефон" value={phone} onChangeText={(t: string) => setPhoneRaw(t)} keyboardType="phone-pad" />

      <PasswordInput placeholder="Пароль" value={password} onChangeText={setPassword} visible={show1} onToggle={() => setShow1(!show1)} />
      <PasswordInput placeholder="Еще раз пароль" value={password2} onChangeText={setPassword2} visible={show2} onToggle={() => setShow2(!show2)} />

      <ThemedText style={{ marginVertical: 8 }}>
        Пароль должен быть не меньше 7 символов и состоять из букв, цифр и прикольных символов
      </ThemedText>

      <Pressable style={[styles.btn, styles.btnPrimary, isSubmitting && { opacity: 0.6 }]} onPress={onSubmit} disabled={isSubmitting}>
        <ThemedText style={styles.btnPrimaryText}>Далее</ThemedText>
      </Pressable>

      <ThemedText style={styles.terms}>
        Нажимая кнопку «Далее», вы принимаете <ThemedText type="link">пользовательское</ThemedText>, <ThemedText type="link">лицензионное</ThemedText> и <ThemedText type="link">другие</ThemedText> важные нам для работы соглашения
      </ThemedText>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LabeledInput(props: any) {
  return (
    <TextInput placeholderTextColor="#888" style={styles.input} {...props} />
  );
}

function PasswordInput({ visible, onToggle, ...props }: any) {
  return (
    <View style={{ position: 'relative' }}>
      <TextInput placeholderTextColor="#888" style={styles.input} secureTextEntry={!visible} {...props} />
      <Pressable onPress={onToggle} style={styles.eye}>
        <ThemedText>👁️</ThemedText>
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
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  eye: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 6,
  },
  stepBadge: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 48,
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
  },
  btnPrimaryText: {
    color: '#FFF',
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


