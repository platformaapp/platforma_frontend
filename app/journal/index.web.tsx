import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PromoBanner } from '@/components/web/promo-banner';
import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { ARTICLE_FORMATS, getArticles, type Article } from '@/lib/api/journal';

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

// Колонки тройки (rowThree) — те же 6 чисел, что и в её gridTemplateColumns
// ниже, но тут как массив, чтобы точно (не на глаз) посчитать, на сколько
// процентов от общей ширины строки нужно сдвинуть правый фильтр-пилюлю
// влево, чтобы её правый край совпал с правым краем карточек в тройке —
// пустая 6-я колонка (191) и есть этот отступ. filtersRow и обёртка тройки —
// оба прямые дети pageContent с одинаковой доступной шириной, поэтому
// процент совпадёт пиксель в пиксель, а не приблизительно.
const ROW_THREE_COLUMNS = [403, 75, 365, 76, 340, 191];
const ROW_THREE_TOTAL = ROW_THREE_COLUMNS.reduce((sum, n) => sum + n, 0);
const ROW_THREE_RIGHT_INSET = `${((ROW_THREE_COLUMNS[5] / ROW_THREE_TOTAL) * 100).toFixed(4)}%`;

// Пагинация — 5 строк контента на страницу (см. ROWS_PER_PAGE ниже). Вместо
// подгрузки с бэкенда по мере скролла (как было — "Показать ещё") теперь
// просто берём разом весь журнал одним запросом и листаем уже загруженный
// список постранично на клиенте — проще и не завязано на то, как бэкендная
// страница (per_page) соотносится со "строками" вёрстки (пара/тройка/пара).
const ARTICLES_FETCH_LIMIT = 200;
const ROWS_PER_PAGE = 5;

