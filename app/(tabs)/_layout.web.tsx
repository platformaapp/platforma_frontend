import { Tabs } from 'expo-router';
import React from 'react';

import { CookieBanner } from '@/components/cookie-banner';

/**
 * Веб-версия таб-группы: без нижнего таб-бара (в новом веб-дизайне навигация —
 * это верхнее меню внутри самих экранов, напр. "СОБЫТИЯ / НАСТАВНИКИ / МОИ ЗАПИСИ").
 * <Tabs> оставлен ради роутинга и фокус-эффектов ({@link useFocusEffect} в экранах),
 * просто без визуального таб-бара.
 */
export default function TabLayoutWeb() {
  return (
    <Tabs
      tabBar={() => <CookieBanner />}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Tabs.Screen name="events" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="myevents" />
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
