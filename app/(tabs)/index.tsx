import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { View } from 'react-native';

export default function IndexRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)/events');
  }, []);
  return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
}
