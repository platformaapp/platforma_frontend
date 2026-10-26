import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { getAuthToken, getUserProfile } from '@/lib/auth';

export default function ProfileIndexScreen() {
  const router = useRouter();
  // ?open=event|article — см. events/journal "Создать событие"/"Написать
  // текст" для уже авторизованного наставника: ведём сразу в попап
  // создания на его личной странице, а не просто на неё — параметр нужно
  // пронести через этот редирект на [id].web.tsx, который его и читает.
  const { open } = useLocalSearchParams<{ open?: string }>();

  useEffect(() => {
    let isMounted = true;
    const redirect = async () => {
      const token = await getAuthToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      const profile = await getUserProfile();
      if (isMounted) {
        const profileId = profile?.id ?? 'me';
        const suffix = open ? `?open=${encodeURIComponent(open)}` : '';
        router.replace(`/(tabs)/profile/${profileId}${suffix}`);
      }
    };
    redirect();
    return () => { isMounted = false; };
  }, [router, open]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#181818" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
