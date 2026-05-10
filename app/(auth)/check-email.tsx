import { useRouter } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function CheckEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.inner}>
          <Pressable style={[styles.close, { top: insets.top + 12 }]} onPress={() => router.back()}>
            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <Path d="M2 2L22 22M22 2L2 22" stroke="#181818"/>
            </Svg>
          </Pressable>

          <View style={styles.content}>
            <ThemedText type="title" style={styles.title}>А ПРОВЕРЬТЕ ПОЧТУ!</ThemedText>

            <ThemedText style={styles.description}>
              Ссылку на восстановление пароля отправили на почту
            </ThemedText>

            <Pressable
              style={styles.bottomLink}
              onPress={() => router.push('/forgot-password')}
            >
              <ThemedText style={styles.bottomLinkText}>Ссылка почему-то не пришла</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: '#fff',
  },
  inner: {
    flex: 1,
    minHeight: '100%',
  },
  content: {
    marginTop: 120,
    gap: 16,
  },
  title: {
    fontFamily: 'Inter-Regular',
    fontSize: 28,
    fontWeight: '400',
    fontStyle: 'normal',
    lineHeight: 36,
    letterSpacing: -2,
    color: '#181818',
    textTransform: 'uppercase',
  },
  description: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#181818',
  },
  bottomLink: {
    marginTop: 198,
    alignItems: 'center',
  },
  bottomLinkText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#181818',
  },
  close: {
    position: 'absolute',
    right: 16,
    zIndex: 1,
    padding: 16,
  },
});


