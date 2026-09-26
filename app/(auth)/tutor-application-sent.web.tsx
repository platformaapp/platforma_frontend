import { useRouter } from 'expo-router';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { SiteShell } from '@/components/web/site-shell';

/** Веб-версия экрана "Заявка отправлена" (см. tutor-application-sent.tsx для нативной). */
export default function TutorApplicationSentScreenWeb() {
  const router = useRouter();

  function handleClose() {
    router.replace('/(tabs)/events' as any);
  }

  return (
    <SiteShell>
      {/* Modal (не обычный View с flex:1) — гарантированно перекрывает всю
          страницу независимо от окружающего flex-контекста, см. cookie-banner. */}
      <Modal transparent animationType="fade" visible onRequestClose={handleClose}>
      <View style={[styles.page, { pointerEvents: 'box-none' }]}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Заявка отправлена</Text>
            <Pressable onPress={handleClose}><Text style={styles.close}>✕</Text></Pressable>
          </View>

          <Text style={styles.description}>
            Скоро мы её одобрим. Это случится быстрее, чем вы заварите себе ромашковый чай
          </Text>

          <Pressable onPress={handleClose} style={styles.closeLinkRow}>
            <Text style={styles.closeLink}>Закрыть</Text>
          </Pressable>
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
  close: { fontSize: 20, color: '#010101' },
  description: { fontFamily: 'Gramatika-Regular', fontSize: 18, lineHeight: 24, color: '#010101', marginBottom: 24 },
  closeLinkRow: { alignSelf: 'flex-end' },
  closeLink: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 15, color: '#E02D2D', textDecorationLine: 'underline' },
});
