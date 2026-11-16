import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useSiteSettings } from '@/hooks/use-site-settings';

const BANNER_IMAGE = require('@/assets/images/ai-issue-banner.webp');
// Статья, на которую ведёт дефолтный баннер — "Почему Москва всё ещё
// мечтает о Париже 1960-х" (вшита в саму картинку, см. надпись "читайте в
// нашем материале" на баннере).
//
// !!! ТРЕБУЕТ РУЧНОГО ОБНОВЛЕНИЯ после деплоя миграции slug'ов (см.
// platforma_backend: AddSeoExtraFieldsToArticles) — раньше тут был реальный
// uuid этой статьи, но с переходом на человекочитаемые URL (/journal/<slug>)
// он больше не резолвится (GET /api/articles/<uuid> отвечает 404 — slug это
// ЕДИНСТВЕННЫЙ публичный путь к статье). Пусто — намеренно: угадывать
// автосгенерированный slug вместо реальной проверки в БД/админке рискованно
// (легко промахнуться на un-обычной пунктуации в настоящем заголовке). Взять
// актуальный slug в админке (/admin/journal → открыть эту статью → поле
// "Слаг") и подставить сюда; пока не заполнено — баннер ведёт на /journal.
const BANNER_ARTICLE_SLUG = '';
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
  // Админская картинка баннера — произвольных пропорций (не известны заранее,
  // в отличие от дефолтной, где соотношение сторон файла зашито в константу
  // выше). Fixed-ratio box (BANNER_ASPECT_RATIO) обрезал бы её под чужое
  // соотношение сторон — вместо этого меряем реальные размеры картинки и
  // показываем на всю ширину в ЕЁ собственном соотношении (contain, не
  // cover — картинка должна помещаться целиком, не обрезаться).
  const [customRatio, setCustomRatio] = useState<number | null>(null);
  useEffect(() => {
    if (!banner.imageUrl) { setCustomRatio(null); return; }
    let active = true;
    Image.getSize(
      banner.imageUrl,
      (w, h) => { if (active && h > 0) setCustomRatio(w / h); },
      () => { if (active) setCustomRatio(null); }
    );
    return () => { active = false; };
  }, [banner.imageUrl]);

  if (banner.imageUrl) {
    return (
      <Pressable
        style={styles.promoBanner}
        onPress={() => banner.linkUrl && window.open(banner.linkUrl, '_blank', 'noopener,noreferrer')}
      >
        <View style={[styles.promoImageWrap, customRatio ? { aspectRatio: customRatio } : null]}>
          <Image source={{ uri: banner.imageUrl }} style={styles.promoImage} resizeMode="contain" />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.promoBanner} onPress={() => router.push((BANNER_ARTICLE_SLUG ? `/journal/${BANNER_ARTICLE_SLUG}` : '/journal') as any)}>
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
