import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

/**
 * Заглушка для нативного приложения — в нём слоты наставника бронируются
 * модалкой прямо на app/(tabs)/explore/[id].tsx, отдельного экрана нет.
 * Нужна как fallback-sibling для платформенного файла slots.web.tsx: без
 * неё expo-router не может собрать статический маршрут для веба и билд
 * падает. Просто возвращает на страницу профиля наставника.
 */
export default function TutorSlotsFallbackScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    router.replace(id ? (`/(tabs)/explore/${id}` as any) : ('/(tabs)/explore' as any));
  }, [router, id]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#181818" />
    </View>
  );
}
