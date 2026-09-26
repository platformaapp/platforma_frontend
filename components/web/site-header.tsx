import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useSiteSettings } from '@/hooks/use-site-settings';
import { CONTENT_MAX_WIDTH, MOBILE_BREAKPOINT } from './layout-constants';
import { CircleIcon, PencilIcon, PlusIcon, SquareIcon, TriangleIcon } from './nav-icons';

const ACTIVE = '#E02D2D';
const INACTIVE = '#010101';

const NAV_ITEMS = [
  { key: 'events', label: 'События', href: '/events', Icon: SquareIcon, match: ['/events'] },
  { key: 'explore', label: 'Наставники', href: '/explore', Icon: TriangleIcon, match: ['/explore'] },
  { key: 'myevents', label: 'Мои записи', href: '/myevents', Icon: PlusIcon, match: ['/myevents'] },
  { key: 'journal', label: 'Журнал', href: '/journal', Icon: CircleIcon, match: ['/journal'] },
  { key: 'profile', label: 'Личный кабинет', href: '/profile', Icon: PencilIcon, match: ['/profile'] },
] as const;

function isActive(pathname: string, match: readonly string[]) {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

/**
 * Шапка. На десктопе — иконка+подпись слева, типографический логотип "p(34)"
 * справа. На узких экранах навигация уходит в нижнюю иконочную панель
 * (MobileBottomNav), здесь остаётся только логотип-ссылка на /events сверху
 * справа (см. моб. макеты).
 */
export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  // Текст пунктов и иконки можно переопределить из админки (Настройки сайта);
  // порядок/маршруты — нет, это структура навигации, не контент.
  const { navItems: navOverrides } = useSiteSettings();

  if (isMobile) {
    return (
      <View style={styles.mobileHeader}>
        <Pressable onPress={() => router.push('/events' as any)}>
          <Text style={styles.logo}>p(34)</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <View style={styles.headerInner}>
        <View style={styles.nav}>
          {NAV_ITEMS.map(({ key, label, href, Icon, match }, index) => {
            const active = isActive(pathname, match);
            const color = active ? ACTIVE : INACTIVE;
            const override = navOverrides[index];
            return (
              <Pressable key={key} style={styles.navItem} onPress={() => router.push(href as any)}>
                {override?.iconUrl ? (
                  <Image source={{ uri: override.iconUrl }} style={styles.navIconImage} />
                ) : (
                  <Icon color={color} />
                )}
                <Text style={[styles.navLabel, { color }]}>{override?.label || label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={() => router.push('/events' as any)}>
          <Text style={styles.logo}>p(34)</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    // borderBottomWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
  },
  headerInner: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: 28 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navIconImage: { width: 16, height: 16 },
  navLabel: { fontFamily: 'Gramatika-Regular', fontSize: 15 },
  logo: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 20, color: '#010101' },
  mobileHeader: { alignItems: 'flex-end', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 },
});
