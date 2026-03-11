import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { endpoints } from '@/constants/env';
import { getAuthToken, getUserProfile } from '@/lib/auth';

export default function NewPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const token = await getAuthToken();
        if (!token) { router.replace('/login'); return; }
        const profile = await getUserProfile();
        if (active && profile?.email) setEmail(profile.email);
      } catch {
        // ignore — user will see empty email
      } finally {
        if (active) setLoadingEmail(false);
      }
    };
    load();
    return () => { active = false; };
  }, [router]);

  const handleSend = async () => {
    if (isSending || isSent) return;
    if (!email) {
      Alert.alert('Ошибка', 'Не удалось определить email. Попробуйте позже.');
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch(endpoints.forgotPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message ?? data?.error ?? `Ошибка (${res.status})`;
        throw new Error(typeof msg === 'string' ? msg : 'Ошибка отправки');
      }
      setIsSent(true);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось отправить ссылку');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 18L9 12L15 6"
              stroke="#181818"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </View>

      <Text style={styles.title}>НОВЫЙ ПАРОЛЬ</Text>

      {loadingEmail ? (
        <ActivityIndicator style={styles.loader} color="#181818" />
      ) : (
        <>
          {isSent ? (
            <View style={styles.successBlock}>
              <Text style={styles.successText}>
                Ссылка для смены пароля отправлена на{'\n'}
                <Text style={styles.successEmail}>{email}</Text>
              </Text>
              <Text style={styles.successHint}>
                Проверьте почту и перейдите по ссылке, чтобы задать новый пароль.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.description}>
                Мы отправим ссылку для смены пароля на вашу почту
              </Text>

              <View style={styles.emailCard}>
                <Text style={styles.emailLabel}>Почта</Text>
                <Text style={styles.emailValue}>{email || '—'}</Text>
              </View>

              <Text style={styles.helperText}>
                Пароль должен быть не меньше 7 символов и состоять из букв, цифр и символов
              </Text>
            </>
          )}
        </>
      )}

      <Pressable
        style={[
          styles.saveButton,
          (isSending || isSent || loadingEmail) && styles.saveButtonDisabled,
        ]}
        onPress={isSent ? () => router.back() : handleSend}
        disabled={isSending || loadingEmail}
      >
        {isSending ? (
          <ActivityIndicator color="#FAFAFA" />
        ) : (
          <Text style={styles.saveButtonText}>
            {isSent ? 'Закрыть' : 'Отправить ссылку'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 12,
    marginBottom: 20,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  loader: {
    marginTop: 40,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 16,
  },
  emailCard: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emailLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
  },
  emailValue: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
  },
  successBlock: {
    marginTop: 8,
    marginBottom: 16,
  },
  successText: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 12,
  },
  successEmail: {
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  successHint: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
  },
  saveButton: {
    marginTop: 'auto',
    marginBottom: 24,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#111',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
});
