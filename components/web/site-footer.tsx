import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Футер веб-версии: логотипы партнёров (пока заглушки — реальных лого нет)
 * + копирайт + ссылка на документы. Показывается на страницах с публичным
 * контентом (главная, событие, наставник, статья) — см. макеты.
 */
export function SiteFooter() {
  const router = useRouter();
  return (
    <View style={styles.footer}>
      <View style={styles.partnersRow}>
        <View style={styles.partnerCol}>
          <Text style={styles.partnerLabel}>Генеральный партнер</Text>
          <View style={styles.partnerPlaceholder} />
        </View>
        <View style={styles.partnerCol}>
          <Text style={styles.partnerLabel}>Информационные партнеры</Text>
          <View style={styles.partnerPlaceholder} />
        </View>
        <View style={styles.partnerCol}>
          <Text style={styles.partnerLabel}>Партнеры</Text>
          <View style={styles.partnerPlaceholder} />
        </View>
      </View>
      <View style={styles.bottomRow}>
        <Text style={styles.copyright}>©2026, p(34)</Text>
        <Pressable onPress={() => router.push('/offer' as any)}>
          <Text style={styles.docsLink}>Официальные документы</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: 32, paddingVertical: 32, borderTopWidth: 1, borderColor: '#E5E5E5', marginTop: 48 },
  partnersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 32, marginBottom: 24 },
  partnerCol: { flexBasis: 180, flexGrow: 1 },
  partnerLabel: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#687076', marginBottom: 8 },
  partnerPlaceholder: { height: 32, width: 96, backgroundColor: '#E5E5E5' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  copyright: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#687076' },
  docsLink: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#687076', textDecorationLine: 'underline' },
});
