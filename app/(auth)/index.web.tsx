import { Link, Stack, useRouter } from 'expo-router';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';

/** Веб-версия экрана выбора роли при регистрации (см. app/(auth)/index.tsx для нативной). */
export default function AuthChoiceScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();
  const handleClose = () => (router.canGoBack() ? router.back() : router.replace('/events' as any));

  return (
    <SiteShell>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Modal (не обычный View с flex:1) — гарантированно перекрывает всю
          страницу независимо от окружающего flex-контекста, см. cookie-banner. */}
      <Modal transparent animationType="fade" visible onRequestClose={handleClose}>
      <View style={[styles.page, { pointerEvents: 'box-none' }]}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>Регистрация</Text>
            <Pressable onPress={handleClose}>
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
      </Modal>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 },
  card: { width: '100%', maxWidth: 480, backgroundColor: '#fff', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 40, lineHeight: 36, color: '#010101' },
  titleMobile: { fontSize: 25, lineHeight: 28 },
  close: { fontSize: 20, color: '#010101' },
  linksRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 32 },
  linksRowMobile: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  linkRow: { paddingVertical: 10 },
  linkText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 18, color: '#E02D2D' },
  loginLink: { marginLeft: 'auto' },
  loginLinkMobile: { marginLeft: 0, marginTop: 12 },
  loginLinkText: { fontFamily: 'Gramatika-Regular', fontSize: 13, color: '#687076' },
});
