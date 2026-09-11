import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell } from '@/components/web/site-shell';

const MOCK_EVENT = {
  title: 'Групповое обсуждение выставки «Оттепель»',
  author: 'Евгений Максимов',
  date: '24 сентября, 19:00',
};

const LOREM = 'Давно выяснено, что при оценке дизайна и композиции читаемый текст мешает сосредоточиться. Lorem Ipsum используют потому, что тот обеспечивает более или менее стандартное заполнение шаблона, а также реальное распределение букв и пробелов в абзацах, которое не получается при простой дубликации «Здесь ваш текст.. Здесь ваш текст.. Здесь ваш текст..» Многие программы электронной вёрстки и редакторы HTML используют Lorem Ipsum в качестве текста по умолчанию.';

/**
 * Мок-контент — см. журнал/index.web.tsx: бэкенду нужен эндпоинт со статьями
 * (title, author.name/role/avatarUrl, coverUrl, body, gallery — картинки
 * ниже показаны серыми плейсхолдерами, т.к. реальных URL пока нет).
 * URL-параметр id пока не используется — все статьи показывают одну и ту же
 * заглушку, реальный fetch по id подключится вместе с бэкендом.
 */
export default function ArticleScreenWeb() {
  const router = useRouter();

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/journal' as any))}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>

        <View style={styles.row}>
          <View style={styles.colText}>
            <Text style={styles.title}>Как подойти к выставкам с умом, подготовиться и взять от них максимум?</Text>
            <View style={styles.authorRow}>
              <View style={styles.authorAvatar} />
              <View>
                <Text style={styles.author}>Евгений Максимов</Text>
                <Text style={styles.role}>Куратор, деятель культуры</Text>
              </View>
            </View>
            <Text style={styles.body}>{LOREM}</Text>
          </View>
          <View style={styles.colImage}>
            <View style={styles.coverImage} />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.colText}>
            <Text style={styles.subheading}>Как подойти к выставкам с умом, подготовиться</Text>
            <Text style={styles.body}>{LOREM}</Text>
          </View>
          <View style={styles.colImage}>
            <View style={styles.galleryRow}>
              <View style={styles.galleryImage} />
              <View style={styles.galleryImage} />
            </View>
          </View>
        </View>

        <View style={styles.ctaBlock}>
          <Pressable onPress={() => router.push('/events' as any)}>
            <Text style={styles.actionLinkText}>+ Записаться на событие</Text>
          </Pressable>
          <Pressable style={styles.eventCard} onPress={() => router.push('/events' as any)}>
            <View style={styles.eventCardImage} />
            <View style={styles.eventCardInfo}>
              <Text style={styles.eventCardTitle} numberOfLines={2}>{MOCK_EVENT.title}</Text>
              <Text style={styles.eventCardAuthor}>{MOCK_EVENT.author}</Text>
              <Text style={styles.eventCardDate}>{MOCK_EVENT.date}</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.ctaBlock}>
          <Text style={styles.actionLinkText}>Скачать приложение</Text>
          <View style={styles.appCard}>
            <View style={styles.appCardIcon} />
            <View style={styles.appCardStores}>
              <Pressable style={styles.storeButton}>
                <Text style={styles.storeButtonText}>App Store</Text>
              </Pressable>
              <Pressable style={styles.storeButton}>
                <Text style={styles.storeButtonText}>Google Play</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 24 },
  backArrow: { fontSize: 24, color: '#181818', marginBottom: 24 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 32, marginBottom: 40 },
  colText: { flexBasis: 420, flexGrow: 1, minWidth: 300 },
  colImage: { flexBasis: 420, flexGrow: 1, minWidth: 280 },
  title: { fontSize: 26, lineHeight: 32, fontFamily: 'Inter-Bold', color: '#181818', marginBottom: 16 },
  subheading: { fontSize: 22, lineHeight: 28, fontFamily: 'Inter-Bold', color: '#181818', marginBottom: 16 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  authorAvatar: { width: 44, height: 44, backgroundColor: '#E5E5E5' },
  author: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#181818' },
  role: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#687076' },
  body: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818' },
  coverImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#E5E5E5' },
  galleryRow: { flexDirection: 'row', gap: 16 },
  galleryImage: { flex: 1, aspectRatio: 1, backgroundColor: '#E5E5E5' },
  ctaBlock: { marginTop: 8, marginBottom: 24 },
  actionLinkText: { fontFamily: 'Inter-Medium', fontSize: 15, color: '#E02D2D', paddingVertical: 8 },
  eventCard: { flexDirection: 'row', gap: 16, marginTop: 12, maxWidth: 480, backgroundColor: '#F5F5F5', padding: 12 },
  eventCardImage: { width: 96, height: 96, backgroundColor: '#E5E5E5' },
  eventCardInfo: { flex: 1, justifyContent: 'center' },
  eventCardTitle: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#181818', marginBottom: 6 },
  eventCardAuthor: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#687076', marginBottom: 2 },
  eventCardDate: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#687076' },
  appCard: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12, maxWidth: 480, backgroundColor: '#F5F5F5', padding: 12 },
  appCardIcon: { width: 56, height: 56, backgroundColor: '#E5E5E5' },
  appCardStores: { flexDirection: 'row', gap: 12 },
  storeButton: { borderWidth: 1, borderColor: '#181818', paddingVertical: 10, paddingHorizontal: 16 },
  storeButtonText: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#181818' },
});
