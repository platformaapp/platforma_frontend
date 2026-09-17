import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const STRATEGIC_PARTNERS = ['ПРО:ВЗГЛЯД', 'Еврейский музей и центр толерантности', 'youtalk', 'ДК РАССВЕТ', 'Театр.doc'];

const FRIENDS = [
  'Bubble Studios', 'ЗОТОВ ЦЕНТР', 'BEAT', 'ЗИЛАРТ', 'KION',
  'Кинотеатр Художественный', 'B', 'Самокат', 'Чехов и компания', 'twinby',
  'AZ Museum', 'Перспектива', 'Внутри', 'A24', 'Практика театр',
];

/**
 * Футер веб-версии: партнёры и друзья проекта (текстовые логотипы — реальных
 * лого-файлов нет) + копирайт + ссылка на документы. Показывается на страницах
 * с публичным контентом (события, событие, наставник, статья) — см. макеты.
 */
export function SiteFooter() {
  const router = useRouter();
  return (
    <View style={styles.footer}>
      <Text style={styles.sectionLabel}>Наши стратегические партнеры</Text>
      <View style={styles.logosRow}>
        {STRATEGIC_PARTNERS.map((name) => (
          <Text key={name} style={styles.logoText}>{name}</Text>
        ))}
      </View>

      <Text style={[styles.sectionLabel, styles.friendsLabel]}>Наши большие друзья</Text>
      <View style={styles.logosRow}>
        {FRIENDS.map((name) => (
          <Text key={name} style={styles.logoText}>{name}</Text>
        ))}
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.copyright}>©2026, p(34)</Text>
        <View style={styles.bottomLinks}>
          {/* Нет отдельного экрана контактов — оставляем текстом, без перехода в никуда. */}
          <Text style={styles.docsLink}>Контакты для связи</Text>
          <Pressable onPress={() => router.push('/offer' as any)}>
            <Text style={styles.docsLink}>Официальные документы</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: 32, paddingVertical: 32, borderTopWidth: 1, borderColor: '#E5E5E5', marginTop: 48 },
  sectionLabel: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#687076', marginBottom: 16 },
  friendsLabel: { marginTop: 32 },
  logosRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 40, rowGap: 20 },
  logoText: { fontFamily: 'Inter-Bold', fontSize: 14, color: '#181818' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 40 },
  copyright: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#687076' },
  bottomLinks: { flexDirection: 'row', gap: 24 },
  docsLink: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#687076', textDecorationLine: 'underline' },
});
