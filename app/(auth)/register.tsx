import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type Role = 'student' | 'tutor';

const REGISTER_URL = 'http://91.229.9.117:3000/api/auth/register';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMGRiNTIxZi05OTUxLTQ4NzQtYjNjYi1kNzNlYmU1NjUzNjgiLCJlbWFpbCI6InRlc3RAdGVzdDEucnUiLCJyb2xlIjoic3R1ZGVudCIsImlhdCI6MTc2MTkwMDM5NywiZXhwIjoxNzYxOTAzOTk3fQ.juZKmxztQTk-d59VDOaZeKUBH0yEANirH3dwKnhLwlc';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!email || !password || !fullName) {
      Alert.alert('Заполните обязательные поля', 'Email, пароль и ФИО обязательны');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_TOKEN}` },
        body: JSON.stringify({ email, password, fullName, role, phone, avatarUrl, bio }),
      });

      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await res.json() : await res.text();

      if (!res.ok) {
        const message = typeof data === 'string' ? data : data?.message || 'Ошибка регистрации';
        throw new Error(message);
      }

      Alert.alert('Успешно', 'Регистрация выполнена', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (e: any) {
      Alert.alert('Не удалось зарегистрироваться', e?.message ?? 'Неизвестная ошибка');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.card}>
          <ThemedText type="title" style={{ marginBottom: 12 }}>Регистрация</ThemedText>

          <LabeledInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <LabeledInput label="Пароль" value={password} onChangeText={setPassword} secureTextEntry />
          <LabeledInput label="ФИО" value={fullName} onChangeText={setFullName} />
          <LabeledInput label="Телефон" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <LabeledInput label="Аватар (URL)" value={avatarUrl} onChangeText={setAvatarUrl} autoCapitalize="none" />
          <LabeledInput label="О себе" value={bio} onChangeText={setBio} multiline />

          <RoleSwitcher value={role} onChange={setRole} />

          <SubmitButton title={isSubmitting ? 'Отправка…' : 'Зарегистрироваться'} disabled={isSubmitting} onPress={handleSubmit} />
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LabeledInput({ label, style, ...props }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <ThemedText type="defaultSemiBold" style={{ marginBottom: 6 }}>{label}</ThemedText>
      <TextInput
        placeholder={label}
        placeholderTextColor="#888"
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

function RoleSwitcher({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const isStudent = value === 'student';
  return (
    <View style={styles.segmented}>
      <Segment title="Ученик" active={isStudent} onPress={() => onChange('student')} />
      <Segment title="Репетитор" active={!isStudent} onPress={() => onChange('tutor')} />
    </View>
  );
}

function Segment({ title, active, onPress }: { title: string; active?: boolean; onPress: () => void }) {
  return (
    <View style={[styles.segment, active ? styles.segmentActive : null]}
      onTouchEnd={onPress}
    >
      <ThemedText style={{ opacity: active ? 1 : 0.7 }}>{title}</ThemedText>
    </View>
  );
}

function SubmitButton({ title, disabled, onPress }: { title: string; disabled?: boolean; onPress: () => void }) {
  return (
    <View
      style={[styles.button, disabled ? { opacity: 0.6 } : null]}
      onTouchEnd={() => { if (!disabled) onPress(); }}
    >
      <ThemedText type="defaultSemiBold" style={{ textAlign: 'center' }}>{title}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
  },
  card: {
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmented: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  segmentActive: {
    backgroundColor: '#e8f0fe',
    borderColor: '#99b',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#E6F4FE',
    paddingVertical: 12,
    borderRadius: 10,
  },
});


