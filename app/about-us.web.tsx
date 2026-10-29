import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { useSiteSettings } from '@/hooks/use-site-settings';
import { fixHangingPrepositions } from '@/lib/typography';

// Дефолтные заголовок/текст/фото — показываются, пока админ не задал свои
// (см. AboutUsSetting/admin/site-settings.tsx, секция "О нас").
const DEFAULT_PHOTO = require('@/assets/images/about-us-photo.webp');
const DEFAULT_HEADING = 'О нас';
const DEFAULT_TEXT =
  'p(34) — платформа для свободных городских разговоров и художественных высказываний. ' +
  'Мы помогаем людям открывать новые увлечения, встречаться с теми, кто готов делиться ' +
  'опытом, и смотреть на привычную жизнь под другим углом.\n\n' +
  'Наша цель — объединить наставников, учеников и культурные площадки, чтобы вместе ' +
  'создать пространство для обмена знаниями, творческих экспериментов и новых знакомств.';

// Контакты — не редактируются из админки (в отличие от heading/text выше),
// захардкожены: это реквизиты самой платформы, а не контент конкретной
// страницы. data-text-link — тот же механизм, что у ссылок в статье
// (lib/markdown-inline.tsx, tag-list.tsx) — при наведении только подчёркивание,
// без затемнения (см. правило в app/+html.tsx).
const CONTACTS: { label: string; handle: string; url: string }[] = [
  { label: 'для коллабораций и сотрудничества', handle: '@vladislav_yakunin', url: 'https://t.me/vladislav_yakunin' },
  { label: 'Telegram', handle: '@p34forma', url: 'https://t.me/p34forma' },
  { label: 'Instagram', handle: '@p34.forma', url: 'https://instagram.com/p34.forma' },
];

/**
 * Страница "О нас" — по клику на логотип p(34) в шапке (десктоп, см.
 * site-header.tsx). Та же вёрстка, что у страницы события
 * (events/[id].web.tsx: desktopLayout/leftCol/rightCol на десктопе,
 * заголовок+фото+текст одной колонкой на мобильном) — просто без всего
 * специфичного для события (цена/дата/регистрация/наставник), только
 * фото, заголовок и текст. Полностью редактируется из админки
 * (admin/site-settings.tsx).
 */
export default function AboutUsScreenWeb() {
  const isMobile = useIsMobileWeb();
  const { aboutUs } = useSiteSettings();

  const heading = aboutUs.heading || DEFAULT_HEADING;
  const text = fixHangingPrepositions(aboutUs.text || DEFAULT_TEXT);
  // Обёртка с paddingBottom-трюком (аспект через % от своей же ширины) +
  // картинка внутри position:absolute/inset:0 — для photoUrl с бэкенда (uri)
  // простой aspectRatio на самом Image тоже работал, но ломается именно для
  // ЛОКАЛЬНОГО DEFAULT_PHOTO (require()): react-native-web подставляет
  // зарегистрированные intrinsic width/height ассета как computed height
  // напрямую, aspectRatio у Image при этом игнорируется (та же причина, что
  // и у SECTION_BANNER_IMAGE в journal/[slug].web.tsx — см. тот же приём там).
  const photo = (
    <View style={isMobile ? styles.mobileThumb : styles.cover}>
      <Image
        source={aboutUs.photoUrl ? { uri: aboutUs.photoUrl } : DEFAULT_PHOTO}
        style={styles.photoImage}
        resizeMode="cover"
      />
    </View>
  );

  const contactsBlock = (
    <View style={[styles.contacts, !isMobile && styles.contactsDesktop]}>
      <Text style={styles.contactsHeading}>Свяжитесь с нами</Text>
      {CONTACTS.map((c) => (
        <View key={c.url} style={styles.contactRow}>
          <Text style={styles.contactLabel}>{c.label}</Text>
          <Pressable onPress={() => Linking.openURL(c.url)} {...({ dataSet: { textLink: 'true' } } as any)}>
            <Text style={styles.contactHandle}>{c.handle}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={[styles.scrollContent, isMobile && styles.scrollContentMobile]}>
      <View style={styles.pageContent}>
        {isMobile ? (
          <View>
            <Text style={[styles.title, styles.titleMobile]}>{heading}</Text>
            {photo}
            <Text style={styles.description}>{text}</Text>
            {contactsBlock}
          </View>
        ) : (
          <View style={styles.desktopLayout}>
            <View style={styles.leftCol}>
              <Text style={styles.title}>{heading}</Text>
              <Text style={styles.description}>{text}</Text>
            </View>
            <View style={styles.rightCol}>
              {photo}
            </View>
            {contactsBlock}
          </View>
        )}
      </View>

        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 0, paddingBottom: 24, marginTop: 86 },
  // marginTop:0 — отступ до контента на мобильном даёт только стрелка
  // "назад" в шапке (5px, см. site-header.tsx), не десктопный 86.
  scrollContentMobile: { paddingTop: 0, marginTop: 0 },
  pageContent: { paddingHorizontal: 32 },

  // position:'relative' — точка отсчёта для contactsDesktop
  // (position:'absolute', bottom:0) ниже: блок контактов — третий прямой
  // потомок этого грида (не внутри leftCol), так что его высота больше не
  // зависит от того, сколько текста в описании слева.
  desktopLayout: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 117, position: 'relative' } as any,
  leftCol: { flexBasis: 420, maxWidth: 605, flexShrink: 1 },
  rightCol: { flex: 1, minWidth: 0, maxWidth: 709, position: 'relative', top: 5, right: 0, width: '100%', overflow: 'hidden' },
  // paddingBottom: (1/aspectRatio)*100% — классический приём для аспекта
  // через проценты (которые CSS всегда берёт от ШИРИНЫ блока, в т.ч. для
  // padding), см. комментарий у photo выше.
  cover: { width: '100%', paddingBottom: `${(1 / 1.44) * 100}%`, position: 'relative', overflow: 'hidden', backgroundColor: '#E5E5E5' } as any,
  mobileThumb: { width: '100%', paddingBottom: `${(360 / 649) * 100}%`, position: 'relative', overflow: 'hidden', backgroundColor: '#E5E5E5', marginBottom: 16 } as any,
  photoImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },

  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 0 },
  titleMobile: { fontSize: 25, lineHeight: 28 },
  description: { fontFamily: 'Gramatika-Regular', color: '#010101', marginTop: 40, maxWidth: 504, fontSize: 18, lineHeight: 26 },

  contacts: { marginTop: 40, maxWidth: 504 },
  // Тот же приём, что у кнопок на странице наставника (actionsRow в
  // explore/[id].web.tsx): блок контактов — отдельный от текста элемент
  // (не внутри leftCol, см. JSX), прижатый к нижнему краю desktopLayout
  // (position:'absolute', bottom:0 относительно него — см. position:'relative'
  // у desktopLayout) — то есть к низу более высокой колонки, обычно фото
  // справа. Независимо от длины описания слева — если текст длиннее фото,
  // контакты могут наложиться на хвост описания; текст на этой странице
  // редактируется из админки, при обычной длине (короче фото) наложения
  // не будет.
  contactsDesktop: { position: 'absolute', bottom: 0, left: 0 },
  contactsHeading: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 40, lineHeight: 36, color: '#010101', marginBottom: 16 },
  contactRow: { marginBottom: 12 },
  contactLabel: { fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#687076'},
  contactHandle: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#E02D2D', textDecorationLine: 'none' },
});
