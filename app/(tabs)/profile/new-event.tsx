import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { createEvent } from '@/lib/api/events';

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/** Парсит "20:00" или "20:00:00" → [hours, minutes] */
function parseTime(t: string): [number, number] | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return [h, min];
}

/** Формирует datetime_start и datetime_end (ISO 8601), длительность 1 час */
function toDatetimeRange(date: Date, timeStr: string): { start: string; end: string } | null {
  const parsed = parseTime(timeStr);
  if (!parsed) return null;
  const [h, min] = parsed;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, min, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
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
  const [isEditingPrice, setIsEditingPrice] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const priceValue = price ? parseInt(price) || 0 : 0;
  const commission = priceValue * 0.1;
  const finalAmount = priceValue - commission;

  async function pickCover() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Ошибка', 'Необходимо разрешение на доступ к фотографиям');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri);
    }
  }

  async function handleCreate() {
    const eventDate = date ?? (dateInputText ? (() => {
      const m = dateInputText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
    })() : null);
    if (!title.trim()) {
      Alert.alert('Ошибка', 'Введите название');
      return;
    }
    if (!eventDate) {
      Alert.alert('Ошибка', 'Выберите дату');
      return;
    }
    if (!time.trim()) {
      Alert.alert('Ошибка', 'Введите время');
      return;
    }
    const range = toDatetimeRange(eventDate, time.trim());
    if (!range) {
      Alert.alert('Ошибка', 'Введите время в формате ЧЧ:ММ (например, 20:00)');
      return;
    }
    if (priceValue <= 0) {
      Alert.alert('Ошибка', 'Введите стоимость участия');
      return;
    }
    const max = maxParticipants ? Math.max(1, parseInt(maxParticipants) || 30) : 30;
    setIsSubmitting(true);
    try {
      await createEvent({
        title: title.trim(),
        description: description.trim(),
        datetime_start: range.start,
        datetime_end: range.end,
        price: priceValue,
        max_participants: max,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось создать событие');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
        {price && !isEditingPrice ? (
          <Pressable style={styles.priceDisplayWrap} onPress={() => setIsEditingPrice(true)}>
            <Text style={styles.priceDisplay}>
              Стоимость участия — {priceValue} ₽
            </Text>
          </Pressable>
        ) : (
          <TextInput
            value={price}
            onChangeText={(text) => setPrice(text.replace(/\D/g, ''))}
            style={styles.priceInput}
            placeholder="Стоимость участия"
            placeholderTextColor="#9B9B9B"
            keyboardType="numeric"
            onBlur={() => {
              if (price && parseInt(price) > 0) {
                setIsEditingPrice(false);
              }
            }}
          />
        )}
        {price && priceValue > 0 ? (
          <View style={styles.commissionInfo}>
            <Text style={styles.commissionText}>Комиссия 10%</Text>
            <Text style={styles.finalAmountText}>
              Вы получите {Math.round(finalAmount)} ₽
            </Text>
          </View>
        ) : (
          <Text style={styles.commissionText}>Комиссия 10%</Text>
        )}
      </View>

      <TextInput
        value={maxParticipants}
        onChangeText={(text) => setMaxParticipants(text.replace(/\D/g, ''))}
        style={styles.input}
        placeholder="Максимальное количество участников"
        placeholderTextColor="#9B9B9B"
        keyboardType="numeric"
      />

      <Pressable
        style={[styles.uploadButton, coverUri && styles.uploadWithPhotoContainer]}
        onPress={pickCover}
      >
        {coverUri ? (
          <View style={styles.uploadWithPhoto}>
            <Image source={{ uri: coverUri }} style={styles.coverImage} />
            <View style={styles.replacePhotoContainer}>
              <Text style={styles.replacePhotoText}>Заменить обложку</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.uploadButtonText}>Загрузить обложку</Text>
        )}
      </Pressable>

      <Pressable
        style={[styles.createButton, isSubmitting && styles.createButtonDisabled]}
        onPress={handleCreate}
        disabled={isSubmitting}
      >
        <Text style={styles.createButtonText}>
          {isSubmitting ? 'Создание...' : 'Создать событие'}
        </Text>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    minHeight: 52,
  },
  priceInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#181818',
    padding: 0,
    margin: 0,
    minHeight: 24,
    borderWidth: 0,
  },
  priceDisplayWrap: {
    flex: 1,
  },
  priceDisplay: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#181818',
    minHeight: 24,
    paddingVertical: 4,
  },
  commissionInfo: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  commissionText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#9B9B9B',
    marginBottom: 4,
  },
  finalAmountText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#181818',
  },
  uploadButton: {
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 16,
    alignItems: 'center',
    height: 52,
    marginBottom: 24,
  },
  uploadWithPhotoContainer: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  uploadWithPhoto: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
  },
  coverImage: {
    width: 96,
    height: 54,
    backgroundColor: '#E5E5E5',
  },
  replacePhotoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 16,
    height: 52,
  },
  replacePhotoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#181818',
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
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#FAFAFA',
  },
});
