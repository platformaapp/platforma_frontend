import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CONTENT_MAX_WIDTH, MOBILE_BREAKPOINT } from './layout-constants';

// Горизонтальный паддинг контента страниц, использующих SiteFooter (см. их
// scrollContent) — используем то же значение для внутреннего отступа футера,
// чтобы подпись/лого остались на той же линии, что и остальной контент.
const PAGE_PADDING_HORIZONTAL = 32;

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
// На мобильном подпись+сетка не влезают рядом (363+833) — лого переносятся
// в обычный flexWrap-ряд под подписью, по аналогии с карточками событий.
const MOBILE_LOGO_WIDTH = 96;
const MOBILE_LOGO_HEIGHT = 36;

const STRATEGIC_PARTNERS = [
  { name: 'ПРО:ВЗГЛЯД', logo: require('@/assets/images/partner-provzglyad.png'), url: 'https://provzglyad.com/' },
  { name: 'Еврейский музей и центр толерантности', logo: require('@/assets/images/partner-jewish-museum.png'), url: 'https://www.jewish-museum.ru/' },
  { name: 'youtalk', logo: require('@/assets/images/partner-youtalk.png'), url: 'https://youtalk.ru/' },
  { name: 'ДК РАССВЕТ', logo: require('@/assets/images/partner-dkrassvet.png'), url: 'https://dkrassvet.space/' },
  { name: 'Театр.doc', logo: require('@/assets/images/partner-teatrdoc.png'), url: 'https://www.teatrdoc.ru/' },
];

// url не проставлен там, где среди нескольких организаций с похожим/общим
// названием не нашлось однозначного совпадения (см. чат) — лого пока кликом
// никуда не ведёт, чтобы не сослаться на чужой сайт.
const FRIENDS = [
  { name: 'Bubble Studios', logo: require('@/assets/images/friend-bubble-studios.png'), url: 'https://bubblestudios.com/' },
  { name: 'ЗОТОВ ЦЕНТР', logo: require('@/assets/images/friend-zotov-center.png'), url: 'https://centrezotov.ru/' },
  { name: 'BEAT', logo: require('@/assets/images/friend-beat.png'), url: 'https://beatfilmfestival.ru/' },
  { name: 'ЗИЛАРТ', logo: require('@/assets/images/friend-zilart.png'), url: 'https://zilart.ru/' },
  { name: 'KION', logo: require('@/assets/images/friend-kion.png'), url: 'https://kion.ru/' },
  { name: 'Кинотеатр Художественный', logo: require('@/assets/images/friend-hudozhestvenny.png'), url: 'https://cinema1909.ru/' },
  { name: 'B', logo: require('@/assets/images/friend-b.png') },
  { name: 'Самокат', logo: require('@/assets/images/friend-samokat.png'), url: 'https://samokatbook.ru/' },
  { name: 'Чехов и компания', logo: require('@/assets/images/friend-chekhov-i-kompania.png') },
  { name: 'twinby', logo: require('@/assets/images/friend-twinby.png'), url: 'https://twinby.ru/' },
  { name: 'AZ Museum', logo: require('@/assets/images/friend-az-museum.png'), url: 'https://museum-az.com/' },
  { name: 'Перспектива', logo: require('@/assets/images/friend-perspektiva.png') },
  { name: 'Внутри', logo: require('@/assets/images/friend-vnutri.png'), url: 'https://www.vnutri.art/' },
  { name: 'A24', logo: require('@/assets/images/friend-a24.png'), url: 'https://a24films.com/' },
  { name: 'Практика театр', logo: require('@/assets/images/friend-praktika-teatr.png'), url: 'https://praktikatheatre.ru/' },
];

// .partners__logo img { max-width:100%; max-height:100%; object-fit:contain }
// — картинка вписывается в ячейку сетки любых пропорций без ручных ширин;
// resizeMode="contain" в бокс любого размера делает то же самое.
function Logo({ isMobile, ...l }: { name: string; logo: number; url?: string; isMobile: boolean }) {
  const image = (
    <Image
      source={l.logo}
      accessibilityLabel={l.name}
      resizeMode="contain"
      style={isMobile ? styles.logoImageMobile : styles.logoImage}
    />
  );
  if (!l.url) return image;
  return (
    <Pressable onPress={() => window.open(l.url, '_blank', 'noopener,noreferrer')}>
      {image}
    </Pressable>
  );
}

