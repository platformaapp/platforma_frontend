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

import { getPublicTutors, type PublicTutorBasic } from '@/lib/api/tutor';
import { getUserProfile } from '@/lib/auth';

const PLACEHOLDER_AVATAR = require('@/assets/images/avatar.png');

export default function MentorsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tutors, setTutors] = useState<PublicTutorBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [data, profileResult] = await Promise.allSettled([
        getPublicTutors(),
        getUserProfile(),
      ]);

      const tutorList = data.status === 'fulfilled' ? data.value : [];
      const myId = profileResult.status === 'fulfilled' ? (profileResult.value?.id ?? null) : null;

      setTutors(myId ? tutorList.filter((t) => t.id !== myId) : tutorList);

      if (data.status === 'rejected') {
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
        tutors.map((tutor) => (
          <Pressable
            key={tutor.id}
            style={styles.card}
            onPress={() => router.push(`/(tabs)/explore/${tutor.id}` as any)}
          >
            <View style={styles.cardHeader}>
              <Image
                source={tutor.avatarUrl && !tutor.avatarUrl.startsWith('blob:') ? { uri: tutor.avatarUrl } : PLACEHOLDER_AVATAR}
                style={styles.avatar}
              />
              <View style={styles.headerText}>
                <Text style={styles.name}>{tutor.fullName}</Text>
                {tutor.bio ? (
                  <Text style={styles.bio} numberOfLines={2}>{tutor.bio}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.contactButton}>
              <Text style={styles.contactButtonText}>Написать наставнику</Text>
            </View>
          </Pressable>
        ))
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
  name: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818', marginBottom: 4 },
  bio: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter-Regular', color: '#181818' },
  contactButton: { backgroundColor: '#111', paddingVertical: 14, alignItems: 'center' },
  contactButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#FFFFFF' },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#E02D2D', textAlign: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#9B9B9B', textAlign: 'center' },
});
