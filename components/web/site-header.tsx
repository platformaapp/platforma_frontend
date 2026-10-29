import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useSiteSettings } from '@/hooks/use-site-settings';
import { BackArrowIcon } from './back-arrow-icon';
import { CONTENT_MAX_WIDTH, MOBILE_BREAKPOINT } from './layout-constants';

// Иконки — с навбара vladyakunin.ru (см. assets/images/nav-1..5.png),
// подписи и порядок пунктов — свои, не менялись. Пункты всегда чёрные —
// без подсветки активного (по просьбе пользователя). "События" — иконка-
// цветок (nav-2, её прислал пользователь явно для этого пункта), не
// стрелка. "Наставники" — освободившаяся nav-5 (цветок другого рисунка).
// "Личный кабинет" — иконка-стрелка (nav-1).
const NAV_ITEMS = [
  { key: 'events', label: 'События', href: '/events', icon: require('@/assets/images/nav-2.png') },
  { key: 'explore', label: 'Наставники', href: '/explore', icon: require('@/assets/images/nav-5.png') },
  { key: 'myevents', label: 'Мои записи', href: '/myevents', icon: require('@/assets/images/nav-3.png') },
  { key: 'journal', label: 'Журнал', href: '/journal', icon: require('@/assets/images/nav-4.png') },
  { key: 'profile', label: 'Личный кабинет', href: '/profile', icon: require('@/assets/images/nav-1.png') },
] as const;

/**
 * Шапка. На десктопе — иконка+подпись слева, типографический логотип "p(34)"
 * справа. На узких экранах навигация уходит в нижнюю иконочную панель
 * (MobileBottomNav), здесь остаётся только стрелка "назад" слева (без
 * логотипа p(34) — убран по просьбе пользователя) — на любой странице, не
 * только на "подстраницах": history.back() работает и между вкладками
 * (см. моб. макет — стрелка есть даже на самом "Журнале").
 */
export function SiteHeader() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  // Текст пунктов и иконки можно переопределить из админки (Настройки сайта);
  // порядок/маршруты — нет, это структура навигации, не контент.
  const { navItems: navOverrides } = useSiteSettings();

  if (isMobile) {
    return (
      <View style={styles.mobileHeader}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.push('/events' as any))} hitSlop={12}>
          <BackArrowIcon width={20} height={19} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <View style={styles.headerInner}>
        <View style={styles.nav}>
          {NAV_ITEMS.map(({ key, label, href, icon }, index) => {
            const override = navOverrides[index];
            return (
              <Pressable key={key} style={styles.navItem} onPress={() => router.push(href as any)}>
                <Image source={override?.iconUrl ? { uri: override.iconUrl } : icon} style={styles.navIconImage} />
                <Text style={styles.navLabel}>{override?.label || label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={() => router.push('/about-us' as any)}>
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
    paddingTop: 49,
    paddingVertical: 20,
  },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: 28 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // 24×24 — только в мобильной версии (MobileBottomNav), здесь (десктоп) —
  // прежний размер 14×14.
  navIconImage: { width: 14, height: 14 },
  navLabel: { fontFamily: 'Gramatika-Regular', fontSize: 15, lineHeight: 15, color: '#010101' },
  logo: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 15, color: '#010101', lineHeight: 1
   },
  // Стрелка "назад" по левому краю. paddingTop держит её примерно на той же
  // высоте, что раньше (была в центре блока height:76 — (76-19)/2≈28.5).
  // paddingBottom:5 — ЕДИНСТВЕННЫЙ источник отступа между стрелкой и
  // контентом страницы (ниже в SiteShell сразу идёт content, без своего
  // отступа) — чтобы отступ был ровно 5px на всех страницах, у самого
  // контента (scrollContent/title и т.п.) на мобильном не должно быть
  // собственного marginTop/paddingTop поверх этого.
  mobileHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 45, paddingBottom: 34 },
});
