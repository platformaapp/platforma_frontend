import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';

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
  const isMobile = useIsMobileWeb();
  const [category, setCategory] = useState('Все');

  const filtered = category === 'Все' ? MOCK_ARTICLES : MOCK_ARTICLES.filter((a) => a.category === category);
  const [featured, ...rest] = filtered;

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

        {featured ? (
          <View style={[styles.contentRow, isMobile && styles.contentRowMobile]}>
            <Pressable
              style={[styles.featured, isMobile && styles.featuredMobile]}
              onPress={() => router.push(`/journal/${featured.id}` as any)}
            >
              <View style={styles.featuredImage} />
              <Text style={styles.featuredCategory}>{featured.category}</Text>
              <Text style={styles.featuredTitle}>{featured.title}</Text>
              <Text style={styles.featuredAuthor}>{featured.author}</Text>
            </Pressable>

            <View style={styles.listCol}>
              {rest.map((a) => (
                <Pressable key={a.id} style={styles.listItem} onPress={() => router.push(`/journal/${a.id}` as any)}>
                  <Text style={styles.listCategory}>{a.category}</Text>
                  <Text style={styles.listTitle} numberOfLines={2}>{a.title}</Text>
                  <Text style={styles.listAuthor}>{a.author}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

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
  contentRow: { flexDirection: 'row', gap: 40 },
  contentRowMobile: { flexDirection: 'column', gap: 24 },
  featured: { flex: 1.3 },
  featuredMobile: { flex: undefined },
  featuredImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#E5E5E5', marginBottom: 12 },
  featuredCategory: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#687076', marginBottom: 6 },
  featuredTitle: { fontSize: 20, lineHeight: 26, fontFamily: 'Inter-Bold', color: '#181818', marginBottom: 6 },
  featuredAuthor: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#687076' },
  listCol: { flex: 1 },
  listItem: { paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#E5E5E5' },
  listCategory: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#687076', marginBottom: 4 },
  listTitle: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#181818', marginBottom: 4 },
  listAuthor: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#687076' },
});
