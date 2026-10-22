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
 * site-header.tsx). Референс по структуре/иерархии (не по содержанию):
 * vladyakunin.ru/projects/kontent-kak-sistema-rosta — большое фото, заголовок,
 * текст. Полностью редактируется из админки (admin/site-settings.tsx).
 */
export default function AboutUsScreenWeb() {
  const isMobile = useIsMobileWeb();
  const { aboutUs } = useSiteSettings();

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.pageContent, isMobile && styles.pageContentMobile]}>
          {aboutUs.photoUrl ? (
            <Image source={{ uri: aboutUs.photoUrl }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={styles.photo} />
          )}
          <Text style={[styles.heading, isMobile && styles.headingMobile]}>{aboutUs.heading || DEFAULT_HEADING}</Text>
          <Text style={styles.text}>{aboutUs.text || DEFAULT_TEXT}</Text>
        </View>

        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 24, paddingBottom: 24 },
  pageContent: { paddingHorizontal: 32, maxWidth: 840 },
  pageContentMobile: { paddingHorizontal: 20 },
  photo: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#E5E5E5', marginTop: 62, marginBottom: 32 },
  heading: { fontSize: 40, lineHeight: 44, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 24 },
  headingMobile: { fontSize: 25, lineHeight: 28, marginBottom: 16 },
  text: { fontSize: 18, lineHeight: 26, fontFamily: 'Gramatika-Regular', color: '#010101' },
});
