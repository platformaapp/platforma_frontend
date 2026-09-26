import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { acceptCookieConsent, isCookieConsentAccepted } from '@/lib/cookie-consent';

const TITLE_COMPACT_BREAKPOINT = 475;

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const { width } = useWindowDimensions();
  const isCompact = width < TITLE_COMPACT_BREAKPOINT;

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
      {/* pointerEvents:'box-none' — иначе фон этого попапа перехватывает клики
          у ЛЮБОГО другого одновременно открытого Modal (баннер показывается
          на каждой странице, пока согласие не принято, и может совпасть по
          времени с любым другим попапом приложения) — см. коммит про баг с
          "Посмотреть события" в пустом состоянии "Мои записи". */}
      <View style={[styles.overlay, { pointerEvents: 'box-none' }]}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, isCompact && styles.titleCompact]}>Мы используем куки</Text>
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
  card: { backgroundColor: '#fff', width: '100%', maxWidth: 752, padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 40, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#181818' },
  titleCompact: { fontSize: 25 },
  close: { fontSize: 26, color: '#181818' },
  text: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#000', marginBottom: 24 },
  okButton: { alignSelf: 'flex-end' },
  okText: { fontSize: 18, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#E02D2D', textDecorationLine: 'underline' },
});