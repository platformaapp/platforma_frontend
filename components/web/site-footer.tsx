import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

// Высота логотипов зафиксирована (28px), ширина — под реальные пропорции
// каждого файла, иначе лого будут либо сплющены, либо с полями.
const PARTNER_LOGO_HEIGHT = 28;

const STRATEGIC_PARTNERS = [
  { name: 'ПРО:ВЗГЛЯД', logo: require('@/assets/images/partner-provzglyad.png'), width: 64 },
  { name: 'Еврейский музей и центр толерантности', logo: require('@/assets/images/partner-jewish-museum.png'), width: 69 },
  { name: 'youtalk', logo: require('@/assets/images/partner-youtalk.png'), width: 33 },
  { name: 'ДК РАССВЕТ', logo: require('@/assets/images/partner-dkrassvet.png'), width: 114 },
  { name: 'Театр.doc', logo: require('@/assets/images/partner-teatrdoc.png'), width: 125 },
];

const FRIENDS = [
  { name: 'Bubble Studios', logo: require('@/assets/images/friend-bubble-studios.png'), width: 69 },
  { name: 'ЗОТОВ ЦЕНТР', logo: require('@/assets/images/friend-zotov-center.png'), width: 31 },
  { name: 'BEAT', logo: require('@/assets/images/friend-beat.png'), width: 31 },
  { name: 'ЗИЛАРТ', logo: require('@/assets/images/friend-zilart.png'), width: 101 },
  { name: 'KION', logo: require('@/assets/images/friend-kion.png'), width: 78 },
  { name: 'Кинотеатр Художественный', logo: require('@/assets/images/friend-hudozhestvenny.png'), width: 101 },
  { name: 'B', logo: require('@/assets/images/friend-b.png'), width: 21 },
  { name: 'Самокат', logo: require('@/assets/images/friend-samokat.png'), width: 101 },
  { name: 'Чехов и компания', logo: require('@/assets/images/friend-chekhov-i-kompania.png'), width: 56 },
  { name: 'twinby', logo: require('@/assets/images/friend-twinby.png'), width: 101 },
  { name: 'AZ Museum', logo: require('@/assets/images/friend-az-museum.png'), width: 38 },
  { name: 'Перспектива', logo: require('@/assets/images/friend-perspektiva.png'), width: 100 },
  { name: 'Внутри', logo: require('@/assets/images/friend-vnutri.png'), width: 31 },
  { name: 'A24', logo: require('@/assets/images/friend-a24.png'), width: 38 },
  { name: 'Практика театр', logo: require('@/assets/images/friend-praktika-teatr.png'), width: 27 },
];

function LogoRow({ logos }: { logos: { name: string; logo: number; width: number }[] }) {
  return (
    <View style={styles.logosRow}>
      {logos.map((l) => (
        <Image
          key={l.name}
          source={l.logo}
          accessibilityLabel={l.name}
          resizeMode="contain"
          style={{ width: l.width, height: PARTNER_LOGO_HEIGHT }}
        />
      ))}
    </View>
  );
}

/**
 * Футер веб-версии: партнёры и друзья проекта (реальные лого) + копирайт +
 * ссылки на документы. Показывается на страницах с публичным контентом
 * (события, событие, наставник, статья).
 */
export function SiteFooter() {
  const router = useRouter();
  return (
    <View style={styles.footer}>
      <Text style={styles.sectionLabel}>Наши стратегические партнеры</Text>
      <LogoRow logos={STRATEGIC_PARTNERS} />

      <Text style={[styles.sectionLabel, styles.friendsLabel]}>Наши большие друзья</Text>
      <LogoRow logos={FRIENDS} />

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
  logosRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 40, rowGap: 20 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 40 },
  copyright: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#687076' },
  bottomLinks: { flexDirection: 'row', gap: 24 },
  docsLink: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#687076', textDecorationLine: 'underline' },
});
