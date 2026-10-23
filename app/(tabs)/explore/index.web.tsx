import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { TOPICS } from '@/constants/topics';
import { useSiteSettings } from '@/hooks/use-site-settings';
import { getPublicTutorList, getPublicTutors, type PublicTutor } from '@/lib/api/tutor';
import { getAuthRole, getUserProfile } from '@/lib/auth';

const PLACEHOLDER_AVATAR = require('@/assets/images/avatar.png');

// Последняя пилька рубрикатора — отдельно и прижата вправо (по логотипу в
// шапке), как "Обсуждение" на /events (см. filterPillRight).
const LAST_TOPIC_RIGHT_ALIGNED = 'Новые увлечения';

/**
 * Высота фото у карточки — не унифицированный кроп и не реальная пропорция
 * самого фото (та у наставников почти всегда ~квадратная, разницы не видно),
 * а заданный по позиции в сетке паттерн — ровно как на референсе (карточки
 * 410/340/341/358 в первом ряду, 358/341/410/340 — во втором, значения даны
 * пользователем при базовой ширине карточки 340). Ratio = height/width.
 * Чётные и нечётные ряды (по 4 колонки на десктопе, по 2 на мобильном)
 * используют разный порядок, паттерн просто повторяется построчно.
 */
const AVATAR_HEIGHT_RATIO_ROWS: number[][] = [
  [410 / 340, 340 / 340, 341 / 340, 358 / 340],
  [358 / 340, 341 / 340, 410 / 340, 340 / 340],
];
function avatarHeightRatio(index: number, columns: number): number {
  const row = Math.floor(index / columns) % 2;
  const col = index % columns % AVATAR_HEIGHT_RATIO_ROWS[row].length;
  return AVATAR_HEIGHT_RATIO_ROWS[row][col];
}

// Вынесена в отдельный компонент просто для читаемости (была инлайн в .map).
// Чб/цветной переключается настоящим CSS ":hover" (см. [data-mentor-avatar]
// в app/+html.tsx), а не React-состоянием: react-native-web не пробрасывает
// произвольные CSS-свойства вроде "filter" через style — отбрасывает их
// молча (проверено — атрибут dataSet пробрасывается, а style.filter нет),
// и у него в принципе нет ":hover" на уровне StyleSheet. CSS-хover заодно
// бесплатно не трогает тач-устройства — там filter остаётся chb всегда.
function TutorCard({
  tutor, isOwn, ratio, isMobile, onPress,
}: {
  tutor: PublicTutor; isOwn: boolean; ratio: number; isMobile: boolean; onPress: () => void;
}) {
  const shortBio = tutor.shortBio ?? tutor.short_bio ?? '';
  return (
    <Pressable style={[styles.card, isMobile && styles.cardMobile]} onPress={onPress}>
      <View style={[styles.avatarBox, { paddingBottom: `${ratio * 100}%` }]}>
        <Image
          source={tutor.avatarUrl && !tutor.avatarUrl.startsWith('blob:') ? { uri: tutor.avatarUrl } : PLACEHOLDER_AVATAR}
          style={styles.avatar}
          resizeMode="cover"
          {...({ dataSet: { mentorAvatar: 'true' } } as any)}
        />
      </View>
      {shortBio ? <Text style={styles.shortBio} numberOfLines={2}>{shortBio}</Text> : null}
      <Text style={styles.name}>{tutor.fullName}{isOwn ? ' (вы)' : ''}</Text>
    </Pressable>
  );
}

