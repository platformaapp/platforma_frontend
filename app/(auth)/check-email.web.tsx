import { useRouter } from 'expo-router';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { SiteShell } from '@/components/web/site-shell';

/** Веб-версия экрана "Проверьте почту" (см. check-email.tsx для нативной). */
export default function CheckEmailScreenWeb() {
  const router = useRouter();

  return (
    <SiteShell>
      {/* Modal (не обычный View с flex:1) — гарантированно перекрывает всю
          страницу независимо от окружающего flex-контекста, см. cookie-banner. */}
      <Modal transparent animationType="fade" visible onRequestClose={() => router.back()}>
      <View style={[styles.page, { pointerEvents: 'box-none' }]}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>А проверьте почту!</Text>
            <Pressable onPress={() => router.back()}><Text style={styles.close}>✕</Text></Pressable>
          </View>

          <Text style={styles.description}>
            Ссылку на восстановление пароля отправили на почту
          </Text>

          <Pressable style={styles.bottomLink} onPress={() => router.push('/forgot-password' as any)}>
            <Text style={styles.bottomLinkText}>Ссылка почему-то не пришла</Text>
          </Pressable>
        </View>
      </View>
      </Modal>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 },
  title: { flex: 1, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 40, lineHeight: 36, color: '#010101' },
  close: { fontSize: 20, color: '#010101' },
  description: { fontFamily: 'Gramatika-Regular', fontSize: 18, lineHeight: 24, color: '#010101' },
  bottomLink: { marginTop: 32 },
  bottomLinkText: { fontFamily: 'Gramatika-Regular', fontSize: 14, lineHeight: 20, color: '#687076' },
});
