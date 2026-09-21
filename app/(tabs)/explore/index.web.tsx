import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { getPublicTutorList, getPublicTutors, type PublicTutor } from '@/lib/api/tutor';
import { getAuthRole, getUserProfile } from '@/lib/auth';

const PLACEHOLDER_AVATAR = require('@/assets/images/avatar.png');

/**
 * Категории (Кино/Музыка/Искусство/...) — на макете есть, но у наставника
 * в бэкенде нет поля категории/специализации в этом виде. Пильки показаны
 * визуально, фильтрация не работает, пока бэкенд не добавит это поле.
 */
const CATEGORIES = ['Кино', 'Музыка', 'Искусство', 'Литература', 'Театр', 'Танец', 'Новые увлечения'];

/** Запасное отношение высоты к ширине фото, пока оно не загрузилось. */
const DEFAULT_AVATAR_RATIO = 1.2048;

export default function MentorsScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();
  const [tutors, setTutors] = useState<PublicTutor[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Как на /events: клик подсвечивает пилюлю (активная — чёрная и жирная,
  // остальные — серые). У наставника в бэкенде нет поля категории, поэтому
  // сам список пока не фильтруется — см. комментарий у CATEGORIES.
  const [category, setCategory] = useState<string | null>(null);
  // Высота фото у карточек — не унифицированный кроп, а естественная
  // пропорция самого фото (как на референсе: карточки в ряду разной
  // высоты). До загрузки фото используется запасное значение, после
  // загрузки — реальное отношение сторон, взятое из самой картинки.
  const [imgRatios, setImgRatios] = useState<Record<string, number>>({});

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

  // Реальная пропорция фото карточки (для разной высоты в ряду, как на
  // референсе) — берём напрямую через window.Image, а не через onLoad у
  // RN Image: у него nativeEvent.target на вебе ненадёжен (иногда null).
  useEffect(() => {
    let cancelled = false;
    tutors.forEach((tutor) => {
      if (!tutor.avatarUrl || tutor.avatarUrl.startsWith('blob:') || imgRatios[tutor.id]) return;
      const img = new (globalThis as any).Image();
      img.onload = () => {
        if (cancelled || !img.naturalWidth || !img.naturalHeight) return;
        setImgRatios((prev) => ({ ...prev, [tutor.id]: img.naturalHeight / img.naturalWidth }));
      };
      img.src = tutor.avatarUrl;
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutors]);

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageContent}>
        <Text style={[styles.title, isMobile && styles.titleMobile]}>Наставники</Text>

        {isMobile ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersRowMobile}>
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <Pressable key={c} onPress={() => setCategory(active ? null : c)}>
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{c}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.filtersRow}>
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <Pressable key={c} onPress={() => setCategory(active ? null : c)}>
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#010101" /></View>
        ) : error ? (
          <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>
        ) : tutors.length === 0 ? (
          <View style={styles.centered}><Text style={styles.emptyText}>Наставники не найдены</Text></View>
        ) : (
          <View style={styles.grid}>
            {tutors.map((tutor) => {
              const isOwn = tutor.id === myId && myRole === 'tutor';
              const shortBio = tutor.shortBio ?? tutor.short_bio ?? '';
              return (
                <Pressable
                  key={tutor.id}
                  style={[styles.card, isMobile && styles.cardMobile]}
                  onPress={() => router.push(`/(tabs)/explore/${tutor.id}` as any)}
                >
                  <View style={[styles.avatarBox, { paddingBottom: `${(imgRatios[tutor.id] ?? DEFAULT_AVATAR_RATIO) * 100}%` }]}>
                    <Image
                      source={tutor.avatarUrl && !tutor.avatarUrl.startsWith('blob:') ? { uri: tutor.avatarUrl } : PLACEHOLDER_AVATAR}
                      style={styles.avatar}
                      resizeMode="cover"
                    />
                  </View>
                  {shortBio ? <Text style={styles.shortBio} numberOfLines={2}>{shortBio}</Text> : null}
                  <Text style={styles.name}>{tutor.fullName}{isOwn ? ' (вы)' : ''}</Text>
                </Pressable>
              );
            })}
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
  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101', marginBottom: 16 },
  titleMobile: { fontSize: 22, lineHeight: 28, marginBottom: 12 },
  // Пильки — стиль и поведение как на /events: просто текст без рамки/фона,
  // кликабельны, активная — чёрная и жирная, остальные — серые.
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 32, rowGap: 12, marginBottom: 32 },
  filtersScroll: { marginBottom: 32 },
  filtersRowMobile: { flexDirection: 'row', gap: 20, paddingRight: 16 },
  filterPillText: { fontFamily: 'Gramatika-Regular', fontSize: 30, lineHeight: 27, color: '#838383' },
  filterPillTextActive: { color: '#010101', fontFamily: 'Gramatika-Regular', fontWeight: 'bold' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#E02D2D', textAlign: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#687076' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: 24, rowGap: 48 },
  // Без рамки, крупное фото на всю ширину карточки (~0.83 портретный кадр
  // вместо круглого аватара) — см. референс. Ровно 4 колонки на десктопе
  // (не auto-fit — flexGrow:1 при полной ширине CONTENT_MAX_WIDTH давал 5),
  // высота каждой карточки своя (alignItems:'flex-start' на grid — без
  // растяжения по строке), 2 колонки на мобильном.
  card: { flexBasis: '23.5%', flexGrow: 0, minWidth: 0 },
  // Мобильная карточка — на всю ширину экрана (одна колонка), не 2×2.
  cardMobile: { flexBasis: '100%' },
  // paddingBottom-в-процентах вместо aspectRatio: последний ломается для
  // "портретных" (height>width) картинок внутри column-flex контейнера —
  // aspect-ratio там игнорируется браузером и картинка схлопывается по
  // высоте (проверено: воспроизводится стабильно для этого случая, но не
  // для featuredImage на /events — там aspect-ratio >1, альбомный кадр).
  // paddingBottom % всегда считается от ширины элемента, поэтому надёжен.
  // Само значение paddingBottom задаётся динамически (см. imgRatios) —
  // по реальной пропорции загруженного фото, поэтому карточки в ряду
  // осознанно разной высоты, как на референсе.
  avatarBox: { width: '100%', position: 'relative', backgroundColor: '#E5E5E5', marginBottom: 14 },
  avatar: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  name: { fontSize: 22, lineHeight: 25, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101' },
  shortBio: { fontSize: 13, lineHeight: 17, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 6 },
});
