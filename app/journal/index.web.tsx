import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell } from '@/components/web/site-shell';

const CATEGORIES = ['Все', 'Кино', 'Музыка', 'Искусство', 'Литература', 'Театр', 'Танец', 'Новые увлечения'];

/**
 * Журнал — в бэкенде нет модели статей/контента вообще, поэтому список ниже
 * это мок-данные (повторяют плейсхолдеры из макета). Нужно бэкенду: эндпоинт
 * со статьями (title, category, author, cover, body) — как появится, заменить
 * этот массив на реальный fetch.
 */
const MOCK_ARTICLES = [
  { id: '1', category: 'Театр', author: 'Евгений Максимов', title: 'Как подойти к выставкам с умом, подготовиться и взять от них максимум?' },
  { id: '2', category: 'Танец', author: 'Евгений Максимов', title: 'Типографика без пафоса' },
  { id: '3', category: 'Театр', author: 'Евгений Максимов', title: 'Как подойти к выставкам с умом, подготовиться и взять от них максимум?' },
  { id: '4', category: 'Кино', author: 'Евгений Максимов', title: 'Типографика без пафоса' },
  { id: '5', category: 'Кино', author: 'Евгений Максимов', title: 'Как подойти к выставкам с умом, подготовиться и взять от них максимум?' },
];

export default function JournalScreenWeb() {
  const router = useRouter();
  const [category, setCategory] = useState('Все');

  const filtered = category === 'Все' ? MOCK_ARTICLES : MOCK_ARTICLES.filter((a) => a.category === category);

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Журнал</Text>
        <View style={styles.filtersRow}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} onPress={() => setCategory(c)}>
              <Text style={[styles.filterText, category === c && styles.filterTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.grid}>
          {filtered.map((a) => (
            <Pressable key={a.id} style={styles.card} onPress={() => router.push(`/journal/${a.id}` as any)}>
              <View style={styles.cardImage} />
              <Text style={styles.cardCategory}>{a.category}</Text>
              <Text style={styles.cardTitle} numberOfLines={2}>{a.title}</Text>
              <Text style={styles.cardAuthor}>{a.author}</Text>
            </Pressable>
          ))}
        </View>

        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 24 },
  title: { fontSize: 28, fontFamily: 'Inter-Bold', color: '#181818', marginBottom: 16 },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginBottom: 24 },
  filterText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#687076' },
  filterTextActive: { color: '#181818', fontFamily: 'Inter-Medium' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { flexBasis: 260, flexGrow: 1, minWidth: 220 },
  cardImage: { width: '100%', height: 160, backgroundColor: '#E5E5E5', marginBottom: 8 },
  cardCategory: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#687076', marginBottom: 4 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#181818', marginBottom: 4 },
  cardAuthor: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#687076' },
});
