import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export default function NewEventScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [dateInputText, setDateInputText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
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
      {Platform.OS === 'web' ? (
        <TextInput
          value={dateInputText}
          onChangeText={(v) => {
            setDateInputText(v);
            const m = v.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
            setDate(m ? new Date(+m[3], +m[2] - 1, +m[1]) : null);
          }}
          style={styles.input}
          placeholder="Дата (ДД.ММ.ГГГГ)"
          placeholderTextColor="#9B9B9B"
        />
      ) : (
        <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={[styles.dateText, !date && styles.placeholderText]}>
            {date ? formatDate(date) : 'Дата'}
          </Text>
        </Pressable>
      )}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <Pressable style={styles.datePickerOverlay} onPress={() => setShowDatePicker(false)}>
            <Pressable style={styles.datePickerSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.datePickerHeader}>
                <Pressable onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.datePickerDone}>Готово</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={date ?? new Date()}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                onChange={(_, selectedDate) => selectedDate && setDate(selectedDate)}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={date ?? new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setDate(selectedDate);
          }}
        />
      )}
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
  dateText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#181818',
  },
  placeholderText: {
    color: '#9B9B9B',
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  datePickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#E5E5E5',
  },
  datePickerDone: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#E02D2D',
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
