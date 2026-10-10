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

// Повторяющийся цикл из 4 строк (пара/тройка/пара/тройка, см. rows ниже) —
// пропорции колонок из референса (vladyakunin.ru): .proj-featured 649:84:716
// и вторая пара 481:165:611:193 (у второй карточки в обеих — картинка+текст
// занимают только 521/716 ≈ 72.8% своей колонки, оставляя пустое поле
// справа), .proj-row тройки 403:76:365:76:340. Размеры самих картинок (не
// только колонок сетки) даны только для первой пары — вторая пара (pairB)
// переиспользует те же пропорции картинок за неимением отдельных.
const FEATURED_ASPECT: [number, number] = [649 / 360, 521 / 294];
const ROW_ASPECTS: [number, number, number] = [403 / 285, 365 / 211, 340 / 232];
const ROW_GRID_COLUMNS: [string, string, string] = ['1', '3', '5'];
const PER_PAGE = 20;

export default function JournalScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const { items, total } = await getArticles({ page: 1, perPage: PER_PAGE });
      setArticles(items);
      setPage(1);
      setHasMore(items.length < total);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить журнал');
      setArticles([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { items, total } = await getArticles({ page: nextPage, perPage: PER_PAGE });
      setArticles((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        return [...prev, ...items.filter((a) => !seen.has(a.id))];
      });
      setPage(nextPage);
      setHasMore(nextPage * PER_PAGE < total);
    } catch {
      // Оставляем hasMore как есть — пользователь может нажать "Показать ещё" снова.
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page]);

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
          <Text style={[styles.cardTitleText, isSecond ? styles.featuredTitleTwo : styles.featuredTitleOne]}>{item.title}</Text>
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
        <Text style={[styles.cardTitleText, styles.rowTitle]}>{item.title}</Text>
      </Pressable>
    );
  }

  // Полная сетка — не "featured-пара один раз + тройки до конца", а
  // повторяющийся цикл из 4 строк (видно на vladyakunin.ru при скролле):
  // 1) пара 649:84:716 ("pairA", она же бывший featured), 2) тройка
  // 403:75:365:76:340:191, 3) пара 481:165:611:193 ("pairB"), 4) снова
  // тройка — и цикл начинается заново с 1). Баннер — после каждой 3-й
  // строки этого цикла (считая строки любого типа подряд), поэтому его
  // позиция относительно типа строки каждый раз разная (НОК(3,4)=12).
  const rows: { type: 'pairA' | 'triple' | 'pairB'; items: Article[] }[] = [];
  {
    const cycle: ('pairA' | 'triple' | 'pairB')[] = ['pairA', 'triple', 'pairB', 'triple'];
    let i = 0;
    let cycleIdx = 0;
    while (i < filtered.length) {
      const type = cycle[cycleIdx % cycle.length];
      const count = type === 'triple' ? 3 : 2;
      const items = filtered.slice(i, i + count);
      if (items.length === 0) break;
      rows.push({ type, items });
      i += items.length;
      cycleIdx++;
    }
  }

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
                  <Text style={styles.mobileTitleText}>{item.title}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View>
            {rows.map((row, rowIdx) => {
              // Отступ сверху — единая чередующаяся последовательность для
              // ВСЕХ строк подряд (не только троек): первая строка — 80
              // (отступ от фильтров), дальше 254/120/254/120...
              const marginTop = rowIdx === 0 ? 80 : rowIdx % 2 === 1 ? 254 : 120;
              const rowEl = row.type === 'triple' ? (
                <View style={[styles.rowThree, { marginTop }]}>
                  {row.items.map((item, pos) => renderRowCard(item, pos as 0 | 1 | 2))}
                </View>
              ) : (
                <View style={[row.type === 'pairA' ? styles.featuredRow : styles.pairBRow, { marginTop }]}>
                  {renderFeaturedCard(row.items[0], 0)}
                  {row.items.length > 1 ? <View /> : null}
                  {row.items.length > 1 ? renderFeaturedCard(row.items[1], 1) : null}
                </View>
              );
              return (
                <React.Fragment key={row.items.map((r) => r.id).join('-')}>
                  {rowEl}
                  {(rowIdx + 1) % 3 === 0 ? (
                    // Баннер после каждой 3-й строки (любого типа) — должен
                    // заканчиваться там же, где и карточки в тройке (rowThree
                    // резервирует справа пустую 6-ю колонку 191fr, куда
                    // карточки-тройки не заходят) — тот же grid, растягиваем
                    // баннер на колонки 1..5, не на всю ширину.
                    <View style={styles.rowThree}>
                      <View style={styles.promoBannerCell}>
                        <PromoBanner withTelegramLink />
                      </View>
                    </View>
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>
        )}

        {!isMobile && !loading && !error && filtered.length > 0 && rows.length % 3 !== 0 ? <PromoBanner withTelegramLink /> : null}
        {isMobile && !loading && !error && filtered.length > 0 ? <PromoBanner withTelegramLink /> : null}

        {!loading && !error && hasMore ? (
          <Pressable style={styles.loadMoreButton} onPress={loadMore} disabled={loadingMore}>
            {loadingMore ? <ActivityIndicator color="#010101" /> : <Text style={styles.loadMoreButtonText}>Показать ещё</Text>}
          </Pressable>
        ) : null}
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
  loadMoreButton: { alignSelf: 'center', borderWidth: 1, borderColor: '#010101', paddingVertical: 12, paddingHorizontal: 40, marginTop: 24 },
  loadMoreButtonText: { fontSize: 14, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },

  cardCategory: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#687076' },
  cardTitleText: { fontSize: 30, lineHeight: 27, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },

  // Полный повторяющийся цикл строк (см. rows/cycle выше): пара A — CSS grid
  // 649fr:84fr:716fr, пара B — 481fr:165fr:611fr:193fr (у обеих — пустая
  // колонка-спейсер после первой карточки, и у второй карточки картинка+текст
  // занимают только 72.8% её колонки). Тройка — CSS grid
  // 403fr:75fr:365fr:76fr:340fr:191fr, карточки в колонках 1/3/5 (см.
  // ROW_GRID_COLUMNS). Отступ сверху всех строк подряд — 80 (первая), затем
  // 254/120/254/120... (см. marginTop в рендере).
  featuredRow: { display: 'grid', gridTemplateColumns: '649fr 84fr 716fr' } as any,
  pairBRow: { display: 'grid', gridTemplateColumns: '481fr 165fr 611fr 193fr' } as any,
  featuredCardOne: { width: '100%' },
  featuredCardTwo: { width: '100%' },
  featuredInnerTwo: { width: '72.8%' },
  featuredImage: { width: '100%', backgroundColor: '#E5E5E5' },
  featuredLabelOne: { marginTop: 20 },
  featuredLabelTwo: { marginTop: 23 },
  featuredTitleOne: { marginTop: 13 },
  featuredTitleTwo: { marginTop: 15, lineHeight: 25 },

  rowThree: { display: 'grid', gridTemplateColumns: '403fr 75fr 365fr 76fr 340fr 191fr' } as any,
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
