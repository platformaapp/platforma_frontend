import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { CONTENT_MAX_WIDTH, MOBILE_BREAKPOINT } from './layout-constants';
import { MobileBottomNav } from './mobile-bottom-nav';
import { SiteHeader } from './site-header';

export { CONTENT_MAX_WIDTH, MOBILE_BREAKPOINT };

/**
 * Общий каркас веб-страниц: шапка с навигацией на десктопе, нижняя иконочная
 * панель на узких экранах (см. "десктоп"/"моб. версия" в макетах). Сама
 * страница отвечает за прокрутку своего контента (обычно ScrollView внутри)
 * и, если нужно, подключает <SiteFooter /> в конце содержимого.
 * Контент центрируется и ограничен CONTENT_MAX_WIDTH; шапка/футер сами
 * центрируют свою внутреннюю строку так же (см. site-header/site-footer).
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
  content: { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
});
