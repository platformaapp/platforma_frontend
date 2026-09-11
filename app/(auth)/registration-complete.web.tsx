import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SiteShell } from '@/components/web/site-shell';
import { AuthError } from '@/lib/api/auth-error';
import { bindPaymentMethod } from '@/lib/api/student-payments';

/** Веб-версия экрана "Регистрация завершена" (см. registration-complete.tsx для нативной). */
export default function RegistrationCompleteScreenWeb() {
  const router = useRouter();
  const [isLinking, setIsLinking] = useState(false);

  async function handleLinkNow() {
    if (isLinking) return;
    setIsLinking(true);
    try {
      const { confirmationUrl } = await bindPaymentMethod({ provider: 'yookassa' });
      const w = (globalThis as any).window;
      if (w) w.location.href = confirmationUrl;
    } catch (e: unknown) {
      if (e instanceof AuthError || (e as { name?: string })?.name === 'AuthError') {
        router.replace('/login');
        return;
      }
      router.replace('/(tabs)/events');
    } finally {
      setIsLinking(false);
    }
  }

  function handleLinkLater() {
    router.replace('/(tabs)/events');
  }

  return (
    <SiteShell>
      <View style={styles.page}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Регистрация завершена</Text>
            <Pressable onPress={handleLinkLater}><Text style={styles.close}>✕</Text></Pressable>
          </View>

          <Text style={styles.description}>Привяжите карту, чтобы ни в чем себе не отказывать</Text>

          <View style={styles.footerRow}>
            <Pressable onPress={handleLinkLater}><Text style={styles.laterLink}>Привяжу потом</Text></Pressable>
            <Pressable onPress={handleLinkNow} disabled={isLinking}>
              <Text style={styles.nowLink}>{isLinking ? 'Открываем YooKassa…' : 'Привязать сейчас'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 },
  card: { width: '100%', maxWidth: 480, backgroundColor: '#fff', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontFamily: 'Inter-Bold', fontSize: 22, color: '#181818' },
  close: { fontSize: 20, color: '#181818' },
  description: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: '#181818', marginBottom: 24 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  laterLink: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#687076' },
  nowLink: { fontFamily: 'Inter-Medium', fontSize: 15, color: '#E02D2D' },
});
