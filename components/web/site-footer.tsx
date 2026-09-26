import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ContactsContent } from '@/app/contacts';
import { OfferContent } from '@/app/offer';
import { useSiteSettings } from '@/hooks/use-site-settings';
import { DocumentModal } from './document-modal';
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

// "Кого консультировал" — по референсу это отдельные 3 клиентских лого, не
// пересекающиеся с сеткой "друзей" ниже (старые 5 логотипов страт.
// партнёров либо переехали в FRIENDS, либо убраны — см. FRIENDS).
const STRATEGIC_PARTNERS = [
  { name: 'X5 Group', logo: require('@/assets/images/partner-x5.png'), url: 'https://www.x5.ru/' },
  { name: 'Яндекс Директ', logo: require('@/assets/images/partner-yandex-direct.png'), url: 'https://direct.yandex.ru/' },
  { name: 'VK Билеты', logo: require('@/assets/images/partner-vk-tickets.png'), url: 'https://vk.com/tickets' },
];

// url не проставлен там, где среди нескольких организаций с похожим/общим
// названием не нашлось однозначного совпадения (см. чат) — лого пока кликом
// никуда не ведёт, чтобы не сослаться на чужой сайт.
const FRIENDS = [
  { name: 'Никола-Ленивец', logo: require('@/assets/images/friend-nikola-lenivets.png'), url: 'https://nikola-lenivets.com/' },
  { name: 'Random Coffee', logo: require('@/assets/images/friend-random-coffee.png') },
  { name: 'Кинотеатр Художественный', logo: require('@/assets/images/friend-hudozhestvenny.png'), url: 'https://cinema1909.ru/' },
  { name: 'ЗОТОВ ЦЕНТР', logo: require('@/assets/images/friend-zotov-center.png'), url: 'https://centrezotov.ru/' },
  { name: 'KION', logo: require('@/assets/images/friend-kion.png'), url: 'https://kion.ru/' },
  { name: 'Bubble Studios', logo: require('@/assets/images/friend-bubble-studios.png'), url: 'https://bubblestudios.com/' },
  { name: 'youtalk', logo: require('@/assets/images/friend-youtalk.png'), url: 'https://youtalk.ru/' },
  { name: 'BEAT', logo: require('@/assets/images/friend-beat.png'), url: 'https://beatfilmfestival.ru/' },
  { name: 'Skyeng', logo: require('@/assets/images/friend-skyeng.png'), url: 'https://skyeng.ru/' },
  { name: 'ЗИЛАРТ', logo: require('@/assets/images/friend-zilart.png'), url: 'https://zilart.ru/' },
  { name: 'ПРО:ВЗГЛЯД', logo: require('@/assets/images/friend-provzglyad.png'), url: 'https://provzglyad.com/' },
  { name: 'ИНОЕКИНО', logo: require('@/assets/images/friend-inoekino.png') },
  { name: 'КАРО/АРТ', logo: require('@/assets/images/friend-karo-art.png') },
  { name: 'Практика театр', logo: require('@/assets/images/friend-praktika-teatr.png'), url: 'https://praktikatheatre.ru/' },
  { name: 'twinby', logo: require('@/assets/images/friend-twinby.png'), url: 'https://twinby.ru/' },
  { name: 'Еврейский музей и центр толерантности', logo: require('@/assets/images/friend-jewish-museum.png'), url: 'https://www.jewish-museum.ru/' },
  { name: 'Ad Marginem', logo: require('@/assets/images/friend-ad-marginem.jpg'), url: 'https://admarginem.ru/' },
  { name: 'AZ Museum', logo: require('@/assets/images/friend-az-museum.png'), url: 'https://museum-az.com/' },
  { name: 'ДК РАССВЕТ', logo: require('@/assets/images/friend-dkrassvet.png'), url: 'https://dkrassvet.space/' },
  { name: 'ЭЙЧ', logo: require('@/assets/images/friend-eich.png') },
];

// .partners__logo img { max-width:100%; max-height:100%; object-fit:contain }
// — картинка вписывается в ячейку сетки любых пропорций без ручных ширин;
// resizeMode="contain" в бокс любого размера делает то же самое.
// logo — либо локальный require() (number), либо ссылка из админки (string).
function Logo(l: { name: string; logo: number | string; url?: string }) {
  const source = typeof l.logo === 'string' ? { uri: l.logo } : l.logo;
  const image = (
    <Image source={source} accessibilityLabel={l.name} resizeMode="contain" style={styles.logoImage} />
  );
  if (!l.url) return image;
  return (
    <Pressable onPress={() => window.open(l.url, '_blank', 'noopener,noreferrer')}>
      {image}
    </Pressable>
  );
}

