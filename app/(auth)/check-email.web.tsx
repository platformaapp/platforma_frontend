import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SiteShell } from '@/components/web/site-shell';

/** Веб-версия экрана "Проверьте почту" (см. check-email.tsx для нативной). */
export default function CheckEmailScreenWeb() {
  const router = useRouter();

  return (
    <SiteShell>
      <View style={styles.page}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>А проверьте почту!</Text>
            <Pressable onPress={() => router.back()}><Text style={styles.close}>✕</Text></Pressable>
          </View>

          <Text style={styles.description}>
            Ссылку на восстановление пароля отправили на почту
          </Text>

          <Pressable style={styles.bottomLink} onPress={() => router.push('/forgot-password' as any)}>
            <Text style={styles.bottomLinkText}>Ссылка почему-то не пришла</Text>
          </Pressable>
        </View>
      </View>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 },
  title: { flex: 1, fontFamily: 'Inter-Bold', fontSize: 22, color: '#181818' },
  close: { fontSize: 20, color: '#181818' },
  description: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: '#181818' },
  bottomLink: { marginTop: 32 },
  bottomLinkText: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: '#687076' },
});
