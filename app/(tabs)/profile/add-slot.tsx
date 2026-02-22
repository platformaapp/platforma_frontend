import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function AddSlotScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="chevron-left" size={24} color="#181818" />
        </Pressable>
        <Text style={styles.title}>Добавить слот</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.slotRow}>
          <View style={styles.slotCellDate}>
            <TextInput
              style={styles.slotInput}
              placeholder="Дата"
              placeholderTextColor="#9B9B9B"
            />
          </View>
          <View style={styles.slotCellDay} />
          <View style={styles.slotCellTime}>
            <TextInput
              style={styles.slotInput}
              placeholder="Время"
              placeholderTextColor="#9B9B9B"
            />
          </View>
        </View>
        <View style={styles.slotRow}>
          <View style={styles.slotCellDate}>
            <TextInput
              style={styles.slotInput}
              placeholder="Дата"
              placeholderTextColor="#9B9B9B"
            />
          </View>
          <View style={styles.slotCellDay} />
          <View style={styles.slotCellTime}>
            <TextInput
              style={styles.slotInput}
              placeholder="Время"
              placeholderTextColor="#9B9B9B"
            />
          </View>
        </View>

        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Сохранить</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Отмена</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  slotRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 12,
    backgroundColor: '#fff',
    minHeight: 52,
  },
  slotCellDate: {
    flex: 1.6,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  slotCellDay: {
    width: 64,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#1E1E1E',
  },
  slotCellTime: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  slotInput: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    padding: 0,
  },
  primaryButton: {
    marginTop: 24,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#111',
    paddingVertical: 16,
    alignItems: 'center',
    height: 52,
  },
  primaryButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 16,
    alignItems: 'center',
    height: 52,
  },
  secondaryButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
});