export default function JournalScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();
  // ?tag=... — переход по клику на хэштег (см. TagList/onTagPress на
  // странице статьи) — список статей с этим тегом, см. filtered ниже.
  const { tag: tagParam } = useLocalSearchParams<{ tag?: string }>();
  const activeTag = typeof tagParam === 'string' ? tagParam : Array.isArray(tagParam) ? tagParam[0] : null;
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      setError('');
      const { items } = await getArticles({ page: 1, perPage: ARTICLES_FETCH_LIMIT });
      setArticles(items);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить журнал');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  // При переходе по хэштегу рубрики скрыты (см. filtersRow ниже) — сбрасываем
  // ранее выбранную рубрику, иначе она молча продолжит фильтровать список,
  // а сбросить её способа не будет видно (пилюли не отрисованы).
  useEffect(() => { setPage(1); setCategory(null); }, [activeTag]);

  const filtered = articles
    .filter((a) => !category || a.category === category)
    .filter((a) => !activeTag || a.tags.includes(activeTag));

  function selectCategory(next: string | null) {
    setCategory(next);
    setPage(1);
  }

  function clearTagFilter() {
    router.replace('/journal' as any);
    setPage(1);
  }

  // variant: 'A' — первая пара цикла (pairA), 'B' — третья строка цикла
  // (pairB) — у неё свои классы, не переиспользует стили pairA (см.
  // featuredCardOneB/featuredCardTwoB/featuredInnerTwoB и т.д. ниже):
  // второй блок pairA — 72.8% ширины колонки, второй блок pairB — 100%.
  function renderFeaturedCard(item: Article, index: 0 | 1, variant: 'A' | 'B') {
    const isSecond = index === 1;
    const cardStyle = variant === 'B'
      ? (isSecond ? styles.featuredCardTwoB : styles.featuredCardOneB)
      : (isSecond ? styles.featuredCardTwo : styles.featuredCardOne);
    const innerStyle = isSecond
      ? (variant === 'B' ? styles.featuredInnerTwoB : styles.featuredInnerTwo)
      : undefined;
    const labelStyle = variant === 'B'
      ? (isSecond ? styles.featuredLabelTwoB : styles.featuredLabelOneB)
      : (isSecond ? styles.featuredLabelTwo : styles.featuredLabelOne);
    const titleStyle = variant === 'B'
      ? (isSecond ? styles.featuredTitleTwoB : styles.featuredTitleOneB)
      : (isSecond ? styles.featuredTitleTwo : styles.featuredTitleOne);
    return (
      <Pressable
        key={item.id}
        style={cardStyle}
        onPress={() => router.push(`/journal/${item.slug || item.id}` as any)}
      >
        <View style={innerStyle}>
          {item.coverUrl ? (
            <Image source={{ uri: item.coverUrl }} style={[styles.featuredImage, { aspectRatio: FEATURED_ASPECT[index] }]} resizeMode="cover" />
          ) : (
            <View style={[styles.featuredImage, { aspectRatio: FEATURED_ASPECT[index] }]} />
          )}
          {item.category ? (
            <Text style={[styles.cardCategory, labelStyle]}>{item.category}</Text>
          ) : null}
          <Text style={[styles.cardTitleText, titleStyle]}>{item.title}</Text>
        </View>
      </Pressable>
    );
  }

  function renderRowCard(item: Article, posInRow: 0 | 1 | 2) {
    return (
      <Pressable key={item.id} style={{ gridColumn: ROW_GRID_COLUMNS[posInRow] } as any} onPress={() => router.push(`/journal/${item.slug || item.id}` as any)}>
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

  // Пагинация: на десктопе страница — ROWS_PER_PAGE строк сетки (rows), на
  // мобильном (1 карточка = 1 "строка" в mobileList) — то же число карточек.
  const totalUnits = isMobile ? filtered.length : rows.length;
  const totalPages = Math.max(1, Math.ceil(totalUnits / ROWS_PER_PAGE));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const rowOffset = (page - 1) * ROWS_PER_PAGE;
  const pageRows = isMobile ? [] : rows.slice(rowOffset, rowOffset + ROWS_PER_PAGE);
  const pageMobileItems = isMobile ? filtered.slice(rowOffset, rowOffset + ROWS_PER_PAGE) : [];

  const paginationEl = totalPages > 1 ? (
    <View style={styles.pagination}>
      <Pressable style={[styles.paginationArrow, page === 1 && styles.paginationArrowDisabled]} onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
        <Text style={styles.paginationArrowText}>‹</Text>
      </Pressable>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <Pressable key={n} style={[styles.paginationPage, n === page && styles.paginationPageActive]} onPress={() => setPage(n)}>
          <Text style={[styles.paginationPageText, n === page && styles.paginationPageTextActive]}>{n}</Text>
        </Pressable>
      ))}
      <Pressable style={[styles.paginationArrow, page === totalPages && styles.paginationArrowDisabled]} onPress={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
        <Text style={styles.paginationArrowText}>›</Text>
      </Pressable>
    </View>
  ) : null;

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={[styles.pageContent, isMobile && styles.pageContentMobile]}>
        <Pressable onPress={() => selectCategory(null)}>
          <Text style={[styles.title, isMobile && styles.titleMobile]}>Журнал</Text>
        </Pressable>

        {activeTag && isMobile ? (
          <Pressable style={styles.activeTagChip} onPress={clearTagFilter}>
            <Text style={styles.activeTagChipText}>#{activeTag} ✕</Text>
          </Pressable>
        ) : null}

        {!isMobile ? (
          <View style={styles.filtersRow}>
            <View style={styles.filtersGroup}>
              {activeTag ? (
                // Переход по хэштегу со страницы статьи (TagList/onTagPress) —
                // вместо пилюль рубрик (Обсудить/Посмотреть/Посетить) здесь
                // сам хэштег, тем же стилем, что и выбранная рубрика; клик
                // сбрасывает фильтр и возвращает обычный журнал с рубриками.
                <Pressable onPress={clearTagFilter}>
                  <Text style={[styles.filterText, styles.filterTextActive]}>#{activeTag} ✕</Text>
                </Pressable>
              ) : (
                ARTICLE_FORMATS.map((f) => {
                  const active = f === category;
                  return (
                    <Pressable key={f} onPress={() => selectCategory(active ? null : f)}>
                      <Text style={[styles.filterText, active && styles.filterTextActive]}>{f}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>
            <Pressable style={styles.filterPillRight} onPress={() => router.push('/register-tutor' as any)}>
              <Text style={styles.filterText}>Написать текст</Text>
            </Pressable>
          </View>
        ) : null}

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
            {pageMobileItems.map((item) => (
              <Pressable key={item.id} style={styles.mobileRow} onPress={() => router.push(`/journal/${item.slug || item.id}` as any)}>
                {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.mobileThumb} resizeMode="cover" /> : <View style={styles.mobileThumb} />}
                <View style={styles.mobileInfo}>
                  {item.category ? <Text style={styles.mobileCategory}>{item.category}</Text> : null}
                  <Text style={styles.mobileTitleText}>{item.title}</Text>
                </View>
              </Pressable>
            ))}
            <Pressable style={styles.writeTextButton} onPress={() => router.push('/register-tutor' as any)}>
              <Text style={styles.writeTextButtonText}>Написать текст</Text>
            </Pressable>
            {paginationEl}
          </View>
        ) : (
          <View>
            {pageRows.map((row, idxInPage) => {
              const rowIdx = rowOffset + idxInPage;
              // Отступ сверху — одинаковый для ВСЕХ строк подряд (не только
              // троек): первая строка — 80 (отступ от фильтров), дальше 120
              // между каждой следующей парой строк.
              // idxInPage === 0, не rowIdx === 0 — первая строка должна быть
              // с отступом 80 на КАЖДОЙ странице (как на первой), а не только
              // когда это первая строка всего списка.
              const marginTop = idxInPage === 0 ? 80 : 120;
              const rowEl = row.type === 'triple' ? (
                <View style={[styles.rowThree, { marginTop }]}>
                  {row.items.map((item, pos) => renderRowCard(item, pos as 0 | 1 | 2))}
                </View>
              ) : (
                <View style={[row.type === 'pairA' ? styles.featuredRow : styles.pairBRow, { marginTop }]}>
                  {renderFeaturedCard(row.items[0], 0, row.type === 'pairB' ? 'B' : 'A')}
                  {row.items.length > 1 ? <View /> : null}
                  {row.items.length > 1 ? renderFeaturedCard(row.items[1], 1, row.type === 'pairB' ? 'B' : 'A') : null}
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
                        <PromoBanner />
                      </View>
                    </View>
                  ) : null}
                </React.Fragment>
              );
            })}
            {paginationEl}
          </View>
        )}
      </View>

        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 24, paddingBottom: 24 },
  pageContent: { paddingHorizontal: 32 },
  pageContentMobile: { paddingHorizontal: 20 },
  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 0, marginTop: 62 },
  titleMobile: { fontSize: 25, lineHeight: 28 },
  // Активный фильтр по тегу (переход по клику на #хэштег на странице
  // статьи, см. TagList/onTagPress) — чип с крестиком сбрасывает фильтр.
  activeTagChip: { alignSelf: 'flex-start', marginTop: 12 },
  activeTagChipText: { fontFamily: 'Gramatika-Regular', fontSize: 16, color: '#687076' },
  filtersRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0, marginTop: 68 },
  filtersGroup: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 46, rowGap: 12, flexShrink: 1 },
  // ROW_THREE_RIGHT_INSET — точный процент (не на глаз), см. его расчёт выше.
  // as any: RN типизирует marginRight как ограниченный набор строк вида
  // `${number}%`, а не произвольный string — тот же приём, что и у grid-стилей
  // в этом файле (gridTemplateColumns и т.п.), иначе ошибка каскадом ломает
  // типизацию всего объекта StyleSheet.create().
  filterPillRight: { marginLeft: 'auto', marginRight: ROW_THREE_RIGHT_INSET, paddingLeft: 24 } as any,
  filterText: { fontFamily: 'Gramatika-Regular', fontSize: 30, lineHeight: 27, color: '#838383' },
  filterTextActive: { color: '#010101', fontFamily: 'Gramatika-Regular', fontWeight: 'normal' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 16 },
  emptyText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#687076' },
  retryButton: { borderWidth: 1, borderColor: '#010101', paddingVertical: 10, paddingHorizontal: 32 },
  retryButtonText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 40 },
  paginationArrow: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  paginationArrowDisabled: { opacity: 0.3 },
  paginationArrowText: { fontSize: 20, fontFamily: 'Gramatika-Regular', color: '#010101' },
  paginationPage: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  paginationPageActive: { backgroundColor: '#111' },
  paginationPageText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101' },
  paginationPageTextActive: { color: '#FAFAFA' },

  cardCategory: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#687076', lineHeight: 18 },
  cardTitleText: { fontSize: 25, lineHeight: 25, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },

  // Полный повторяющийся цикл строк (см. rows/cycle выше): пара A — CSS grid
  // 649fr:84fr:716fr, пара B — 481fr:165fr:611fr:193fr (у обеих — пустая
  // колонка-спейсер после первой карточки, и у второй карточки картинка+текст
  // занимают только 72.8% её колонки). Тройка — CSS grid
  // 403fr:75fr:365fr:76fr:340fr:191fr, карточки в колонках 1/3/5 (см.
  // ROW_GRID_COLUMNS). Отступ сверху всех строк подряд — 80 (первая), затем
  // 254/120/254/120... (см. marginTop в рендере).
  featuredRow: { display: 'grid', gridTemplateColumns: '649fr 84fr 716fr' } as any,
  pairBRow: { display: 'grid', gridTemplateColumns: '481fr 165fr 611fr 193fr' } as any,
  // pairA (строка 1).
  featuredCardOne: { width: '100%' },
  featuredCardTwo: { width: '100%' },
  featuredInnerTwo: { width: '72.8%' },
  featuredLabelOne: { marginTop: 20 },
  featuredLabelTwo: { marginTop: 23 },
  featuredTitleOne: { marginTop: 13 },
  featuredTitleTwo: { marginTop: 15, lineHeight: 25 },
  // pairB (строка 3) — отдельные классы, не переиспользуют стили pairA:
  // второй блок строки 3 — на всю ширину колонки (100%), а не 72.8%, как
  // у второго блока строки 1.
  featuredCardOneB: { width: '100%' },
  featuredCardTwoB: { width: '100%' },
  featuredInnerTwoB: { width: '100%' },
  featuredLabelOneB: { marginTop: 20 },
  featuredLabelTwoB: { marginTop: 23 },
  featuredTitleOneB: { marginTop: 13 },
  featuredTitleTwoB: { marginTop: 15, lineHeight: 25 },
  featuredImage: { width: '100%', backgroundColor: '#E5E5E5' },

  rowThree: { display: 'grid', gridTemplateColumns: ROW_THREE_COLUMNS.map((n) => `${n}fr`).join(' ') } as any,
  // Баннер — только колонки 1..5 той же сетки (не заезжает в пустую 6-ю),
  // чтобы его правый край совпадал с правым краем карточек в тройке.
  // marginTop:120 — тот же отступ, что и между остальными строками.
  promoBannerCell: { gridColumn: '1 / 6', marginTop: 120 } as any,
  rowImage: { width: '100%', backgroundColor: '#E5E5E5' },
  rowLabel: { marginTop: 18 },
  rowTitle: { marginTop: 12 },

  // Обложка — aspect-ratio 649/360, ~45% ширины строки (как на /events и
  // как верстка на vladyakunin.ru/journal), а не маленький квадратный
  // превью-тамбнейл, как раньше.
  mobileList: { gap: 28 },
  // Та же чёрная кнопка на всю ширину, что и «Создать событие»/«Стать
  // наставником» на /events, /explore (мобильный список) — десктопная
  // пилюля рубрикатора на мобильном скрыта целиком.
  writeTextButton: { backgroundColor: '#111', alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  writeTextButtonText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#FAFAFA' },
  mobileRow: { flexDirection: 'row', gap: 14 },
  mobileThumb: { flexBasis: '45%', aspectRatio: 649 / 360, backgroundColor: '#E5E5E5' },
  mobileInfo: { flex: 1, justifyContent: 'flex-start' },
  mobileCategory: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 6 },
  mobileTitleText: { fontSize: 16, lineHeight: 19, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
});
