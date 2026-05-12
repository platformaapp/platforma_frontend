import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { AuthError } from '@/lib/api/auth-error';
import { createTutorSlot, getTutorSlots, type Slot } from '@/lib/api/tutor';
import { toDisplayDate, dayFromDate } from '@/lib/slots-utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toApiDateFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatSlotDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(2);
  return `${day}.${month}.${year}`;
}

const MONTHS_SHORT = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const WEEKDAYS_SHORT = ['вс','пн','вт','ср','чт','пт','сб'];

function slotDayLabel(d: Date): string {
  return WEEKDAYS_SHORT[d.getDay()].toUpperCase();
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DraftSlot {
  id: number;
  date: Date | null;
  time: Date | null;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

let nextId = 1;
function mkDraft(): DraftSlot {
  return { id: nextId++, date: null, time: null };
}

export default function AddSlotScreen() {
  const router = useRouter();
  const [existingSlots, setExistingSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<DraftSlot[]>([mkDraft()]);

  // Picker state — one shared picker for all draft slots
  const [pickerTarget, setPickerTarget] = useState<{ slotId: number; mode: 'date' | 'time' } | null>(null);
  const [pickerTempDate, setPickerTempDate] = useState<Date>(new Date());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getTutorSlots()
        .then((data) => { if (!cancelled) setExistingSlots(data); })
        .catch((e) => {
          if (!cancelled) {
            if (e instanceof AuthError || e?.name === 'AuthError') { router.replace('/login'); return; }
            Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить слоты');
          }
        })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [router])
  );

  function openPicker(slotId: number, mode: 'date' | 'time') {
    const draft = drafts.find((d: DraftSlot) => d.id === slotId);
    if (!draft) return;
    let initial: Date;
    if (mode === 'date') {
      initial = draft.date ?? new Date();
    } else {
      initial = draft.time ?? (() => { const d = new Date(); d.setHours(9, 0, 0, 0); return d; })();
    }
    setPickerTempDate(initial);
    setPickerTarget({ slotId, mode });
  }

  function commitPicker(date: Date) {
    if (!pickerTarget) return;
    setDrafts((prev: DraftSlot[]) =>
      prev.map((d: DraftSlot) =>
        d.id === pickerTarget.slotId
          ? { ...d, [pickerTarget.mode === 'date' ? 'date' : 'time']: date }
          : d
      )
    );
  }

  function closePicker() {
    setPickerTarget(null);
  }

  function addDraft() {
    setDrafts((prev: DraftSlot[]) => [...prev, mkDraft()]);
  }

  function removeDraft(id: number) {
    setDrafts((prev: DraftSlot[]) => prev.filter((d: DraftSlot) => d.id !== id));
  }

  async function handleSave() {
    const ready = drafts.filter((d) => d.date && d.time);
    if (ready.length === 0) {
      Alert.alert('Внимание', 'Выберите дату и время хотя бы для одного слота');
      return;
    }

    const normalizeTime = (t: string) => t.slice(0, 5);
    const allSlots = existingSlots.map((s: Slot) => ({ date: s.date, time: normalizeTime(s.time) }));

    const items: { date: string; time: string }[] = [];
    for (const d of ready) {
      const apiDate = toApiDateFromDate(d.date!);
      const apiTime = toTimeStr(d.time!);
      const norm = normalizeTime(apiTime);
      if (allSlots.some((s: { date: string; time: string }) => s.date === apiDate && s.time === norm) ||
          items.some((s: { date: string; time: string }) => s.date === apiDate && normalizeTime(s.time) === norm)) {
        Alert.alert('Ошибка', `Время ${formatSlotDate(d.date!)} ${apiTime} уже занято`);
        return;
      }
      allSlots.push({ date: apiDate, time: norm });
      items.push({ date: apiDate, time: apiTime });
    }

    setSaving(true);
    try {
      for (const item of items) {
        await createTutorSlot(item);
      }
      const data = await getTutorSlots();
      setExistingSlots(data);
      setDrafts([mkDraft()]);
      Alert.alert('Слоты сохранены');
    } catch (e: any) {
      if (e instanceof AuthError || e?.name === 'AuthError') { router.replace('/login'); return; }
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
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="chevron-left" size={24} color="#181818" />
        </Pressable>
        <Text style={styles.title}>Добавить слот</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Existing slots */}
        {existingSlots.map((slot) => (
          <View key={slot.id} style={styles.slotRow}>
            <View style={styles.slotCellDate}>
              <Text style={styles.slotText}>{toDisplayDate(slot.date)}</Text>
            </View>
            <View style={styles.slotCellDay}>
              <Text style={styles.slotText}>{dayFromDate(slot.date)}</Text>
            </View>
            <View style={styles.slotCellTime}>
              <Text style={styles.slotText}>{slot.time.slice(0, 5)}</Text>
            </View>
          </View>
        ))}

        {/* Draft slots */}
        {drafts.map((draft, idx) => (
          <View key={draft.id} style={styles.draftRow}>
            <View style={styles.draftFields}>
              {/* Date button */}
              <Pressable
                style={[styles.pickerBtn, styles.pickerBtnDate]}
                onPress={() => openPicker(draft.id, 'date')}
              >
                <Text style={draft.date ? styles.pickerBtnText : styles.pickerBtnPlaceholder}>
                  {draft.date ? formatSlotDate(draft.date) : 'Дата'}
                </Text>
              </Pressable>

              {/* Day label */}
              <View style={styles.draftDayCell}>
                <Text style={styles.slotText}>{draft.date ? slotDayLabel(draft.date) : ''}</Text>
              </View>

              {/* Time button */}
              <Pressable
                style={[styles.pickerBtn, styles.pickerBtnTime]}
                onPress={() => openPicker(draft.id, 'time')}
              >
                <Text style={draft.time ? styles.pickerBtnText : styles.pickerBtnPlaceholder}>
                  {draft.time ? toTimeStr(draft.time) : 'Время'}
                </Text>
              </Pressable>
            </View>

            {/* Remove button (only when more than one draft) */}
            {drafts.length > 1 && (
              <Pressable style={styles.removeBtn} onPress={() => removeDraft(draft.id)}>
                <MaterialIcons name="close" size={18} color="#9B9B9B" />
              </Pressable>
            )}
          </View>
        ))}

        {/* Add more */}
        <Pressable style={styles.addMoreBtn} onPress={addDraft}>
          <MaterialIcons name="add" size={18} color="#181818" />
          <Text style={styles.addMoreText}>Добавить ещё слот</Text>
        </Pressable>

        {/* Actions */}
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

      {/* ── iOS date/time modal ─────────────────────────────────────────── */}
      {pickerTarget && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <Pressable style={styles.pickerOverlay} onPress={closePicker}>
            <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.pickerHeader}>
                <Pressable onPress={closePicker}>
                  <Text style={styles.pickerDone}>Готово</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={pickerTempDate}
                mode={pickerTarget.mode}
                display="spinner"
                minimumDate={pickerTarget.mode === 'date' ? new Date() : undefined}
                minuteInterval={pickerTarget.mode === 'time' ? 5 : undefined}
                onChange={(_e, d) => {
                  if (d) { setPickerTempDate(d); commitPicker(d); }
                }}
                textColor="#181818"
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ── Android date/time picker ────────────────────────────────────── */}
      {pickerTarget && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerTempDate}
          mode={pickerTarget.mode}
          display="default"
          minimumDate={pickerTarget.mode === 'date' ? new Date() : undefined}
          minuteInterval={pickerTarget.mode === 'time' ? 5 : undefined}
          onChange={(_e, d) => {
            closePicker();
            if (d) commitPicker(d);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 40 },
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
    paddingBottom: 32,
    flexGrow: 1,
    justifyContent: 'center',
  },
  slotRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    marginBottom: 8,
    minHeight: 52,
    backgroundColor: '#fff',
  },
  slotCellDate: { flex: 1.6, justifyContent: 'center', paddingHorizontal: 12 },
  slotCellDay: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#1E1E1E',
  },
  slotCellTime: { flex: 1, justifyContent: 'center', paddingHorizontal: 12 },
  slotText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },

  draftRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  draftFields: { flex: 1, flexDirection: 'row', borderWidth: 1, borderColor: '#1E1E1E', minHeight: 52 },
  pickerBtn: { justifyContent: 'center', paddingHorizontal: 12 },
  pickerBtnDate: { flex: 1.6 },
  pickerBtnTime: { flex: 1 },
  pickerBtnText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },
  pickerBtnPlaceholder: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#9B9B9B' },
  draftDayCell: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#1E1E1E',
  },
  removeBtn: { width: 36, alignItems: 'center', justifyContent: 'center', paddingLeft: 8 },

  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  addMoreText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },

  primaryButton: {
    marginTop: 16,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#111',
    paddingVertical: 16,
    alignItems: 'center',
    height: 52,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#FAFAFA' },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 16,
    alignItems: 'center',
    height: 52,
  },
  secondaryButtonText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-Regular', color: '#181818' },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#fff', paddingBottom: 32 },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#E5E5E5',
  },
  pickerDone: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter-Regular', color: '#181818' },
});
