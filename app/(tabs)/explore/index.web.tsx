import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
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

export default function MentorsScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();
  const [tutors, setTutors] = useState<PublicTutor[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageContent}>
        <Text style={[styles.title, isMobile && styles.titleMobile]}>Наставники</Text>

        {isMobile ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersRowMobile}>
            {CATEGORIES.map((c) => <Text key={c} style={styles.filterPillText}>{c}</Text>)}
          </ScrollView>
        ) : (
          <View style={styles.filtersRow}>
            {CATEGORIES.map((c) => <Text key={c} style={styles.filterPillText}>{c}</Text>)}
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
                  <Image
                    source={tutor.avatarUrl && !tutor.avatarUrl.startsWith('blob:') ? { uri: tutor.avatarUrl } : PLACEHOLDER_AVATAR}
                    style={styles.avatar}
                    resizeMode="cover"
                  />
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
  // Пильки — просто текст без рамки/фона (см. референс), не интерактивны.
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 32, rowGap: 12, marginBottom: 32 },
  filtersScroll: { marginBottom: 32 },
  filtersRowMobile: { flexDirection: 'row', gap: 20, paddingRight: 16 },
  filterPillText: { fontFamily: 'Gramatika-Regular', fontSize: 18, color: '#010101' },
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
  cardMobile: { flexBasis: '46%' },
  avatar: { width: '100%', aspectRatio: 0.83, backgroundColor: '#E5E5E5', marginBottom: 14 },
  name: { fontSize: 22, lineHeight: 25, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#010101' },
  shortBio: { fontSize: 13, lineHeight: 17, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 6 },
});
