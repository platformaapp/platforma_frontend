import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell } from '@/components/web/site-shell';

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

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionLink} onPress={() => router.push('/events' as any)}>
            <Text style={styles.actionLinkText}>+ Записаться на событие</Text>
          </Pressable>
          <Pressable style={styles.actionLink}>
            <Text style={styles.actionLinkText}>Скачать приложение</Text>
          </Pressable>
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
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 32, marginTop: 8, marginBottom: 24 },
  actionLink: { paddingVertical: 8 },
  actionLinkText: { fontFamily: 'Inter-Medium', fontSize: 15, color: '#E02D2D' },
});
