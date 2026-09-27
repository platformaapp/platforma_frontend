import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useSiteSettings } from '@/hooks/use-site-settings';

// Иконки — с навбара vladyakunin.ru (см. assets/images/nav-1..5.png).
const NAV_ITEMS = [
  { key: 'events', href: '/events', icon: require('@/assets/images/nav-1.png'), match: ['/events'] },
  { key: 'explore', href: '/explore', icon: require('@/assets/images/nav-2.png'), match: ['/explore'] },
  { key: 'myevents', href: '/myevents', icon: require('@/assets/images/nav-3.png'), match: ['/myevents'] },
  { key: 'journal', href: '/journal', icon: require('@/assets/images/nav-4.png'), match: ['/journal'] },
  { key: 'profile', href: '/profile', icon: require('@/assets/images/nav-5.png'), match: ['/profile'] },
] as const;

function isActive(pathname: string, match: readonly string[]) {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

// Первые 4 пункта — сгруппированы вместе слева с фиксированным зазором,
// профиль (карандаш) — отдельно, прижат к правому краю (см. моб. макет:
// это не равномерный space-between по всем 5 иконкам).
const GROUPED_ITEMS = NAV_ITEMS.slice(0, 4);
const LAST_ITEM = NAV_ITEMS[4];

/** Нижняя иконочная навигация для мобильной ширины веб-версии (см. моб. макеты). */
export function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { navItems: navOverrides } = useSiteSettings();

  function renderItem(item: (typeof NAV_ITEMS)[number]) {
    const { key, href, icon, match } = item;
    const iconUrl = navOverrides[NAV_ITEMS.indexOf(item)]?.iconUrl;
    const active = isActive(pathname, match);
    return (
      <Pressable key={key} style={styles.item} onPress={() => router.push(href as any)} hitSlop={12}>
        <Image source={iconUrl ? { uri: iconUrl } : icon} style={styles.iconImage} />
        {active ? <View style={styles.activeDot} /> : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.bar}>
      <View style={styles.group}>{GROUPED_ITEMS.map(renderItem)}</View>
      {renderItem(LAST_ITEM)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#fff',
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: 38 },
  item: { alignItems: 'center', justifyContent: 'center' },
  iconImage: { width: 20, height: 20 },
  activeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#E02D2D', marginTop: 4 },
});
