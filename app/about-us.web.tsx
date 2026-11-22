import React from 'react';
import { Asset } from 'expo-asset';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  // С маленькой буквы — как и первая подпись ("для коллабораций и
  // сотрудничества"), раньше тут были с заглавной.
  { label: 'telegram', handle: '@p34forma', url: 'https://t.me/p34forma' },
  { label: 'instagram', handle: '@p34.forma', url: 'https://instagram.com/p34.forma' },
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
  // Let the browser derive height from the original file, for both the
  // default asset and images uploaded in the admin panel.
  const photo = (
    <View style={styles.photoFrame}>
      <img
        data-about-us-photo="true"
        src={aboutUs.photoUrl || Asset.fromModule(DEFAULT_PHOTO).uri}
        alt={heading}
        style={{ display: 'block', width: '100%', height: 'auto', objectPosition: 'left' }}
      />
    </View>
  );

  const contactRows = CONTACTS.map((c) => (
        <View key={c.url} style={styles.contactRow}>
          <Text style={styles.contactLabel}>{c.label}</Text>
          <Pressable onPress={() => Linking.openURL(c.url)} {...({ dataSet: { textLink: 'true' } } as any)}>
            <Text style={styles.contactHandle}>{c.handle}</Text>
          </Pressable>
        </View>
      ));

  const contactsBlock = (
    <View style={[styles.contacts, !isMobile && styles.contactsDesktop]}>
      <Text style={[styles.contactsHeading, isMobile && styles.contactsHeadingMobile]}>Свяжитесь с нами</Text>
      {contactRows}
    </View>
  );

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={[styles.scrollContent, isMobile && styles.scrollContentMobile]}>
      <View style={[styles.pageContent, isMobile && styles.pageContentMobile]}>
        {isMobile ? (
          <View style={styles.mobileStack}>
            <Text style={[styles.title, styles.titleMobile]}>{heading}</Text>
            {photo}
            <Text style={[styles.description, isMobile && styles.descriptionMobile]}>{text}</Text>
            {contactsBlock}
          </View>
        ) : (
          <>
          <View style={styles.desktopLayout}>
            <View style={styles.leftCol}>
              <Text style={styles.title}>{heading}</Text>
              <Text style={[styles.description, isMobile && styles.descriptionMobile]}>{text}</Text>
            </View>
            <View style={styles.rightCol}>
              {photo}
            </View>
          </View>
          {contactsBlock}
          </>
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
  pageContentMobile: { paddingHorizontal: 20 },
  mobileStack: { gap: 24 },
  descriptionMobile: { marginTop: 0, maxWidth: '100%' },
  contactsHeadingMobile: { fontSize: 30, lineHeight: 30 },

  desktopLayout: { flexDirection: 'row', justifyContent: 'space-between', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', columnGap: 'clamp(24px, 8vw, 117px)' } as any,
  leftCol: { flexBasis: 420, maxWidth: 605, flexShrink: 1 },
  rightCol: { flex: 1, minWidth: 0, maxWidth: 709, width: '100%', alignSelf: 'flex-start', overflow: 'hidden' },
  photoFrame: { width: '100%', alignSelf: 'flex-end' },

  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 0 },
  titleMobile: { fontSize: 30, lineHeight: 36, marginBottom: 0 },
  description: { fontFamily: 'Gramatika-Regular', color: '#010101', marginTop: 40, maxWidth: 504, fontSize: 18, lineHeight: 26 },

  // Contacts follow the entire desktop row, below the photo as well as the text.
  contacts: { marginTop: 40, maxWidth: 504 },
  contactsDesktop: { marginTop: 0 },
  contactsHeading: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 40, lineHeight: 36, color: '#010101', marginBottom: 16 },
  contactRow: { marginBottom: 12 },
  contactLabel: { fontFamily: 'Gramatika-Regular', fontSize: 14, color: '#687076'},
  contactHandle: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#E02D2D', textDecorationLine: 'none' },
});
