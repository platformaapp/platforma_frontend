import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  deleteTutorSlots,
  getTutorSlots,
  type Slot,
} from '@/lib/api/tutor';
import { dayFromDate, toDisplayDate } from '@/lib/slots-utils';

export default function SlotsScreen() {
  const router = useRouter();
  const [slots, setSlotsState] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [slotsBeforeDelete, setSlotsBeforeDelete] = useState<Slot[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      getTutorSlots()
        .then((data) => {
          if (!cancelled) setSlotsState(data);
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

  function enterDeleteMode() {
    setSlotsBeforeDelete([...slots]);
    setIsDeleteMode(true);
  }

  function exitDeleteMode() {
    setIsDeleteMode(false);
  }

  function handleCancel() {
    setSlotsState([...slotsBeforeDelete]);
    exitDeleteMode();
  }

  async function handleSaveDelete() {
    const beforeIds = new Set(slotsBeforeDelete.map((s) => s.id));
    const currentIds = new Set(slots.map((s) => s.id));
    const toRemove = [...beforeIds].filter((id) => !currentIds.has(id));

    if (toRemove.length === 0) {
      exitDeleteMode();
      return;
    }

    setSaving(true);
    try {
      await deleteTutorSlots(toRemove);
      setSlotsState((prev) => prev.filter((s) => !toRemove.includes(s.id)));
      exitDeleteMode();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить слоты');
    } finally {
      setSaving(false);
    }
  }

  function removeSlot(id: string) {
    setSlotsState((prev) => prev.filter((s) => s.id !== id));
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
        <Text style={styles.title}>Редактировать слоты</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {slots.map((slot) => (
          <View key={slot.id} style={styles.slotRow}>
            {isDeleteMode && (
              <Pressable
                style={styles.deleteButton}
                onPress={() => removeSlot(slot.id)}
              >
                <MaterialIcons name="close" size={24} color="#E02D2D" />
              </Pressable>
            )}
            <View style={[styles.slotCellDate, isDeleteMode && styles.slotCellWithDelete]}>
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

        {isDeleteMode ? (
          <>
            <Pressable
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={handleSaveDelete}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>{saving ? 'Сохранение...' : 'Сохранить'}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handleCancel} disabled={saving}>
              <Text style={styles.secondaryButtonText}>Отмена</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/(tabs)/profile/add-slot')}
            >
              <Text style={styles.primaryButtonText}>Добавить слот</Text>
            </Pressable>
            <Pressable style={styles.deleteModeButton} onPress={enterDeleteMode}>
              <Text style={styles.deleteModeButtonText}>Удалить слоты</Text>
            </Pressable>
          </>
        )}
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
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 12,
    backgroundColor: '#fff',
    minHeight: 52,
  },
  deleteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotCellDate: {
    flex: 1.6,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  slotCellWithDelete: {
    flex: 1.4,
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
  deleteModeButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E02D2D',
    paddingVertical: 16,
    alignItems: 'center',
    height: 52,
  },
  deleteModeButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#E02D2D',
  },
});
