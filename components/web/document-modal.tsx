import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Всплывающий попап для юридических/справочных документов (контакты,
 * оферта) — заголовок + крестик закрытия + скроллящийся текст, поверх
 * затемнённой страницы (см. референс). Та же механика overlay/карточки, что
 * уже используется в модалках подтверждения (events/[id].web.tsx,
 * myevents.web.tsx) — просто без клика по фону для закрытия, только крестик.
 */
export function DocumentModal({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={[styles.overlay, { pointerEvents: 'box-none' }]}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(24,24,24,0.45)', padding: 16 },
  card: { width: '100%', maxWidth: 720, maxHeight: '85%', backgroundColor: '#fff', padding: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16 },
  title: { flex: 1, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 32, lineHeight: 36, color: '#010101' },
  close: { fontSize: 22, color: '#010101', marginTop: 4 },
  scrollContent: { paddingBottom: 8 },
});
