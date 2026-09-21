import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

const TELEGRAM_URL = 'https://t.me/p34forma';
const BANNER_IMAGE = require('@/assets/images/ai-issue-banner.webp');
// Реальный размер файла — рендерим на всю ширину с этим соотношением сторон,
// чтобы картинка не обрезалась (заголовок и подпись "вшиты" в саму картинку).
const BANNER_ASPECT_RATIO = 1244 / 290;

/**
 * Промо-баннер материала "AI ISSUE" — используется на /events и /journal.
 * На /journal рядом с подписью есть ещё красная ссылка "в телеге" на канал —
 * на /events её нет, поэтому это опционально; кладём её поверх картинки
 * рядом с уже вшитым в неё текстом "читайте в нашем материале".
 */
export function PromoBanner({ withTelegramLink }: { withTelegramLink?: boolean }) {
  const router = useRouter();
  return (
    <Pressable style={styles.promoBanner} onPress={() => router.push('/journal' as any)}>
      <View style={styles.promoImageWrap}>
        <Image source={BANNER_IMAGE} style={styles.promoImage} resizeMode="cover" />
      </View>
      {withTelegramLink ? (
        <Pressable
          style={styles.telegramLink}
          onPress={(e) => { e.stopPropagation?.(); Linking.openURL(TELEGRAM_URL); }}
        >
          <Text style={styles.promoTelegramLinkText}>в телеге</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  promoBanner: { marginTop: 24, position: 'relative', backgroundColor: '#010101' },
  promoImageWrap: { width: '100%', aspectRatio: BANNER_ASPECT_RATIO, position: 'relative', overflow: 'hidden' },
  promoImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  telegramLink: { position: 'absolute', left: '24%', bottom: '7%' },
  promoTelegramLinkText: { fontSize: 14, fontFamily: 'Gramatika-Regular', fontWeight: 'bold', color: '#E02D2D' },
});
