import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type SlotRow = {
  id: string;
  date: string;
  day?: string;
  time: string;
  isPlaceholder?: boolean;
};

const SLOTS: SlotRow[] = [
  { id: '1', date: '20.07.25', day: 'ВС', time: '20:00' },
  { id: '2', date: '21.07.25', day: 'ПН', time: '20:00' },
  { id: '3', date: '22.07.25', day: 'ВТ', time: '20:00' },
  { id: '4', date: '23.07.25', day: 'СР', time: '18:00' },
  { id: '5', date: '23.07.25', day: 'СР', time: '20:00' },
  { id: '6', date: '24.07.25', day: 'ЧТ', time: '20:00' },
  { id: '7', date: 'Дата', time: 'Время', isPlaceholder: true },
  { id: '8', date: 'Дата', time: 'Время', isPlaceholder: true },
];

export default function SlotsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ThemedText>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="#181818" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </ThemedText>
        </Pressable>
        <Text style={styles.title}>Редактировать слоты</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {SLOTS.map((slot) => (
          <View
            key={slot.id}
            style={[styles.slotRow, slot.isPlaceholder && styles.slotRowPlaceholder]}
          >
            <View style={styles.slotCellDate}>
              <Text style={[styles.slotText, slot.isPlaceholder && styles.placeholderText]}>
                {slot.date}
              </Text>
            </View>
            <View style={styles.slotCellDay}>
              <Text style={[styles.slotText, slot.isPlaceholder && styles.placeholderText]}>
                {slot.day ?? ''}
              </Text>
            </View>
            <View style={styles.slotCellTime}>
              <Text style={[styles.slotText, slot.isPlaceholder && styles.placeholderText]}>
                {slot.time}
              </Text>
            </View>
          </View>
        ))}

        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Сохранить</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton}>
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
  slotRowPlaceholder: {
    backgroundColor: '#fff',
  },
  slotCellDate: {
    flex: 1.6,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  slotCellDay: {
    width: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#1E1E1E',
  },
  slotCellTime: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  slotText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  placeholderText: {
    color: '#9B9B9B',
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
