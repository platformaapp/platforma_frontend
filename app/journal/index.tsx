import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Заглушка для нативного приложения: "Журнал" — только веб-раздел (см. index.web.tsx). */
export default function JournalScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.title}>Журнал</Text>
      <Text style={styles.text}>Раздел скоро появится.</Text>
      <Pressable style={styles.link} onPress={() => router.back()}>
        <Text style={styles.linkText}>Назад</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24 },
  title: { fontFamily: 'Inter-Bold', fontSize: 24, color: '#181818', marginBottom: 8 },
  text: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#687076', marginBottom: 24 },
  link: { paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: '#181818' },
  linkText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },
});
