import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell } from '@/components/web/site-shell';

/** Веб-версия пользовательского соглашения (см. user-agreement.tsx для нативной). */
export default function UserAgreementScreenWeb() {
  const router = useRouter();

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/events' as any))}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>

        <View style={styles.content}>
          <Text style={styles.title}>Пользовательское соглашение</Text>

          <Text style={styles.heading}>What is Lorem Ipsum?</Text>
          <Text style={styles.paragraph}>
            Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry&apos;s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.
          </Text>

          <Text style={styles.heading}>Why do we use it?</Text>
          <Text style={styles.paragraph}>
            It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using &apos;Content here, content here&apos;, making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for &apos;lorem ipsum&apos; will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).
          </Text>
        </View>

        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 24 },
  backArrow: { fontSize: 25, color: '#010101', marginBottom: 24 },
  content: { maxWidth: 720, gap: 16 },
  title: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 40, lineHeight: 36, color: '#010101', marginBottom: 8 },
  heading: { fontFamily: 'Gramatika-Regular', fontWeight: 'bold', fontSize: 25, lineHeight: 28, color: '#010101', marginTop: 8 },
  paragraph: { fontFamily: 'Gramatika-Regular', fontSize: 19, lineHeight: 26, color: '#010101' },
});
