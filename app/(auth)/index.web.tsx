import { Link, Stack } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SiteShell } from '@/components/web/site-shell';

/** Веб-версия экрана выбора роли при регистрации (см. app/(auth)/index.tsx для нативной). */
export default function AuthChoiceScreenWeb() {
  return (
    <SiteShell>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.page}>
        <View style={styles.card}>
          <Text style={styles.title}>АВТОРИЗАЦИЯ</Text>

          <Link href="/register-student" asChild>
            <Pressable style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>Хочу учиться</Text>
            </Pressable>
          </Link>

          <Link href="/register-tutor" asChild>
            <Pressable style={styles.btnOutline}>
              <Text style={styles.btnOutlineText}>Хочу учить</Text>
            </Pressable>
          </Link>

          <Link href="/login" asChild>
            <Pressable style={styles.loginLink}>
              <Text style={styles.loginLinkText}>У меня уже есть профиль</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24 },
  card: { width: '100%', maxWidth: 400, borderWidth: 1, borderColor: '#CFCFCF', padding: 32 },
  title: { fontFamily: 'Inter-Bold', fontSize: 20, letterSpacing: 1, color: '#181818', marginBottom: 24 },
  btnPrimary: { backgroundColor: '#111', height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  btnPrimaryText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#FAFAFA' },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#111', height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  btnOutlineText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
  loginLink: { alignItems: 'center', paddingVertical: 4 },
  loginLinkText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818', textDecorationLine: 'underline' },
});
