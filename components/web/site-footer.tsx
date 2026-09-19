import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

// Высота логотипов зафиксирована (28px), ширина — под реальные пропорции
// каждого файла, иначе лого будут либо сплющены, либо с полями.
const STRATEGIC_PARTNERS = [
  { name: 'ПРО:ВЗГЛЯД', logo: require('@/assets/images/partner-provzglyad.png'), width: 64 },
  { name: 'Еврейский музей и центр толерантности', logo: require('@/assets/images/partner-jewish-museum.png'), width: 69 },
  { name: 'youtalk', logo: require('@/assets/images/partner-youtalk.png'), width: 33 },
  { name: 'ДК РАССВЕТ', logo: require('@/assets/images/partner-dkrassvet.png'), width: 114 },
  { name: 'Театр.doc', logo: require('@/assets/images/partner-teatrdoc.png'), width: 125 },
];
const PARTNER_LOGO_HEIGHT = 28;

// Логотипы добавляются по мере получения файлов — до этого запись остаётся
// текстом (см. рендер ниже: с logo рисуем Image, без — Text как раньше).
const FRIENDS = [
  { name: 'Bubble Studios', logo: require('@/assets/images/friend-bubble-studios.png'), width: 69 },
  { name: 'ЗОТОВ ЦЕНТР', logo: require('@/assets/images/friend-zotov-center.png'), width: 31 },
  { name: 'BEAT', logo: require('@/assets/images/friend-beat.png'), width: 31 },
  { name: 'ЗИЛАРТ', logo: require('@/assets/images/friend-zilart.png'), width: 101 },
  { name: 'KION', logo: require('@/assets/images/friend-kion.png'), width: 78 },
  { name: 'Кинотеатр Художественный' },
  { name: 'B' },
  { name: 'Самокат' },
  { name: 'Чехов и компания' },
  { name: 'twinby' },
  { name: 'AZ Museum' },
  { name: 'Перспектива' },
  { name: 'Внутри' },
  { name: 'A24' },
  { name: 'Практика театр' },
];

/**
 * Футер веб-версии: партнёры (реальные лого) и друзья проекта (текстом —
 * лого-файлов для них нет) + копирайт + ссылка на документы. Показывается
 * на страницах с публичным контентом (события, событие, наставник, статья).
 */
export function SiteFooter() {
  const router = useRouter();
  return (
    <View style={styles.footer}>
      <Text style={styles.sectionLabel}>Наши стратегические партнеры</Text>
      <View style={styles.logosRow}>
        {STRATEGIC_PARTNERS.map((p) => (
          <Image
            key={p.name}
            source={p.logo}
            accessibilityLabel={p.name}
            resizeMode="contain"
            style={{ width: p.width, height: PARTNER_LOGO_HEIGHT }}
          />
        ))}
      </View>

      <Text style={[styles.sectionLabel, styles.friendsLabel]}>Наши большие друзья</Text>
      <View style={styles.logosRow}>
        {FRIENDS.map((f) =>
          f.logo ? (
            <Image
              key={f.name}
              source={f.logo}
              accessibilityLabel={f.name}
              resizeMode="contain"
              style={{ width: f.width, height: PARTNER_LOGO_HEIGHT }}
            />
          ) : (
            <Text key={f.name} style={styles.logoText}>{f.name}</Text>
          )
        )}
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.copyright}>©2026, p(34)</Text>
        <View style={styles.bottomLinks}>
          <Pressable onPress={() => router.push('/contacts' as any)}>
            <Text style={styles.docsLink}>Контакты для связи</Text>
          </Pressable>
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
