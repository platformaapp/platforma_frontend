import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PromoBanner } from '@/components/web/promo-banner';
import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { ARTICLE_FORMATS, getArticles, type Article } from '@/lib/api/journal';

// "Подкасты"/"Тексты"/"Интервью" — фильтр-пилюли; значение в БД хранится в
// единственном числе (см. lib/api/journal.ts).
const FILTER_LABELS: Record<string, string> = { 'Подкаст': 'Подкасты', 'Текст': 'Тексты', 'Интервью': 'Интервью' };

// Вставляем промо-баннер после первых 2 групп карточек (см. макет — баннер
// не всегда в самом низу ленты, а после 10-й карточки).
const BANNER_AFTER = 10;

export default function JournalScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const { items } = await getArticles({ perPage: 100 });
      setArticles(items);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить журнал');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const filtered = category ? articles.filter((a) => a.category === category) : articles;

  function renderCard(item: Article, large: boolean) {
    return (
      <Pressable key={item.id} style={large ? styles.cardLarge : styles.cardSmall} onPress={() => router.push(`/journal/${item.id}` as any)}>
        {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={large ? styles.imageLarge : styles.imageSmall} resizeMode="cover" /> : null}
        <View style={styles.cardBody}>
          {item.category ? <Text style={styles.cardCategory}>{item.category}</Text> : null}
          <Text style={styles.cardTitleText} numberOfLines={3}>{item.title}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable onPress={() => setCategory(null)}>
          <Text style={styles.title}>Журнал</Text>
        </Pressable>

        <View style={styles.filtersRow}>
          {ARTICLE_FORMATS.map((f) => {
            const active = f === category;
            return (
              <Pressable key={f} onPress={() => setCategory(active ? null : f)}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{FILTER_LABELS[f] ?? f}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#010101" /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => { setLoading(true); load(); }}>
              <Text style={styles.retryButtonText}>Повторить</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centered}><Text style={styles.emptyText}>Материалов пока нет</Text></View>
        ) : isMobile ? (
          <View style={styles.mobileList}>
            {filtered.map((item) => (
              <Pressable key={item.id} style={styles.mobileRow} onPress={() => router.push(`/journal/${item.id}` as any)}>
                {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.mobileThumb} resizeMode="cover" /> : <View style={styles.mobileThumb} />}
                <View style={styles.mobileInfo}>
                  {item.category ? <Text style={styles.cardCategory}>{item.category}</Text> : null}
                  <Text style={styles.mobileTitleText} numberOfLines={3}>{item.title}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              {filtered.slice(0, BANNER_AFTER).map((item, idx) => renderCard(item, idx % 5 < 2))}
            </View>
            {filtered.length > 0 ? <PromoBanner withTelegramLink /> : null}
            {filtered.length > BANNER_AFTER ? (
              <View style={[styles.grid, styles.gridAfterBanner]}>
                {filtered.slice(BANNER_AFTER).map((item, idx) => renderCard(item, idx % 5 < 2))}
              </View>
            ) : null}
          </>
        )}

        {isMobile && !loading && !error && filtered.length > 0 ? <PromoBanner withTelegramLink /> : null}

        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 24 },
  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Bold', color: '#010101', marginBottom: 16 },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginBottom: 24 },
  filterText: { fontFamily: 'Gramatika-Regular', fontSize: 30, lineHeight: 27, color: '#838383' },
  filterTextActive: { color: '#010101', fontFamily: 'Gramatika-Bold' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 16 },
  emptyText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#687076' },
  retryButton: { borderWidth: 1, borderColor: '#010101', paddingVertical: 10, paddingHorizontal: 32 },
  retryButtonText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gridAfterBanner: { marginTop: 24 },
  cardLarge: { flexBasis: 460, flexGrow: 1, minWidth: 340 },
  cardSmall: { flexBasis: 280, flexGrow: 1, minWidth: 240 },
  imageLarge: { width: '100%', height: 260, backgroundColor: '#E5E5E5' },
  imageSmall: { width: '100%', height: 190, backgroundColor: '#E5E5E5' },
  cardBody: { paddingTop: 12 },
  cardCategory: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 6 },
  cardTitleText: { fontSize: 30, lineHeight: 27, fontFamily: 'Gramatika-Bold', color: '#010101' },

  mobileList: { gap: 20 },
  mobileRow: { flexDirection: 'row', gap: 12 },
  mobileThumb: { width: 88, height: 64, backgroundColor: '#E5E5E5' },
  mobileInfo: { flex: 1, justifyContent: 'center' },
  mobileTitleText: { fontSize: 14, lineHeight: 18, fontFamily: 'Gramatika-Bold', color: '#010101' },
});
