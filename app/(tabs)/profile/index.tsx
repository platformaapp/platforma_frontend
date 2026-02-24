import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { getAuthToken } from '@/lib/auth';
import { getUserProfile } from '@/lib/auth';

export default function ProfileIndexScreen() {
  const router = useRouter();

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
        router.replace(`/(tabs)/profile/${profileId}`);
      }
    };
    redirect();
    return () => { isMounted = false; };
  }, [router]);

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
