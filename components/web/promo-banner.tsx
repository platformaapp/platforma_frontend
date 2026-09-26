import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useSiteSettings } from '@/hooks/use-site-settings';

const TELEGRAM_URL = 'https://t.me/p34forma';
const BANNER_IMAGE = require('@/assets/images/ai-issue-banner.webp');
const BANNER_IMAGE_TG = require('@/assets/images/ai-issue-banner-tg.png');
// Реальный размер файла — рендерим на всю ширину с этим соотношением сторон,
// чтобы картинка не обрезалась (заголовок и подпись "вшиты" в саму картинку).
const BANNER_ASPECT_RATIO = 1244 / 290;

/**
 * Промо-баннер — используется на /events и /journal. Картинку и ссылку можно
 * переопределить из админки (Настройки сайта); без этого — дефолтный баннер
 * материала "AI ISSUE", ведущий в /journal. На /journal рядом с подписью
 * есть ещё красная ссылка "в телеге" на канал — на /events её нет, поэтому
 * это опционально; кладём её поверх картинки рядом с уже вшитым в неё
 * текстом "читайте в нашем материале" (только для дефолтного баннера).
 */
export function PromoBanner({ withTelegramLink }: { withTelegramLink?: boolean }) {
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
    <Pressable style={styles.promoBanner} onPress={() => router.push('/journal' as any)}>
      {withTelegramLink ? (
        <View style={styles.promoImageWrap}>
          <Image source={BANNER_IMAGE_TG} style={styles.promoImage} resizeMode="contain" />
          <Pressable
            style={styles.telegramLink}
            accessibilityRole="link"
            accessibilityLabel="в телеге"
            onPress={(e) => { e.stopPropagation?.(); window.open(TELEGRAM_URL, '_blank', 'noopener,noreferrer'); }}
          />
        </View>
      ) : <View style={styles.promoImageWrap}>
      <Image source={BANNER_IMAGE} style={styles.promoImage} resizeMode="cover" />
    </View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  promoBanner: { marginTop: 97, position: 'relative', backgroundColor: 'transparent' },
  promoImageWrap: { width: '100%', aspectRatio: BANNER_ASPECT_RATIO, position: 'relative', overflow: 'hidden' },
  promoImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  // Прозрачная область клика поверх уже вшитой в картинку надписи "в телеге"
  // (координаты — bbox красного текста в ai-issue-banner-tg.png, с запасом).
  telegramLink: { position: 'absolute', left: '27%', width: '16%', top: '84%', height: '13%' },
});
