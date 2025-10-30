import { Link, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function AuthChoiceScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <Pressable style={styles.close} onPress={() => router.back()}>
        <ThemedText style={{ fontSize: 22 }}>✕</ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.title}>АВТОРИЗАЦИЯ</ThemedText>

      <View style={{ gap: 16 }}>
        <Link href="/register-student" asChild>
          <Pressable style={[styles.btn, styles.btnPrimary]}> 
            <ThemedText style={styles.btnPrimaryText}>Хочу учиться</ThemedText>
          </Pressable>
        </Link>

        <Link href="/register-tutor" asChild>
          <Pressable style={[styles.btn, styles.btnOutline]}> 
            <ThemedText style={styles.btnOutlineText}>Хочу учить</ThemedText>
          </Pressable>
        </Link>
      </View>

      <Link href="/login" asChild>
        <Pressable style={{ marginTop: 'auto', paddingVertical: 24 }}>
          <ThemedText style={{ textAlign: 'center' }}>У меня уже есть профиль</ThemedText>
        </Pressable>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    marginTop: 48,
    marginBottom: 24,
  },
  btn: {
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#111',
  },
  btnPrimary: {
    backgroundColor: '#111',
  },
  btnPrimaryText: {
    color:'#000',
  },
  btnOutline: {
    backgroundColor: 'transparent',
  },
  btnOutlineText: {
    color: '#111',
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
});


