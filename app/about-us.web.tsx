import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { useSiteSettings } from '@/hooks/use-site-settings';

// Дефолтный заголовок/текст — показываются, пока админ не задал свои (см.
// AboutUsSetting/admin/site-settings.tsx, секция "О нас"). Фото без дефолта
// — пустой плейсхолдер, пока не загружено реальное.
const DEFAULT_HEADING = 'О нас';
const DEFAULT_TEXT =
  'p(34) — платформа для лекций, творческих занятий и встреч с наставниками. ' +
  'Мы собираем независимых авторов и организаторов в одном месте, чтобы события ' +
  'было легко находить, бронировать и проводить.';

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
  const text = aboutUs.text || DEFAULT_TEXT;
  const photo = aboutUs.photoUrl ? (
    <Image source={{ uri: aboutUs.photoUrl }} style={isMobile ? styles.mobileThumb : styles.cover} resizeMode="cover" />
  ) : (
    <View style={isMobile ? styles.mobileThumb : styles.cover} />
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
  scrollContentMobile: { paddingTop: 0 },
  pageContent: { paddingHorizontal: 32 },

  desktopLayout: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 117 } as any,
  leftCol: { flexBasis: 420, maxWidth: 605, flexShrink: 1, height: '100%' },
  rightCol: { flex: 1, minWidth: 0, maxWidth: 709, position: 'relative', top: 5, right: 0, width: '100%', overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 1.44, backgroundColor: '#E5E5E5' },
  mobileThumb: { width: '100%', aspectRatio: 649 / 360, backgroundColor: '#E5E5E5', marginBottom: 16 },

  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 0 },
  titleMobile: { fontSize: 25, lineHeight: 28 },
  description: { fontFamily: 'Gramatika-Regular', color: '#010101', marginTop: 40, maxWidth: 504, fontSize: 18, lineHeight: 26 },
});
