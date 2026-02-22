import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  createTutorSlot,
  getTutorSlots,
  type Slot,
} from '@/lib/api/tutor';
import { digitsToApiDate, digitsToTime, toApiDate, toDisplayDate, dayFromDate } from '@/lib/slots-utils';

export default function AddSlotScreen() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newDate1, setNewDate1] = useState('');
  const [newTime1, setNewTime1] = useState('');
  const [newDate2, setNewDate2] = useState('');
  const [newTime2, setNewTime2] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getTutorSlots()
        .then((data) => {
          if (!cancelled) setSlots(data);
        })
        .catch((e) => {
          if (!cancelled) Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить слоты');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [])
  );

  async function handleSave() {
    const raw = [
      { date: newDate1, time: newTime1 },
      { date: newDate2, time: newTime2 },
    ];
    const items = raw
      .filter((x) => x.date.trim() && x.time.trim())
        .map((x) => {
        const digitsDate = x.date.replace(/\D/g, '');
        const apiDate = digitsToApiDate(digitsDate) ?? toApiDate(x.date.trim());
        const time = digitsToTime(x.time.trim());
        return apiDate && time ? { date: apiDate, time } : null;
      })
      .filter((x): x is { date: string; time: string } => x !== null);

    if (items.length === 0) {
      Alert.alert('Внимание', 'Введите дату (ДД.ММ.ГГ или ДДММГГ) и время (ЧЧ:ММ или ЧЧММ) для новых слотов');
      return;
    }

    setSaving(true);
    try {
      for (const item of items) {
        await createTutorSlot(item);
      }
      setNewDate1('');
      setNewTime1('');
      setNewDate2('');
      setNewTime2('');
      const data = await getTutorSlots();
      setSlots(data);
      Alert.alert('Слоты сохранены');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось добавить слоты');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#181818" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="chevron-left" size={24} color="#181818" />
        </Pressable>
        <Text style={styles.title}>Добавить слот</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {slots.map((slot) => (
          <View key={slot.id} style={styles.slotRow}>
            <View style={styles.slotCellDate}>
              <Text style={styles.slotText}>{toDisplayDate(slot.date)}</Text>
            </View>
            <View style={styles.slotCellDay}>
              <Text style={styles.slotText}>{dayFromDate(slot.date)}</Text>
            </View>
            <View style={styles.slotCellTime}>
              <Text style={styles.slotText}>{slot.time}</Text>
            </View>
          </View>
        ))}
        <View style={styles.slotRow}>
          <View style={styles.slotCellDate}>
            <TextInput
              style={styles.slotInput}
              placeholder="Дата (ДД.ММ.ГГ)"
              placeholderTextColor="#9B9B9B"
              value={newDate1}
              onChangeText={(t) => setNewDate1(t.replace(/\D/g, '').slice(0, 8))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.slotCellDay} />
          <View style={styles.slotCellTime}>
            <TextInput
              style={styles.slotInput}
              placeholder="Время (ЧЧММ)"
              placeholderTextColor="#9B9B9B"
              value={newTime1}
              onChangeText={(t) => setNewTime1(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.slotRow}>
          <View style={styles.slotCellDate}>
            <TextInput
              style={styles.slotInput}
              placeholder="Дата (ДД.ММ.ГГ)"
              placeholderTextColor="#9B9B9B"
              value={newDate2}
              onChangeText={(t) => setNewDate2(t.replace(/\D/g, '').slice(0, 8))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.slotCellDay} />
          <View style={styles.slotCellTime}>
            <TextInput
              style={styles.slotInput}
              placeholder="Время (ЧЧММ)"
              placeholderTextColor="#9B9B9B"
              value={newTime2}
              onChangeText={(t) => setNewTime2(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="numeric"
            />
          </View>
        </View>

        <Pressable
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>{saving ? 'Сохранение...' : 'Сохранить'}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()} disabled={saving}>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  buttonDisabled: {
    opacity: 0.6,
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
