import { Link, Stack, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';

/** Веб-версия экрана выбора роли при регистрации (см. app/(auth)/index.tsx для нативной). */
export default function AuthChoiceScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();

  return (
    <SiteShell>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.page}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Регистрация</Text>
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/events' as any))}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <View style={[styles.linksRow, isMobile && styles.linksRowMobile]}>
            <Link href="/register-tutor" asChild>
              <Pressable style={styles.linkRow}>
                <Text style={styles.linkText}>Хочу учить</Text>
              </Pressable>
            </Link>

            <Link href="/register-student" asChild>
              <Pressable style={styles.linkRow}>
                <Text style={styles.linkText}>Хочу учиться</Text>
              </Pressable>
            </Link>

            <Link href="/login" asChild>
              <Pressable style={[styles.loginLink, isMobile && styles.loginLinkMobile]}>
                <Text style={styles.loginLinkText}>Уже есть аккаунт</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 },
  card: { width: '100%', maxWidth: 480, backgroundColor: '#fff', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontFamily: 'Inter-Bold', fontSize: 22, color: '#181818' },
  close: { fontSize: 20, color: '#181818' },
  linksRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 32 },
  linksRowMobile: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  linkRow: { paddingVertical: 10 },
  linkText: { fontFamily: 'Inter-Medium', fontSize: 18, color: '#E02D2D' },
  loginLink: { marginLeft: 'auto' },
  loginLinkMobile: { marginLeft: 0, marginTop: 12 },
  loginLinkText: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#687076' },
});