export default function MentorsScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();
  // ?tag=... — переход по клику на хэштег на странице наставника (см.
  // TagList/onTagPress там) — список наставников с этим тегом.
  const { tag: tagParam } = useLocalSearchParams<{ tag?: string }>();
  const activeTag = typeof tagParam === 'string' ? tagParam : Array.isArray(tagParam) ? tagParam[0] : null;
  const [tutors, setTutors] = useState<PublicTutor[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Как на /events: клик подсвечивает пилюлю (активная — чёрная и жирная,
  // остальные — серые). Фильтрует по tutor.specialization (см. TOPICS).
  const [category, setCategory] = useState<string | null>(null);
  const { topics: adminTopics } = useSiteSettings();
  const topicsList = adminTopics.length > 0 ? adminTopics : TOPICS;
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [authListResult, publicListResult, profileResult, roleResult] = await Promise.allSettled([
        getPublicTutorList(),
        getPublicTutors(),
        getUserProfile(),
        getAuthRole(),
      ]);
      const authList = authListResult.status === 'fulfilled' ? authListResult.value : [];
      const publicList = publicListResult.status === 'fulfilled' ? publicListResult.value : [];
      const tutorList = (authList.length > 0 ? authList : publicList) as PublicTutor[];

      setMyId(profileResult.status === 'fulfilled' ? (profileResult.value?.id ?? null) : null);
      setMyRole(roleResult.status === 'fulfilled' ? roleResult.value : null);
      setTutors(tutorList);

      if (authListResult.status === 'rejected' && publicListResult.status === 'rejected') {
        setError('Не удалось загрузить наставников');
      }
    } catch {
      setError('Не удалось загрузить наставников');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  useEffect(() => { setPage(1); }, [activeTag]);

  const filteredTutors = tutors
    .filter((t) => !category || t.specialization === category)
    .filter((t) => !activeTag || t.tags?.includes(activeTag));

  // Пагинация — 4 строки контента на страницу. Колонок в строке разное
  // число на десктопе/мобильном (см. card/cardMobile: flexBasis 23.5%/46%,
  // т.е. 4 и 2 в ряд), поэтому и размер страницы разный.
  const COLS_DESKTOP = 4;
  const COLS_MOBILE = 2;
  const ROWS_PER_PAGE = 4;
  const pageSize = (isMobile ? COLS_MOBILE : COLS_DESKTOP) * ROWS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(filteredTutors.length / pageSize));
  // Фильтр/смена раскладки могли сделать текущую страницу несуществующей.
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageTutors = filteredTutors.slice((page - 1) * pageSize, page * pageSize);

  function selectCategory(next: string | null) {
    setCategory(next);
    setPage(1);
  }

  function clearTagFilter() {
    router.replace('/explore' as any);
    setPage(1);
  }

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={[styles.scrollContent, isMobile && styles.scrollContentMobile]}>
      <View style={[styles.pageContent, isMobile && styles.pageContentMobile]}>
        <Pressable onPress={() => selectCategory(null)}>
          <Text style={[styles.title, isMobile && styles.titleMobile]}>Наставники</Text>
        </Pressable>

        {activeTag ? (
          <Pressable style={styles.activeTagChip} onPress={clearTagFilter}>
            <Text style={styles.activeTagChipText}>#{activeTag} ✕</Text>
          </Pressable>
        ) : null}

        {isMobile ? null : (
          <View style={styles.filtersRow}>
            <View style={styles.filtersGroup}>
              {topicsList.filter((c) => c !== LAST_TOPIC_RIGHT_ALIGNED).map((c) => {
                const active = c === category;
                return (
                  <Pressable key={c} onPress={() => selectCategory(active ? null : c)}>
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.filterPillRight} onPress={() => router.push('/register-tutor' as any)}>
              <Text style={styles.filterPillText}>Стать наставником</Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#010101" /></View>
        ) : error ? (
          <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>
        ) : filteredTutors.length === 0 ? (
          <View style={styles.centered}><Text style={styles.emptyText}>Наставники не найдены</Text></View>
        ) : (
          <>
            <View style={styles.grid}>
              {pageTutors.map((tutor, index) => {
                const isOwn = tutor.id === myId && myRole === 'tutor';
                const ratio = avatarHeightRatio(index, isMobile ? COLS_MOBILE : COLS_DESKTOP);
                return (
                  <TutorCard
                    key={tutor.id}
                    tutor={tutor}
                    isOwn={isOwn}
                    ratio={ratio}
                    isMobile={isMobile}
                    onPress={() => router.push(`/(tabs)/explore/${tutor.id}` as any)}
                  />
                );
              })}
            </View>

            {totalPages > 1 ? (
              <View style={styles.pagination}>
                <Pressable
                  style={[styles.paginationArrow, page === 1 && styles.paginationArrowDisabled]}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <Text style={styles.paginationArrowText}>‹</Text>
                </Pressable>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <Pressable key={n} style={[styles.paginationPage, n === page && styles.paginationPageActive]} onPress={() => setPage(n)}>
                    <Text style={[styles.paginationPageText, n === page && styles.paginationPageTextActive]}>{n}</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.paginationArrow, page === totalPages && styles.paginationArrowDisabled]}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <Text style={styles.paginationArrowText}>›</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}

        {isMobile ? (
          <Pressable style={styles.becomeTutorButton} onPress={() => router.push('/register-tutor' as any)}>
            <Text style={styles.becomeTutorButtonText}>Стать наставником</Text>
          </Pressable>
        ) : null}
      </View>

        <SiteFooter showPartners />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 24, paddingBottom: 24 },
  scrollContentMobile: { paddingTop: 0 },
  pageContent: { paddingHorizontal: 32 },
  pageContentMobile: { paddingHorizontal: 20 },
  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 16, marginTop: 62 },
  titleMobile: { fontSize: 25, lineHeight: 28, marginBottom: 12, marginTop: 30 },
  // Пильки — стиль и поведение как на /events: просто текст без рамки/фона,
  // кликабельны, активная — чёрная и жирная, остальные — серые. Последняя
  // ("Новые увлечения") — отдельно и прижата вправо по логотипу (см.
  // filterPillRight на /events — то же значение marginRight).
  // Активный фильтр по тегу (переход по клику на #хэштег на странице
  // наставника, см. TagList/onTagPress) — чип с крестиком сбрасывает фильтр.
  activeTagChip: { alignSelf: 'flex-start', marginTop: 12 },
  activeTagChipText: { fontFamily: 'Gramatika-Regular', fontSize: 16, color: '#687076' },
  filtersRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 86, marginTop: 50 },
  filtersGroup: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 46, rowGap: 12, flexShrink: 1 },
  filterPillRight: { marginLeft: 'auto', marginRight: 0, paddingLeft: 24 },
  filterPillText: { fontFamily: 'Gramatika-Regular', fontSize: 30, lineHeight: 27, color: '#838383' },
  filterPillTextActive: { color: '#010101', fontFamily: 'Gramatika-Regular', fontWeight: 'normal' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#E02D2D', textAlign: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#687076' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: 24, rowGap: 48 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 40 },
  paginationArrow: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  paginationArrowDisabled: { opacity: 0.3 },
  paginationArrowText: { fontSize: 20, fontFamily: 'Gramatika-Regular', color: '#010101' },
  paginationPage: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  paginationPageActive: { backgroundColor: '#111' },
  paginationPageText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101' },
  paginationPageTextActive: { color: '#FAFAFA' },
  // Та же чёрная кнопка на всю ширину, что и «Создать событие» на /events
  // (мобильный список) — здесь даёт доступ к «Стать наставником», раз
  // десктопная пилюля рубрикатора на мобильном скрыта целиком.
  becomeTutorButton: { backgroundColor: '#111', alignItems: 'center', paddingVertical: 16, marginTop: 24 },
  becomeTutorButtonText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#FAFAFA' },
  // Без рамки, крупное фото на всю ширину карточки (~0.83 портретный кадр
  // вместо круглого аватара) — см. референс. Ровно 4 колонки на десктопе
  // (не auto-fit — flexGrow:1 при полной ширине CONTENT_MAX_WIDTH давал 5),
  // высота каждой карточки своя (alignItems:'flex-start' на grid — без
  // растяжения по строке), 2 колонки на мобильном.
  card: { flexBasis: '23.5%', flexGrow: 0, minWidth: 0 },
  // Мобильная карточка — 2 в ряд (не на всю ширину). 46%, не 47% — с
  // columnGap:24 и шириной экрана 390 47% давал переполнение на ~4px и
  // карточки переносились по одной в ряд вместо двух.
  cardMobile: { flexBasis: '46%' },
  // paddingBottom-в-процентах вместо aspectRatio: последний ломается для
  // "портретных" (height>width) картинок внутри column-flex контейнера —
  // aspect-ratio там игнорируется браузером и картинка схлопывается по
  // высоте (проверено: воспроизводится стабильно для этого случая, но не
  // для featuredImage на /events — там aspect-ratio >1, альбомный кадр).
  // paddingBottom % всегда считается от ширины элемента, поэтому надёжен.
  avatarBox: { width: '100%', position: 'relative', backgroundColor: '#E5E5E5', marginBottom: 14 },
  avatar: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  name: { fontSize: 22, lineHeight: 25, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
  shortBio: { fontSize: 16, lineHeight: 17, fontFamily: 'Gramatika-Regular', color: 'rgba(131, 131, 131, 1.00)', marginBottom: 6 },
});
