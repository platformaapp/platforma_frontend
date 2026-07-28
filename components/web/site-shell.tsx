import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { MobileBottomNav } from './mobile-bottom-nav';
import { SiteHeader } from './site-header';

export const MOBILE_BREAKPOINT = 768;

/**
 * Общий каркас веб-страниц: шапка с навигацией на десктопе, нижняя иконочная
 * панель на узких экранах (см. "десктоп"/"моб. версия" в макетах). Сама
 * страница отвечает за прокрутку своего контента (обычно ScrollView внутри)
 * и, если нужно, подключает <SiteFooter /> в конце содержимого.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;

  return (
    <View style={styles.root}>
      {!isMobile && <SiteHeader />}
      <View style={styles.content}>{children}</View>
      {isMobile && <MobileBottomNav />}
    </View>
  );
}

export function useIsMobileWeb(): boolean {
  const { width } = useWindowDimensions();
  return width < MOBILE_BREAKPOINT;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1 },
});
