import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CircleIcon, PencilIcon, PlusIcon, SquareIcon, TriangleIcon } from './nav-icons';

const ACTIVE = '#E02D2D';
const INACTIVE = '#181818';

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

/** Шапка веб-версии (десктоп) — иконка+подпись слева, типографический логотип "p(34)" справа. */
export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.header}>
      <View style={styles.nav}>
        {NAV_ITEMS.map(({ key, label, href, Icon, match }) => {
          const active = isActive(pathname, match);
          const color = active ? ACTIVE : INACTIVE;
          return (
            <Pressable key={key} style={styles.navItem} onPress={() => router.push(href as any)}>
              <Icon color={color} />
              <Text style={[styles.navLabel, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={() => router.push('/events' as any)}>
        <Text style={styles.logo}>p(34)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderColor: '#E5E5E5',
  },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: 28 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navLabel: { fontFamily: 'Inter-Regular', fontSize: 14 },
  logo: { fontFamily: 'Inter-Bold', fontSize: 20, color: '#181818' },
});
