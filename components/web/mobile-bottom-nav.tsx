import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CircleIcon, PencilIcon, PlusIcon, SquareIcon, TriangleIcon } from './nav-icons';

const ACTIVE = '#E02D2D';
const INACTIVE = '#181818';

const NAV_ITEMS = [
  { key: 'events', href: '/events', Icon: SquareIcon, match: ['/events'] },
  { key: 'explore', href: '/explore', Icon: TriangleIcon, match: ['/explore'] },
  { key: 'myevents', href: '/myevents', Icon: PlusIcon, match: ['/myevents'] },
  { key: 'journal', href: '/journal', Icon: CircleIcon, match: ['/journal'] },
  { key: 'profile', href: '/profile', Icon: PencilIcon, match: ['/profile'] },
] as const;

function isActive(pathname: string, match: readonly string[]) {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

/** Нижняя иконочная навигация для мобильной ширины веб-версии (см. моб. макеты). */
export function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.bar}>
      {NAV_ITEMS.map(({ key, href, Icon, match }) => (
        <Pressable key={key} style={styles.item} onPress={() => router.push(href as any)} hitSlop={12}>
          <Icon color={isActive(pathname, match) ? ACTIVE : INACTIVE} size={20} />
        </Pressable>
      ))}
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
  item: { alignItems: 'center', justifyContent: 'center' },
});
