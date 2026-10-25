import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackArrowIcon } from '@/components/web/back-arrow-icon';
import { useSiteSettings } from '@/hooks/use-site-settings';

// Нативный фолбэк для about-us.web.tsx (страница "О нас", см. там) — Metro
// требует файл без платформенного суффикса рядом с .web.tsx (та же схема,
// что и у остальных .web.tsx экранов в app/, см. [id].tsx рядом с [id].web.tsx).
// Сам пункт недоступен из нативной навигации — ссылка p(34) есть только в
// десктопной веб-шапке (components/web/site-header.tsx).
const DEFAULT_HEADING = 'О нас';
const DEFAULT_TEXT =
  'p(34) — платформа для свободных городских разговоров и художественных высказываний. ' +
  'Мы помогаем людям открывать новые увлечения, встречаться с теми, кто готов делиться ' +
  'опытом, и смотреть на привычную жизнь под другим углом.\n\n' +
  'Наша цель — объединить наставников, учеников и культурные площадки, чтобы вместе ' +
  'создать пространство для обмена знаниями, творческих экспериментов и новых знакомств.';

// См. комментарий у CONTACTS в about-us.web.tsx — те же контакты.
const CONTACTS: { label: string; handle: string; url: string }[] = [
  { label: 'для коллабораций и сотрудничества', handle: '@vladislav_yakunin', url: 'https://t.me/vladislav_yakunin' },
  { label: 'Telegram', handle: '@p34forma', url: 'https://t.me/p34forma' },
  { label: 'Instagram', handle: '@p34.forma', url: 'https://instagram.com/p34.forma' },
];

export default function AboutUsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { aboutUs } = useSiteSettings();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtnRow} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/events' as any))}>
          <BackArrowIcon width={16} height={15} />
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {aboutUs.photoUrl ? <Image source={{ uri: aboutUs.photoUrl }} style={styles.photo} resizeMode="cover" /> : <View style={styles.photo} />}
        <Text style={styles.heading}>{aboutUs.heading || DEFAULT_HEADING}</Text>
        <Text style={styles.text}>{aboutUs.text || DEFAULT_TEXT}</Text>

        <View style={styles.contacts}>
          <Text style={styles.contactsHeading}>Свяжитесь с нами</Text>
          {CONTACTS.map((c) => (
            <View key={c.url} style={styles.contactRow}>
              <Text style={styles.contactLabel}>{c.label}</Text>
              <Pressable onPress={() => Linking.openURL(c.url)}>
                <Text style={styles.contactHandle}>{c.handle}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#181818' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  photo: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#E5E5E5', marginBottom: 24 },
  heading: { fontSize: 25, lineHeight: 28, fontFamily: 'Gramatika-Regular', color: '#181818', marginBottom: 16 },
  text: { fontSize: 15, lineHeight: 22, fontFamily: 'Gramatika-Regular', color: '#181818' },

  contacts: { marginTop: 32 },
  contactsHeading: { fontSize: 20, lineHeight: 24, fontFamily: 'Gramatika-Regular', color: '#181818', marginBottom: 12 },
  contactRow: { marginBottom: 10 },
  contactLabel: { fontFamily: 'Gramatika-Regular', fontSize: 13, color: '#687076' },
  contactHandle: { fontFamily: 'Gramatika-Regular', fontSize: 15, color: '#E02D2D', textDecorationLine: 'underline' },
});
