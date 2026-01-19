import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function UserAgreementScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backArrow}>←</ThemedText>
      </Pressable>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedText type="title" style={styles.title}>
          ПОЛЬЗОВАТЕЛЬСКОЕ{"\n"}СОГЛАШЕНИЕ
        </ThemedText>

        <View style={styles.content}>
          <ThemedText style={styles.heading}>What is Lorem Ipsum?</ThemedText>
          <ThemedText style={styles.paragraph}>
            Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.
          </ThemedText>

          <ThemedText style={styles.heading}>Why do we use it?</ThemedText>
          <ThemedText style={styles.paragraph}>
            It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 16,
    zIndex: 1,
    padding: 8,
  },
  backArrow: {
    fontSize: 24,
    color: '#181818',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 60,
  },
  title: {
    marginBottom: 24,
    fontFamily: "Inter-Regular",
    fontSize: 28,
    fontWeight: "400",
    fontStyle: "normal",
    lineHeight: 36,
    letterSpacing: -2,
    color: "#181818",
    textAlign: 'left',
  },
  content: {
    gap: 16,
  },
  heading: {
    fontFamily: "Inter-Regular",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
    color: "#181818",
    marginTop: 8,
    marginBottom: 8,
  },
  paragraph: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#181818",
    marginBottom: 16,
  },
});

