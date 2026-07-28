import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteShell } from '@/components/web/site-shell';
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
        <Text style={styles.title}>Наставники</Text>
        <View style={styles.filtersRow}>
          {CATEGORIES.map((c) => (
            <View key={c} style={styles.filterPill}><Text style={styles.filterPillText}>{c}</Text></View>
          ))}
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View>
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
                <Pressable key={tutor.id} style={styles.card} onPress={() => router.push(`/(tabs)/explore/${tutor.id}` as any)}>
                  <Image
                    source={tutor.avatarUrl && !tutor.avatarUrl.startsWith('blob:') ? { uri: tutor.avatarUrl } : PLACEHOLDER_AVATAR}
                    style={styles.avatar}
                  />
                  <Text style={styles.name}>{tutor.fullName}{isOwn ? ' (вы)' : ''}</Text>
                  {shortBio ? <Text style={styles.shortBio} numberOfLines={2}>{shortBio}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 48 },
  title: { fontSize: 28, lineHeight: 34, fontFamily: 'Inter-Bold', color: '#181818', marginBottom: 16 },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  filterPill: { paddingVertical: 6, paddingHorizontal: 16, borderWidth: 1, borderColor: '#181818' },
  filterPillText: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#181818' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D', textAlign: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#687076' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { flexBasis: 220, flexGrow: 1, minWidth: 200, borderWidth: 1, borderColor: '#1E1E1E', padding: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E5E5E5', marginBottom: 12 },
  name: { fontSize: 15, fontFamily: 'Inter-Medium', color: '#181818', marginBottom: 4 },
  shortBio: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#687076' },
});
