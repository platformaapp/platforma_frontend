import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell } from '@/components/web/site-shell';

const LOREM = 'Давно выяснено, что при оценке дизайна и композиции читаемый текст мешает сосредоточиться. Lorem Ipsum используют потому, что тот обеспечивает более или менее стандартное заполнение шаблона, а также реальное распределение букв и пробелов в абзацах, которое не получается при простой дубликации «Здесь ваш текст.. Здесь ваш текст.. Здесь ваш текст..» Многие программы электронной вёрстки и редакторы HTML используют Lorem Ipsum в качестве текста по умолчанию.';

/**
 * Мок-контент — см. журнал/index.web.tsx: бэкенду нужен эндпоинт со статьями.
 * URL-параметр id пока не используется — все статьи показывают одну и ту же
 * заглушку, реальный fetch по id подключится вместе с бэкендом.
 */
export default function ArticleScreenWeb() {
  const router = useRouter();

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Как подойти к выставкам с умом, подготовиться и взять от них максимум?</Text>
        <Text style={styles.author}>Евгений Максимов</Text>
        <Text style={styles.role}>Куратор, деятель культуры</Text>

        <Text style={styles.body}>{LOREM}</Text>
        <Text style={styles.body}>{LOREM}</Text>

        <View style={styles.actionsRow}>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/events' as any)}>
            <Text style={styles.primaryButtonText}>Записаться на событие</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Скачать приложение</Text>
          </Pressable>
        </View>

        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 24, maxWidth: 720 },
  title: { fontSize: 26, lineHeight: 32, fontFamily: 'Inter-Bold', color: '#181818', marginBottom: 16 },
  author: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#181818' },
  role: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#687076', marginBottom: 24 },
  body: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 16 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16, marginBottom: 24 },
  primaryButton: { backgroundColor: '#E02D2D', paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  primaryButtonText: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#FFFFFF' },
  secondaryButton: { borderWidth: 1, borderColor: '#181818', paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  secondaryButtonText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
});
