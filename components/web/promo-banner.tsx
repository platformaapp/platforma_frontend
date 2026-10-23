import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useSiteSettings } from '@/hooks/use-site-settings';

const BANNER_IMAGE = require('@/assets/images/ai-issue-banner.webp');
// Статья, на которую ведёт дефолтный баннер — "Почему Москва всё ещё
// мечтает о Париже 1960-х" (вшита в саму картинку, см. надпись "читайте в
// нашем материале" на баннере).
const BANNER_ARTICLE_ID = '1c9fec23-bb0c-45fe-bc8b-d05a2a8020ba';
// Реальный размер файла — рендерим на всю ширину с этим соотношением сторон,
// чтобы картинка не обрезалась (заголовок и подпись "вшиты" в саму картинку).
const BANNER_ASPECT_RATIO = 2000 / 667;

/**
 * Промо-баннер — используется на /events и /journal, один и тот же баннер
 * в обоих местах (раньше у /journal была своя картинка с отдельной ссылкой
 * на телеграм-канал поверх — убрано, теперь везде одна картинка и одна
 * ссылка на статью). Картинку и ссылку можно переопределить из админки
 * (Настройки сайта) — без этого показывается дефолтный баннер.
 */
export function PromoBanner() {
  const router = useRouter();
  const { banner } = useSiteSettings();

  if (banner.imageUrl) {
    return (
      <Pressable
        style={styles.promoBanner}
        onPress={() => banner.linkUrl && window.open(banner.linkUrl, '_blank', 'noopener,noreferrer')}
      >
        <View style={styles.promoImageWrap}>
          <Image source={{ uri: banner.imageUrl }} style={styles.promoImage} resizeMode="cover" />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.promoBanner} onPress={() => router.push(`/journal/${BANNER_ARTICLE_ID}` as any)}>
      <View style={styles.promoImageWrap}>
        <Image source={BANNER_IMAGE} style={styles.promoImage} resizeMode="cover" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  promoBanner: { marginTop: 97, position: 'relative', backgroundColor: 'transparent' },
  promoImageWrap: { width: '100%', aspectRatio: BANNER_ASPECT_RATIO, position: 'relative', overflow: 'hidden' },
  promoImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
});
