import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { CONTENT_MAX_WIDTH, MOBILE_BREAKPOINT } from './layout-constants';
import { MobileBottomNav } from './mobile-bottom-nav';
import { SiteHeader } from './site-header';

export { CONTENT_MAX_WIDTH, MOBILE_BREAKPOINT };

/**
 * Общий каркас веб-страниц: шапка с навигацией на десктопе, нижняя иконочная
 * панель на узких экранах (см. "десктоп"/"моб. версия" в макетах). Страница
 * передаёт свой контент как обычный View/ScrollView-контент — сам скролл
 * обеспечивает scrollArea ниже, шапка прокручивается вместе с контентом
 * (не зафиксирована), а не остаётся приклеенной к верху экрана. Если нужно,
 * страница подключает <SiteFooter /> в конце содержимого. Контент
 * центрируется и ограничен CONTENT_MAX_WIDTH; шапка/футер сами центрируют
 * свою внутреннюю строку так же (см. site-header/site-footer).
 *
 * data-site-content на scrollArea — хук для глобального CSS-правила в
 * app/+html.tsx, которое прячет её полосу прокрутки, не трогая сам
 * overflow-y:auto — скролл (колесо/клавиши/тач) остаётся полностью рабочим,
 * просто без видимого скроллбара. Прокрутку самого html/body не используем:
 * expo-router оборачивает каждый экран в контейнер с overflow:hidden для
 * анимации перехода, и всё, что не влезает в него, будет обрезано вне
 * зависимости от html/body — скроллить обязан именно этот элемент внутри
 * контейнера. MobileBottomNav — вне scrollArea, остаётся приклеенной к низу
 * экрана намеренно (в отличие от шапки).
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;

  return (
    <View style={styles.root}>
      {/* dataSet is a react-native-web-only DOM prop, not in @types/react-native's ViewProps */}
      <View style={styles.scrollArea} {...({ dataSet: { siteContent: 'true' } } as any)}>
        {/* SiteHeader сам решает, что показывать на мобильной ширине (только
            логотип) — навигация на мобильном в MobileBottomNav снизу. */}
        <SiteHeader />
        <View style={styles.content}>{children}</View>
      </View>
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
  scrollArea: { flex: 1, width: '100%', overflowY: 'auto' } as any,
  content: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
});
