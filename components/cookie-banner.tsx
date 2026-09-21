import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { acceptCookieConsent, isCookieConsentAccepted } from '@/lib/cookie-consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    isCookieConsentAccepted().then((accepted) => {
      if (!accepted) setVisible(true);
    });
  }, []);

  async function handleOk() {
    setVisible(false);
    await acceptCookieConsent();
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleOk}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Мы используем куки</Text>
            <Pressable onPress={handleOk}><Text style={styles.close}>✕</Text></Pressable>
          </View>
          <Text style={styles.text}>Все так делают</Text>
          <Pressable style={styles.okButton} onPress={handleOk}>
            <Text style={styles.okText}>Окей</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#fff', width: '100%', maxWidth: 420, padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 20, fontFamily: 'Gramatika-Bold', color: '#181818' },
  close: { fontSize: 20, color: '#181818' },
  text: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 24 },
  okButton: { alignSelf: 'flex-end' },
  okText: { fontSize: 14, fontFamily: 'Gramatika-Bold', color: '#E02D2D' },
});
