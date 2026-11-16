import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';

/** Веб-версия пользовательского соглашения (см. user-agreement.tsx для нативной). */
export default function UserAgreementScreenWeb() {
  const isMobile = useIsMobileWeb();
  return (
    <SiteShell>
      <ScrollView contentContainerStyle={[styles.scrollContent, isMobile && styles.scrollContentMobile]}>
      <View style={[styles.pageContent, isMobile && styles.pageContentMobile]}>
        <View style={styles.content}>
          <Text style={[styles.title, isMobile && styles.titleMobile]}>Пользовательское соглашение</Text>

          <Text style={styles.heading}>What is Lorem Ipsum?</Text>
          <Text style={styles.paragraph}>
            Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry&apos;s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.
          </Text>

          <Text style={styles.heading}>Why do we use it?</Text>
          <Text style={styles.paragraph}>
            It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using &apos;Content here, content here&apos;, making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for &apos;lorem ipsum&apos; will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).
          </Text>
        </View>
      </View>

        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 24, paddingBottom: 24 },
  // paddingTop:0 — отступ до контента на мобильном даёт только стрелка
  // "назад" в шапке (5px, см. site-header.tsx).
  scrollContentMobile: { paddingTop: 0 },
  pageContent: { paddingHorizontal: 32 },
  pageContentMobile: { paddingHorizontal: 20 },
  content: { maxWidth: 720, gap: 16 },
  title: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 40, lineHeight: 36, color: '#010101', marginBottom: 8 },
  titleMobile: { fontSize: 25, lineHeight: 28 },
  heading: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 25, lineHeight: 28, color: '#010101', marginTop: 8 },
  paragraph: { fontFamily: 'Gramatika-Regular', fontSize: 19, lineHeight: 26, color: '#010101' },
});
