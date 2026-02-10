import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export default function NewEventScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [price, setPrice] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');

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
      </View>

      <Text style={styles.title}>НОВОЕ СОБЫТИЕ</Text>

      <TextInput
        value={title}
        onChangeText={setTitle}
        style={styles.input}
        placeholder="Название"
        placeholderTextColor="#9B9B9B"
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        style={[styles.input, styles.textArea]}
        placeholder="Описание"
        placeholderTextColor="#9B9B9B"
        multiline
        textAlignVertical="top"
      />
      <TextInput
        value={date}
        onChangeText={setDate}
        style={styles.input}
        placeholder="Дата"
        placeholderTextColor="#9B9B9B"
      />
      <TextInput
        value={time}
        onChangeText={setTime}
        style={styles.input}
        placeholder="Время"
        placeholderTextColor="#9B9B9B"
      />

      <View style={styles.priceRow}>
        <TextInput
          value={price}
          onChangeText={setPrice}
          style={styles.priceInput}
          placeholder="Стоимость участия"
          placeholderTextColor="#9B9B9B"
        />
        <Text style={styles.priceHint}>Комиссия 10%</Text>
      </View>

      <TextInput
        value={maxParticipants}
        onChangeText={setMaxParticipants}
        style={styles.input}
        placeholder="Максимальное количество участников"
        placeholderTextColor="#9B9B9B"
      />

      <Pressable style={styles.uploadButton}>
        <Text style={styles.uploadButtonText}>Загрузить обложку</Text>
      </Pressable>

      <Pressable style={styles.createButton}>
        <Text style={styles.createButtonText}>Создать событие</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 8,
    marginBottom: 16,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  input: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
    marginBottom: 12,
  },
  textArea: {
    minHeight: 96,
    paddingTop: 12,
  },
  priceRow: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  priceHint: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    color: '#9B9B9B',
  },
  uploadButton: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 16,
    alignItems: 'center',
    height: 52,
    marginBottom: 24,
  },
  uploadButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  createButton: {
    marginTop: 'auto',
    marginBottom: 24,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#111',
    paddingVertical: 16,
    alignItems: 'center',
    height: 52,
  },
  createButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
});
