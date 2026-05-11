import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPublicTutorList, getPublicTutors, type PublicTutor } from '@/lib/api/tutor';
import { getAuthRole, getUserProfile } from '@/lib/auth';

const PLACEHOLDER_AVATAR = require('@/assets/images/avatar.png');

export default function MentorsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tutors, setTutors] = useState<PublicTutor[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

      const currentId = profileResult.status === 'fulfilled' ? (profileResult.value?.id ?? null) : null;
      const currentRole = roleResult.status === 'fulfilled' ? roleResult.value : null;
      setMyId(currentId);
      setMyRole(currentRole);

      // Show all tutors including own profile
      setTutors(tutorList);

      if (authListResult.status === 'rejected' && publicListResult.status === 'rejected') {
        setError('Не удалось загрузить наставников');
      }
    } catch {
      setError('Не удалось загрузить наставников');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#181818" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={[styles.title, { paddingTop: insets.top + 16 }]}>НАСТАВНИКИ</Text>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : tutors.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Наставники не найдены</Text>
        </View>
      ) : (
        tutors.map((tutor) => {
          const isOwn = tutor.id === myId && myRole === 'tutor';
          const bio = (tutor as any).bio ?? '';
          const rate = tutor.hourlyRate ?? (tutor as any).hourly_rate ?? tutor.pricePerHour ?? null;
          const shortBio = tutor.shortBio ?? tutor.short_bio ?? '';

          return (
            <Pressable
              key={tutor.id}
              style={styles.card}
              onPress={() => router.push(`/(tabs)/explore/${tutor.id}` as any)}
            >
              {/* Header: avatar + name + shortBio */}
              <View style={styles.cardHeader}>
                <Image
                  source={tutor.avatarUrl && !tutor.avatarUrl.startsWith('blob:') ? { uri: tutor.avatarUrl } : PLACEHOLDER_AVATAR}
                  style={styles.avatar}
                />
                <View style={styles.headerText}>
                  <Text style={styles.name}>{tutor.fullName}</Text>
                  {shortBio ? (
                    <Text style={styles.shortBio} numberOfLines={2}>{shortBio}</Text>
                  ) : null}
                </View>
              </View>

              {/* Bio: long description, max 6 lines */}
              {bio ? (
                <View style={styles.bioSection}>
                  <Text style={styles.bioText} numberOfLines={6}>{bio}</Text>
                </View>
              ) : null}

              {/* Price row */}
              {typeof rate === 'number' && rate > 0 ? (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Стоимость консультации</Text>
                  <Text style={styles.priceValue}>{rate.toLocaleString('ru-RU')} ₽ в час</Text>
                </View>
              ) : null}

              {/* CTA button */}
              <Pressable
                style={[styles.contactButton, isOwn && styles.contactButtonSecondary]}
                onPress={(e) => {
                  e.stopPropagation();
                  if (isOwn) {
                    router.push('/(tabs)/profile' as any);
                  } else {
                    router.push(`/(tabs)/explore/${tutor.id}` as any);
                  }
                }}
              >
                <Text style={[styles.contactButtonText, isOwn && styles.contactButtonSecondaryText]}>
                  {isOwn ? 'Перейти в профиль' : 'Написать наставнику'}
                </Text>
              </Pressable>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  title: {
    paddingBottom: 12,
    fontSize: 20, lineHeight: 26, fontFamily: 'Inter-Regular', color: '#181818',
  },
  card: { borderWidth: 1, borderColor: '#1E1E1E', marginBottom: 16, backgroundColor: '#fff' },
  cardHeader: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#1E1E1E' },
  avatar: { width: 72, height: 72 },
  headerText: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  name: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 2 },
  shortBio: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#181818' },
  bioSection: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  bioText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  priceLabel: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  priceValue: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  contactButton: { backgroundColor: '#111', paddingVertical: 14, alignItems: 'center' },
  contactButtonSecondary: { backgroundColor: '#fff' },
  contactButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#FFFFFF' },
  contactButtonSecondaryText: { color: '#181818' },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D', textAlign: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#9B9B9B', textAlign: 'center' },
});
