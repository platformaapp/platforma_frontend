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

import { getPublicTutorList, type PublicTutor } from '@/lib/api/tutor';

const PLACEHOLDER_AVATAR = require('@/assets/images/avatar.png');

export default function MentorsScreen() {
  const router = useRouter();
  const [tutors, setTutors] = useState<PublicTutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getPublicTutorList();
      setTutors(data);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить наставников');
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

  const handleContact = (tutor: PublicTutor) => {
    // Pass only the id — detail screen fetches profile itself so the URL stays short
    router.push(`/(tabs)/explore/${tutor.id}`);
  };

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
      <Text style={styles.title}>НАСТАВНИКИ</Text>

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
          <Pressable key={tutor.id} onPress={() => handleContact(tutor)}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Image
                  source={tutor.avatarUrl ? { uri: tutor.avatarUrl } : PLACEHOLDER_AVATAR}
                  style={styles.avatar}
                />
                <View style={styles.headerText}>
                  <Text style={styles.name}>{tutor.fullName}</Text>
                  {tutor.bio ? (
                    <Text style={styles.role} numberOfLines={2}>{tutor.bio}</Text>
                  ) : null}
                </View>
              </View>
              <Pressable style={styles.contactButton} onPress={() => handleContact(tutor)}>
                <Text style={styles.contactButtonText}>Написать наставнику</Text>
              </Pressable>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  title: {
    paddingTop: 16,
    paddingBottom: 12,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  card: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  cardHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#1E1E1E',
  },
  avatar: {
    width: 72,
    height: 72,
  },
  headerText: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 4,
  },
  role: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  contactButton: {
    backgroundColor: '#111',
    paddingVertical: 14,
    alignItems: 'center',
  },
  contactButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#E02D2D',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
    textAlign: 'center',
  },
});