// .partners__grid: display:grid; grid-template-columns:repeat(5,1fr);
// gap:50px 24px; align-items:center — настоящая CSS-сетка (веб-онли; блок
// показывается только на десктопе, см. displayPartners в SiteFooter).
function LogoGrid({ logos }: { logos: { name: string; logo: number | string; url?: string }[] }) {
  return (
    <View style={styles.logosGrid}>
      {logos.map((l) => <Logo key={l.name} {...l} />)}
    </View>
  );
}

/**
 * Футер веб-версии: копирайт + ссылки на документы — на всех страницах;
 * блоки партнёров/друзей — только там, где это явно запрошено (showPartners),
 * и только на десктопе (на мобильном партнёров не показываем нигде вообще).
 */
export function SiteFooter({ showPartners = false }: { showPartners?: boolean }) {
  const [openDoc, setOpenDoc] = useState<'none' | 'contacts' | 'offer'>('none');
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < MOBILE_BREAKPOINT;
  const displayPartners = showPartners && !isMobile;
  // Если админ настроил свой список партнёров — показываем его вместо
  // захардкоженных FRIENDS (одной сеткой, без деления на "стратегических").
  const { partners: adminPartners } = useSiteSettings();
  const friends = adminPartners.length > 0
    ? adminPartners.map((p) => ({ name: p.name, logo: p.logoUrl, url: p.linkUrl }))
    : FRIENDS;
  // Full-bleed: футер лежит внутри ScrollView (без него снова ломается
  // прокрутка — см. коммит про схлопывание ScrollView), но должен визуально
  // тянуться на всю ширину окна, а не только на центрированную колонку
  // CONTENT_MAX_WIDTH. Отрицательный marginHorizontal выводит фон/рамку до
  // самых краёв окна, а такой же paddingHorizontal возвращает внутренний
  // контент на прежнее место — на линию остального контента страницы.
  const centerGap = Math.max(0, (windowWidth - CONTENT_MAX_WIDTH) / 2);

  return (
    <View style={[styles.footer, { marginHorizontal: -centerGap, paddingHorizontal: centerGap + PAGE_PADDING_HORIZONTAL }]}>
      {displayPartners ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Наши стратегические партнеры</Text>
            <LogoGrid logos={STRATEGIC_PARTNERS} />
          </View>

          <View style={[styles.section, styles.friendsSection]}>
            <Text style={styles.sectionLabel}>Наши большие друзья</Text>
            <LogoGrid logos={friends} />
          </View>
        </>
      ) : null}

      <View style={[styles.bottomRow, displayPartners && styles.bottomRowWithPartners]}>
        <Text style={styles.copyright}>©2026, p(34)</Text>
        <View style={styles.bottomLinks}>
          <Pressable onPress={() => setOpenDoc('contacts')}>
            <Text style={styles.docsLink}>Контакты для связи</Text>
          </Pressable>
          <Pressable onPress={() => setOpenDoc('offer')}>
            <Text style={styles.docsLink}>Официальные документы</Text>
          </Pressable>
        </View>
      </View>

      <DocumentModal visible={openDoc === 'contacts'} onClose={() => setOpenDoc('none')} title="Контакты для связи">
        <ContactsContent />
      </DocumentModal>
      <DocumentModal visible={openDoc === 'offer'} onClose={() => setOpenDoc('none')} title="Официальные документы">
        <OfferContent />
      </DocumentModal>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingVertical: 0, borderTopWidth: 0, borderColor: '#E5E5E5', marginTop: 305 },
  // .partners__block: слева подпись фиксированной ширины, справа сетка лого.
  section: { flexDirection: 'row', alignItems: 'flex-start' },
  // .partners__block + .partners__block { margin-top: 120px }
  friendsSection: { marginTop: 120 },
  sectionLabel: { width: FOOTER_LABEL_WIDTH, flexShrink: 0, fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#000' },
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
  // Без партнёров сверху — небольшой отступ вместо огромного (тот нужен был,
  // только чтобы отбить копирайт от сетки лого).
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 40 },
  bottomRowWithPartners: { marginTop: 258 },
  copyright: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#000' },
  bottomLinks: { flexDirection: 'row', gap: 24 },
  docsLink: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#000', textDecorationLine: 'none' },
});
