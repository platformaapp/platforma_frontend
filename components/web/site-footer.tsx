import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

// Высота логотипов (56px) и размер подписей разделов — как в блоке "партнёры"
// на vladyakunin.ru (--partners__logo height:56px, подпись 18px). Ширина —
// под реальные пропорции каждого файла, иначе лого будут либо сплющены,
// либо с полями.
const PARTNER_LOGO_HEIGHT = 56;

const STRATEGIC_PARTNERS = [
  { name: 'ПРО:ВЗГЛЯД', logo: require('@/assets/images/partner-provzglyad.png'), width: 128, url: 'https://provzglyad.com/' },
  { name: 'Еврейский музей и центр толерантности', logo: require('@/assets/images/partner-jewish-museum.png'), width: 138, url: 'https://www.jewish-museum.ru/' },
  { name: 'youtalk', logo: require('@/assets/images/partner-youtalk.png'), width: 66, url: 'https://youtalk.ru/' },
  { name: 'ДК РАССВЕТ', logo: require('@/assets/images/partner-dkrassvet.png'), width: 228, url: 'https://dkrassvet.space/' },
  { name: 'Театр.doc', logo: require('@/assets/images/partner-teatrdoc.png'), width: 250, url: 'https://www.teatrdoc.ru/' },
];

// url не проставлен там, где среди нескольких организаций с похожим/общим
// названием не нашлось однозначного совпадения (см. чат) — лого пока кликом
// никуда не ведёт, чтобы не сослаться на чужой сайт.
const FRIENDS = [
  { name: 'Bubble Studios', logo: require('@/assets/images/friend-bubble-studios.png'), width: 138, url: 'https://bubblestudios.com/' },
  { name: 'ЗОТОВ ЦЕНТР', logo: require('@/assets/images/friend-zotov-center.png'), width: 62, url: 'https://centrezotov.ru/' },
  { name: 'BEAT', logo: require('@/assets/images/friend-beat.png'), width: 62, url: 'https://beatfilmfestival.ru/' },
  { name: 'ЗИЛАРТ', logo: require('@/assets/images/friend-zilart.png'), width: 202, url: 'https://zilart.ru/' },
  { name: 'KION', logo: require('@/assets/images/friend-kion.png'), width: 156, url: 'https://kion.ru/' },
  { name: 'Кинотеатр Художественный', logo: require('@/assets/images/friend-hudozhestvenny.png'), width: 202, url: 'https://cinema1909.ru/' },
  { name: 'B', logo: require('@/assets/images/friend-b.png'), width: 42 },
  { name: 'Самокат', logo: require('@/assets/images/friend-samokat.png'), width: 202, url: 'https://samokatbook.ru/' },
  { name: 'Чехов и компания', logo: require('@/assets/images/friend-chekhov-i-kompania.png'), width: 112 },
  { name: 'twinby', logo: require('@/assets/images/friend-twinby.png'), width: 202, url: 'https://twinby.ru/' },
  { name: 'AZ Museum', logo: require('@/assets/images/friend-az-museum.png'), width: 76, url: 'https://museum-az.com/' },
  { name: 'Перспектива', logo: require('@/assets/images/friend-perspektiva.png'), width: 200 },
  { name: 'Внутри', logo: require('@/assets/images/friend-vnutri.png'), width: 62, url: 'https://www.vnutri.art/' },
  { name: 'A24', logo: require('@/assets/images/friend-a24.png'), width: 76, url: 'https://a24films.com/' },
  { name: 'Практика театр', logo: require('@/assets/images/friend-praktika-teatr.png'), width: 54, url: 'https://praktikatheatre.ru/' },
];

function LogoRow({ logos }: { logos: { name: string; logo: number; width: number; url?: string }[] }) {
  return (
    <View style={styles.logosRow}>
      {logos.map((l) => {
        const image = (
          <Image
            source={l.logo}
            accessibilityLabel={l.name}
            resizeMode="contain"
            style={{ width: l.width, height: PARTNER_LOGO_HEIGHT }}
          />
        );
        if (!l.url) return <React.Fragment key={l.name}>{image}</React.Fragment>;
        return (
          <Pressable key={l.name} onPress={() => window.open(l.url, '_blank', 'noopener,noreferrer')}>
            {image}
          </Pressable>
        );
      })}
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
  footer: { paddingHorizontal: 30, paddingVertical: 30, borderTopWidth: 0, borderColor: '#E5E5E5', marginTop: 305 },
  sectionLabel: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#000', marginBottom: 16 },
  friendsLabel: { marginTop: 32 },
  logosRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 24, rowGap: 32 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 40 },
  copyright: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#000' },
  bottomLinks: { flexDirection: 'row', gap: 24 },
  docsLink: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#000', textDecorationLine: 'none' },
});
