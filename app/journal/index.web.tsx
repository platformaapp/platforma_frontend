import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

// Та же сетка карточек, что и на /events (featured-пара сверху + тройки
// ниже) — идентичные пропорции колонок из референса (vladyakunin.ru):
// .proj-featured 649:84:716 (у второй карточки картинка+текст — только
// 521 из 716, оставляя пустое поле справа), .proj-row тройки 403:76:365:76:340.
const FEATURED_ASPECT: [number, number] = [649 / 360, 521 / 294];
const ROW_ASPECTS: [number, number, number] = [403 / 285, 365 / 211, 340 / 232];
const ROW_GRID_COLUMNS: [string, string, string] = ['1', '3', '5'];

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

  function renderFeaturedCard(item: Article, index: 0 | 1) {
    const isSecond = index === 1;
    return (
      <Pressable
        key={item.id}
        style={isSecond ? styles.featuredCardTwo : styles.featuredCardOne}
        onPress={() => router.push(`/journal/${item.id}` as any)}
      >
        <View style={isSecond ? styles.featuredInnerTwo : undefined}>
          {item.coverUrl ? (
            <Image source={{ uri: item.coverUrl }} style={[styles.featuredImage, { aspectRatio: FEATURED_ASPECT[index] }]} resizeMode="cover" />
          ) : (
            <View style={[styles.featuredImage, { aspectRatio: FEATURED_ASPECT[index] }]} />
          )}
          {item.category ? (
            <Text style={[styles.cardCategory, isSecond ? styles.featuredLabelTwo : styles.featuredLabelOne]}>{item.category}</Text>
          ) : null}
          <Text style={[styles.cardTitleText, isSecond ? styles.featuredTitleTwo : styles.featuredTitleOne]} numberOfLines={3}>{item.title}</Text>
        </View>
      </Pressable>
    );
  }

  function renderRowCard(item: Article, posInRow: 0 | 1 | 2) {
    return (
      <Pressable key={item.id} style={{ gridColumn: ROW_GRID_COLUMNS[posInRow] } as any} onPress={() => router.push(`/journal/${item.id}` as any)}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={[styles.rowImage, { aspectRatio: ROW_ASPECTS[posInRow] }]} resizeMode="cover" />
        ) : (
          <View style={[styles.rowImage, { aspectRatio: ROW_ASPECTS[posInRow] }]} />
        )}
        {item.category ? <Text style={[styles.cardCategory, styles.rowLabel]}>{item.category}</Text> : null}
        <Text style={[styles.cardTitleText, styles.rowTitle]} numberOfLines={3}>{item.title}</Text>
      </Pressable>
    );
  }

  const featured = filtered.slice(0, 2);
  const rest = filtered.slice(2);
  const rowChunks: Article[][] = [];
  for (let i = 0; i < rest.length; i += 3) rowChunks.push(rest.slice(i, i + 3));

  // Ищем первую тройку, после которой набирается BANNER_AFTER карточек —
  // туда и вставляем баннер (если материалов меньше — баннер уходит в конец).
  let cumulative = featured.length;
  let bannerRowIndex = rowChunks.length;
  for (let i = 0; i < rowChunks.length; i++) {
    cumulative += rowChunks[i].length;
    if (cumulative >= BANNER_AFTER) { bannerRowIndex = i + 1; break; }
  }
  const rowsBeforeBanner = rowChunks.slice(0, bannerRowIndex);
  const rowsAfterBanner = rowChunks.slice(bannerRowIndex);

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageContent}>
        <Pressable onPress={() => setCategory(null)}>
          <Text style={[styles.title, isMobile && styles.titleMobile]}>Журнал</Text>
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
          <View>
            {featured.length > 0 ? (
              <View style={styles.featuredRow}>
                {renderFeaturedCard(featured[0], 0)}
                {featured.length > 1 ? <View /> : null}
                {featured.length > 1 ? renderFeaturedCard(featured[1], 1) : null}
              </View>
            ) : null}
            {rowsBeforeBanner.map((row, rowIdx) => (
              <View key={row.map((r) => r.id).join('-')} style={[styles.rowThree, rowIdx % 2 === 0 ? styles.rowThree254 : styles.rowThree120]}>
                {row.map((item, pos) => renderRowCard(item, pos as 0 | 1 | 2))}
              </View>
            ))}
            {filtered.length > 0 ? (
              // Баннер должен заканчиваться там же, где и карточки в тройке
              // (rowThree резервирует справа пустую 6-ю колонку 191fr, куда
              // карточки-тройки не заходят) — тот же grid, растягиваем
              // баннер на колонки 1..5, не на всю ширину.
              <View style={styles.rowThree}>
                <View style={styles.promoBannerCell}>
                  <PromoBanner withTelegramLink />
                </View>
              </View>
            ) : null}
            {rowsAfterBanner.map((row, localIdx) => {
              const rowIdx = bannerRowIndex + localIdx;
              return (
                <View key={row.map((r) => r.id).join('-')} style={[styles.rowThree, rowIdx % 2 === 0 ? styles.rowThree254 : styles.rowThree120]}>
                  {row.map((item, pos) => renderRowCard(item, pos as 0 | 1 | 2))}
                </View>
              );
            })}
          </View>
        )}

        {isMobile && !loading && !error && filtered.length > 0 ? <PromoBanner withTelegramLink /> : null}
      </View>

        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 24, paddingBottom: 24 },
  pageContent: { paddingHorizontal: 32 },
  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 0, marginTop: 62 },
  titleMobile: { fontSize: 25, lineHeight: 28 },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginBottom: 0, marginTop: 68 },
  filterText: { fontFamily: 'Gramatika-Regular', fontSize: 30, lineHeight: 27, color: '#838383' },
  filterTextActive: { color: '#010101', fontFamily: 'Gramatika-Regular', fontWeight: 'normal' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 16 },
  emptyText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#687076' },
  retryButton: { borderWidth: 1, borderColor: '#010101', paddingVertical: 10, paddingHorizontal: 32 },
  retryButtonText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101' },

  cardCategory: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#687076' },
  cardTitleText: { fontSize: 30, lineHeight: 27, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },

  // Та же сетка, что на /events: featured-пара — CSS grid 649fr:84fr:716fr
  // (средняя колонка — пустой спейсер), у второй карточки картинка+текст
  // занимают только 72.8% её колонки. Дальше тройки — CSS grid
  // 403fr:75fr:365fr:76fr:340fr:191fr, карточки в колонках 1/3/5
  // (см. ROW_GRID_COLUMNS), отступ сверху чередуется: 254/120.
  featuredRow: { display: 'grid', gridTemplateColumns: '649fr 84fr 716fr', marginTop: 80 } as any,
  featuredCardOne: { width: '100%' },
  featuredCardTwo: { width: '100%' },
  featuredInnerTwo: { width: '72.8%' },
  featuredImage: { width: '100%', backgroundColor: '#E5E5E5' },
  featuredLabelOne: { marginTop: 20 },
  featuredLabelTwo: { marginTop: 23 },
  featuredTitleOne: { marginTop: 13 },
  featuredTitleTwo: { marginTop: 15, lineHeight: 25 },

  rowThree: { display: 'grid', gridTemplateColumns: '403fr 75fr 365fr 76fr 340fr 191fr' } as any,
  rowThree254: { marginTop: 254 },
  rowThree120: { marginTop: 120 },
  // Баннер — только колонки 1..5 той же сетки (не заезжает в пустую 6-ю),
  // чтобы его правый край совпадал с правым краем карточек в тройке.
  promoBannerCell: { gridColumn: '1 / 6' } as any,
  rowImage: { width: '100%', backgroundColor: '#E5E5E5' },
  rowLabel: { marginTop: 18 },
  rowTitle: { marginTop: 12 },

  mobileList: { gap: 20 },
  mobileRow: { flexDirection: 'row', gap: 12 },
  mobileThumb: { width: 88, height: 64, backgroundColor: '#E5E5E5' },
  mobileInfo: { flex: 1, justifyContent: 'center' },
  mobileTitleText: { fontSize: 14, lineHeight: 18, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
});