// Десктоп — .partners__grid: display:grid; grid-template-columns:repeat(5,1fr);
// gap:50px 24px; align-items:center — настоящая CSS-сетка (веб-онли).
// Мобильный — обычный flexWrap-ряд фиксированных ячеек, сетка 363+833 шире
// любого мобильного экрана и не может тут работать.
function LogoGrid({ logos, isMobile }: { logos: { name: string; logo: number; url?: string }[]; isMobile: boolean }) {
  return (
    <View style={isMobile ? styles.logosWrapMobile : styles.logosGrid}>
      {logos.map((l) => <Logo key={l.name} {...l} isMobile={isMobile} />)}
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
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < MOBILE_BREAKPOINT;
  // Full-bleed: футер лежит внутри ScrollView (без него снова ломается
  // прокрутка — см. коммит про схлопывание ScrollView), но должен визуально
  // тянуться на всю ширину окна, а не только на центрированную колонку
  // CONTENT_MAX_WIDTH. Отрицательный marginHorizontal выводит фон/рамку до
  // самых краёв окна, а такой же paddingHorizontal возвращает внутренний
  // контент на прежнее место — на линию остального контента страницы.
  const centerGap = Math.max(0, (windowWidth - CONTENT_MAX_WIDTH) / 2);

  return (
    <View style={[styles.footer, { marginHorizontal: -centerGap, paddingHorizontal: centerGap + PAGE_PADDING_HORIZONTAL }]}>
      <View style={[styles.section, isMobile && styles.sectionMobile]}>
        <Text style={[styles.sectionLabel, isMobile && styles.sectionLabelMobile]}>Наши стратегические партнеры</Text>
        <LogoGrid logos={STRATEGIC_PARTNERS} isMobile={isMobile} />
      </View>

      <View style={[styles.section, isMobile ? styles.friendsSectionMobile : styles.friendsSection, isMobile && styles.sectionMobile]}>
        <Text style={[styles.sectionLabel, isMobile && styles.sectionLabelMobile]}>Наши большие друзья</Text>
        <LogoGrid logos={FRIENDS} isMobile={isMobile} />
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
  footer: { paddingVertical: 30, borderTopWidth: 0, borderColor: '#E5E5E5', marginTop: 305 },
  // .partners__block: слева подпись фиксированной ширины, справа сетка лого.
  section: { flexDirection: 'row', alignItems: 'flex-start' },
  // На мобильном подпись не влезает рядом с сеткой — подпись сверху, лого снизу.
  sectionMobile: { flexDirection: 'column', alignItems: 'flex-start' },
  // .partners__block + .partners__block { margin-top: 120px }
  friendsSection: { marginTop: 120 },
  friendsSectionMobile: { marginTop: 40 },
  sectionLabel: { width: FOOTER_LABEL_WIDTH, flexShrink: 0, fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#000' },
  sectionLabelMobile: { width: 'auto', marginBottom: 16 },
  // display/gridTemplateColumns — веб-онли CSS-свойства, их нет в типах
  // ViewStyle, поэтому приводим объект через as any (сам компонент — только
  // для веба, см. использование SiteFooter только в *.web.tsx).
  logosGrid: {
    width: FOOTER_LOGOS_WIDTH,
    alignItems: 'center',
    rowGap: 50,
    columnGap: 24,
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
  } as any,
  logoImage: { width: '100%', height: PARTNER_LOGO_HEIGHT },
  // Мобильный — простой перенос по ширине экрана, а не жёсткая 5-колоночная сетка.
  logosWrapMobile: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 20, columnGap: 20 },
  logoImageMobile: { width: MOBILE_LOGO_WIDTH, height: MOBILE_LOGO_HEIGHT },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 40 },
  copyright: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#000' },
  bottomLinks: { flexDirection: 'row', gap: 24 },
  docsLink: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#000', textDecorationLine: 'none' },
});
