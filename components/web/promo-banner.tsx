import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const TELEGRAM_URL = 'https://t.me/p34forma';

/**
 * Промо-баннер материала "AI ISSUE" — используется на /events и /journal
 * (см. макеты обеих страниц). На /journal рядом с подписью есть ещё красная
 * ссылка "в телеге" на канал — на /events её нет, поэтому это опционально.
 */
export function PromoBanner({ withTelegramLink }: { withTelegramLink?: boolean }) {
  const router = useRouter();
  return (
    <Pressable style={styles.promoBanner} onPress={() => router.push('/journal' as any)}>
      <View style={styles.promoInfoDot}><Text style={styles.promoInfoDotText}>i</Text></View>
      <View style={styles.promoTextBlock}>
        <Text style={styles.promoHeadline}>Заменят ли реальных моделей их AI-копиями?</Text>
        <View style={styles.promoSubRow}>
          <Text style={styles.promoSub}>читайте в нашем материале</Text>
          {withTelegramLink ? (
            <Pressable onPress={(e) => { e.stopPropagation?.(); Linking.openURL(TELEGRAM_URL); }}>
              <Text style={styles.promoTelegramLink}>в телеге</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Text style={styles.promoBrand}>AI ISSUE</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  promoBanner: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#181818', minHeight: 220, marginTop: 24, padding: 24, position: 'relative' },
  promoInfoDot: { position: 'absolute', top: 16, right: 56, width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  promoInfoDotText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#fff' },
  promoTextBlock: { flex: 1, paddingRight: 48 },
  promoHeadline: { fontSize: 22, lineHeight: 28, fontFamily: 'Inter-Bold', color: '#fff', textTransform: 'uppercase', marginBottom: 12 },
  promoSubRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  promoSub: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#fff' },
  promoTelegramLink: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#E02D2D' },
  promoBrand: { position: 'absolute', top: '50%', right: 16, fontSize: 16, fontFamily: 'Inter-Bold', color: '#fff', letterSpacing: 2, transform: [{ translateY: -10 }, { rotate: '90deg' }] },
});
