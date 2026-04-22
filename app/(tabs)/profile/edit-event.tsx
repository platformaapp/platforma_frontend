import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { endpoints } from '@/constants/env';
import { updateEvent, uploadEventImage, type EventPatchBody } from '@/lib/api/events';
import { getAuthToken } from '@/lib/auth';

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function toDatetimeRange(date: Date, timeStr: string): { start: string; end: string } | null {
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, min, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function EditEventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loadingEvent, setLoadingEvent] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timeDate, setTimeDate] = useState<Date | null>(null);
  const [timeStr, setTimeStr] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [price, setPrice] = useState('');
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);   // local picked file
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null); // from API
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const webDateRef = useRef<any>(null);
  const webTimeRef = useRef<any>(null);

  const priceValue = price ? parseInt(price) || 0 : 0;
  const commission = priceValue * 0.1;
  const finalAmount = priceValue - commission;

  // Load existing event data
  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = async () => {
      try {
        const token = await getAuthToken();
        if (!token) { router.replace('/login'); return; }
        const res = await fetch(`${endpoints.events}/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Ошибка загрузки (${res.status})`);
        const data = await res.json() as Record<string, any>;
        // unwrap if needed
        const event = data?.data ?? data?.event ?? data;
        if (!active) return;
        setTitle(event.title ?? '');
        setDescription(event.description ?? '');
        if (event.price != null) {
          setPrice(String(event.price));
        }
        if (event.max_participants != null) {
          setMaxParticipants(String(event.max_participants));
        }
        const cover = event.coverUrl ?? event.cover_url ?? null;
        if (cover) setExistingCoverUrl(cover);
        const dtStart = event.datetime_start ?? event.datetimeStart;
        if (dtStart) {
          const d = new Date(dtStart);
          setDate(d);
          setTimeDate(d);
          setTimeStr(formatTime(d));
        }
      } catch (e: any) {
        if (active) Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить событие');
      } finally {
        if (active) setLoadingEvent(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id, router]);

  async function pickCover() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Ошибка', 'Необходимо разрешение на доступ к фотографиям'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setCoverUri(result.assets[0].uri);
  }

  async function handleSave() {
    if (!id) return;
    setStatusMessage(null);
    if (!title.trim()) { Alert.alert('Ошибка', 'Введите название'); return; }

    const patch: EventPatchBody = {};
    if (title.trim()) patch.title = title.trim();
    if (description.trim()) patch.description = description.trim();
    if (priceValue > 0) patch.price = priceValue;
    if (maxParticipants) patch.max_participants = Math.max(1, parseInt(maxParticipants) || 30);

    if (date && timeStr) {
      const range = toDatetimeRange(date, timeStr);
      if (!range) { Alert.alert('Ошибка', 'Неверный формат времени'); return; }
      patch.datetime_start = range.start;
    }

    setIsSubmitting(true);

    // Upload new cover if picked
    if (coverUri) {
      try {
        setStatusMessage('Загрузка обложки...');
        patch.coverUrl = await uploadEventImage(coverUri);
      } catch (uploadErr: any) {
        setStatusMessage(uploadErr?.message ?? 'Не удалось загрузить обложку');
        Alert.alert('Ошибка', uploadErr?.message ?? 'Не удалось загрузить обложку');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      setStatusMessage('Сохранение...');
      await updateEvent(id, patch);
      setStatusMessage('Изменения сохранены!');
      setTimeout(() => router.back(), 800);
    } catch (e: any) {
      const msg = e?.message ?? 'Не удалось сохранить изменения';
      setStatusMessage(msg);
      Alert.alert('Ошибка', msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleDateChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) setDate(selected);
  };

  const handleTimeChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selected) {
      setTimeDate(selected);
      setTimeStr(formatTime(selected));
    }
  };

  if (loadingEvent) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#181818" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <Path d="M15 18L9 12L15 6" stroke="#181818" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </Svg>
          </Pressable>
        </View>

        <Text style={styles.title}>РЕДАКТИРОВАТЬ СОБЫТИЕ</Text>

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

        {/* ── Date picker ─────────────────────────────────────────────── */}
        {Platform.OS === 'web' ? (
          <Pressable
            style={styles.input}
            onPress={() => { try { webDateRef.current?.showPicker?.(); } catch { webDateRef.current?.click?.(); } }}
          >
            <Text style={date ? styles.dateText : styles.placeholderText}>
              {date ? formatDate(date) : 'Дата'}
            </Text>
            <input
              ref={webDateRef}
              type="date"
              style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' } as any}
              onChange={(e: any) => {
                const v = e.target.value;
                if (v) {
                  const [y, mo, d] = v.split('-').map(Number);
                  setDate(new Date(y, mo - 1, d));
                }
              }}
            />
          </Pressable>
        ) : (
          <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text style={date ? styles.dateText : styles.placeholderText}>
              {date ? formatDate(date) : 'Дата'}
            </Text>
          </Pressable>
        )}

        {showDatePicker && Platform.OS === 'ios' && (
          <Modal transparent animationType="slide">
            <Pressable style={styles.pickerOverlay} onPress={() => setShowDatePicker(false)}>
              <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
                <View style={styles.pickerHeader}>
                  <Pressable onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.pickerDone}>Готово</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={date ?? new Date()}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  textColor="#181818"
                />
              </Pressable>
            </Pressable>
          </Modal>
        )}
        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker value={date ?? new Date()} mode="date" display="default" onChange={handleDateChange} />
        )}

        {/* ── Time picker ─────────────────────────────────────────────── */}
        {Platform.OS === 'web' ? (
          <Pressable
            style={styles.input}
            onPress={() => { try { webTimeRef.current?.showPicker?.(); } catch { webTimeRef.current?.click?.(); } }}
          >
            <Text style={timeStr ? styles.dateText : styles.placeholderText}>
              {timeStr || 'Время'}
            </Text>
            <input
              ref={webTimeRef}
              type="time"
              style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' } as any}
              onChange={(e: any) => { const v = e.target.value; if (v) setTimeStr(v); }}
            />
          </Pressable>
        ) : (
          <Pressable style={styles.input} onPress={() => setShowTimePicker(true)}>
            <Text style={timeStr ? styles.dateText : styles.placeholderText}>
              {timeStr || 'Время'}
            </Text>
          </Pressable>
        )}

        {showTimePicker && Platform.OS === 'ios' && (
          <Modal transparent animationType="slide">
            <Pressable style={styles.pickerOverlay} onPress={() => setShowTimePicker(false)}>
              <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
                <View style={styles.pickerHeader}>
                  <Pressable onPress={() => setShowTimePicker(false)}>
                    <Text style={styles.pickerDone}>Готово</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={timeDate ?? (() => { const d = new Date(); d.setHours(18, 0, 0, 0); return d; })()}
                  mode="time"
                  display="spinner"
                  minuteInterval={15}
                  onChange={handleTimeChange}
                  textColor="#181818"
                />
              </Pressable>
            </Pressable>
          </Modal>
        )}
        {showTimePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={timeDate ?? (() => { const d = new Date(); d.setHours(18, 0, 0, 0); return d; })()}
            mode="time"
            display="default"
            minuteInterval={15}
            onChange={handleTimeChange}
          />
        )}

        {/* ── Price ───────────────────────────────────────────────────── */}
        <View style={styles.priceRow}>
          {price && !isEditingPrice ? (
            <Pressable style={styles.priceDisplayWrap} onPress={() => setIsEditingPrice(true)}>
              <Text style={styles.priceDisplay}>Стоимость участия — {priceValue} ₽</Text>
            </Pressable>
          ) : (
            <TextInput
              value={price}
              onChangeText={(t) => setPrice(t.replace(/\D/g, ''))}
              style={styles.priceInput}
              placeholder="Стоимость участия"
              placeholderTextColor="#9B9B9B"
              keyboardType="numeric"
              onBlur={() => { if (price && parseInt(price) > 0) setIsEditingPrice(false); }}
            />
          )}
          {price && priceValue > 0 ? (
            <View style={styles.commissionInfo}>
              <Text style={styles.commissionText}>Комиссия 10%</Text>
              <Text style={styles.finalAmountText}>Вы получите {Math.round(finalAmount)} ₽</Text>
            </View>
          ) : (
            <Text style={styles.commissionText}>Комиссия 10%</Text>
          )}
        </View>

        <TextInput
          value={maxParticipants}
          onChangeText={(t) => setMaxParticipants(t.replace(/\D/g, ''))}
          style={styles.input}
          placeholder="Максимальное количество участников"
          placeholderTextColor="#9B9B9B"
          keyboardType="numeric"
        />

        {/* ── Cover image ─────────────────────────────────────────────── */}
        <Pressable
          style={[styles.uploadButton, (coverUri || existingCoverUrl) && styles.uploadWithPhotoContainer]}
          onPress={pickCover}
        >
          {coverUri || existingCoverUrl ? (
            <View style={styles.uploadWithPhoto}>
              <Image source={{ uri: coverUri ?? existingCoverUrl! }} style={styles.coverImage} />
              <View style={styles.replacePhotoContainer}>
                <Text style={styles.replacePhotoText}>Заменить обложку</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.uploadButtonText}>Загрузить обложку</Text>
          )}
        </Pressable>

        {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}

        <Pressable
          style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          <Text style={styles.saveButtonText}>
            {isSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  header: { paddingTop: 16 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 8, marginBottom: 16, fontSize: 20, lineHeight: 26, fontFamily: 'Inter-Regular', color: '#181818' },
  input: {
    borderWidth: 1, borderColor: '#1E1E1E',
    paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular',
    color: '#181818', marginBottom: 12,
    justifyContent: 'center', position: 'relative',
  },
  dateText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  placeholderText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  textArea: { minHeight: 96, paddingTop: 12 },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E5E5E5' },
  pickerDone: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#E02D2D' },

  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#1E1E1E', paddingVertical: 14, paddingHorizontal: 12, marginBottom: 12, minHeight: 52 },
  priceInput: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818', padding: 0, margin: 0, minHeight: 24, borderWidth: 0 },
  priceDisplayWrap: { flex: 1 },
  priceDisplay: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818', minHeight: 24, paddingVertical: 4 },
  commissionInfo: { alignItems: 'flex-end', marginLeft: 12 },
  commissionText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#9B9B9B', marginBottom: 4 },
  finalAmountText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#181818' },

  uploadButton: { borderWidth: 1, borderColor: '#1E1E1E', paddingVertical: 16, alignItems: 'center', height: 52, marginBottom: 24 },
  uploadWithPhotoContainer: { paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' },
  uploadWithPhoto: { flexDirection: 'row', width: '100%', alignItems: 'center' },
  coverImage: { width: 96, height: 54, backgroundColor: '#E5E5E5' },
  replacePhotoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingLeft: 16, height: 52 },
  replacePhotoText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  uploadButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },

  statusMessage: { marginTop: 12, marginBottom: 8, fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818', textAlign: 'center' },
  saveButton: { marginTop: 12, marginBottom: 24, backgroundColor: '#111', paddingVertical: 16, alignItems: 'center', height: 52 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#FAFAFA' },
});
