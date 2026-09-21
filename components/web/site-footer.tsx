import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

// Высота логотипов (56px) и размер подписей разделов — как в блоке "партнёры"
// на vladyakunin.ru (--partners__logo height:56px, подпись 18px). Ширина —
// под реальные пропорции каждого файла, иначе лого будут либо сплющены,
// либо с полями.
const PARTNER_LOGO_HEIGHT = 56;

// .partners__block { grid-template-columns: 363fr 833fr 253fr } на
// vladyakunin.ru: слева подпись, справа сетка лого, третья колонка — поле
// справа. 363+833+253=1449 ≈ ширина контента футера, поэтому берём те же
// значения в пикселях один в один.
const FOOTER_LABEL_WIDTH = 363;
const FOOTER_LOGOS_WIDTH = 833;
const LOGOS_PER_ROW = 5;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

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

function Logo(l: { name: string; logo: number; width: number; url?: string }) {
  const image = (
    <Image
      source={l.logo}
      accessibilityLabel={l.name}
      resizeMode="contain"
      style={{ width: l.width, height: PARTNER_LOGO_HEIGHT }}
    />
  );
  if (!l.url) return image;
  return (
    <Pressable onPress={() => window.open(l.url, '_blank', 'noopener,noreferrer')}>
      {image}
    </Pressable>
  );
}

// Сетка лого справа от подписи (.partners__grid: repeat(5, 1fr), gap:50px
// 24px) — строки по 5 штук, внутри строки лого раскиданы по всей ширине
// сетки (space-between), а не сжаты в узкие колонки: наши файлы лого шире,
// чем в оригинале, под фиксированную колонку 147px они бы не влезли.
function LogoGrid({ logos }: { logos: { name: string; logo: number; width: number; url?: string }[] }) {
  return (
    <View style={styles.logosGrid}>
      {chunk(logos, LOGOS_PER_ROW).map((row, i) => (
        <View key={i} style={styles.logosGridRow}>
          {row.map((l) => <Logo key={l.name} {...l} />)}
        </View>
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
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Наши стратегические партнеры</Text>
        <LogoGrid logos={STRATEGIC_PARTNERS} />
      </View>

      <View style={[styles.section, styles.friendsSection]}>
        <Text style={styles.sectionLabel}>Наши большие друзья</Text>
        <LogoGrid logos={FRIENDS} />
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
  footer: { paddingHorizontal: 30, paddingVertical: 30, borderTopWidth: 0, borderColor: '#E5E5E5', marginTop: 305 },
  // .partners__block: слева подпись фиксированной ширины, справа сетка лого.
  section: { flexDirection: 'row', alignItems: 'flex-start' },
  // .partners__block + .partners__block { margin-top: 120px }
  friendsSection: { marginTop: 120 },
  sectionLabel: { width: FOOTER_LABEL_WIDTH, flexShrink: 0, fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#000' },
  logosGrid: { width: FOOTER_LOGOS_WIDTH, rowGap: 50 },
  logosGridRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 40 },
  copyright: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#000' },
  bottomLinks: { flexDirection: 'row', gap: 24 },
  docsLink: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#000', textDecorationLine: 'none' },
});
