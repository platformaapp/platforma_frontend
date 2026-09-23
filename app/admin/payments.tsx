import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { endpoints } from '@/constants/env';
import { clearAdminToken, getAdminToken } from '@/lib/admin-auth';

function toApiDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
}

/**
 * Дата в поле "от"/"до" отправляется как YYYY-MM-DD (бэкенд сам парсит через
 * `new Date(...)`). Оба поля можно оставить пустыми — тогда выгрузка за весь
 * период.
 */
export default function AdminPaymentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const webFromRef = useRef<any>(null);
  const webToRef = useRef<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload() {
    setDownloading(true);
    setError('');
    try {
      const token = await getAdminToken();
      if (!token) { router.replace('/admin/login'); return; }

      const params = new URLSearchParams();
      if (from) params.set('from', toApiDate(from));
      if (to) params.set('to', toApiDate(to));
      const url = params.toString() ? `${endpoints.adminPaymentsExport}?${params}` : endpoints.adminPaymentsExport;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { await clearAdminToken(); router.replace('/admin/login'); return; }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message ?? `Ошибка ${res.status}`);
      }

      if (Platform.OS === 'web') {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `payments_export_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
      } else {
        setError('Скачивание файла пока доступно только в веб-версии админки');
      }
    } catch (e) {
      setError((e as Error)?.message ?? 'Не удалось выгрузить платежи');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>ПЛАТЕЖИ</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          Выгрузка всех платежей (сессии с наставниками + мероприятия) в CSV: суммы, статусы,
          карта плательщика, а также лекция и спикер, к которым относится платёж.
        </Text>

        <Text style={styles.label}>Период (необязательно — по умолчанию весь)</Text>
        <View style={styles.dateRow}>
          {Platform.OS === 'web' ? (
            <Pressable
              style={[styles.input, styles.dateInput]}
              onPress={() => { try { webFromRef.current?.showPicker?.(); } catch { webFromRef.current?.click?.(); } }}
            >
              <Text style={from ? styles.dateText : styles.placeholderText}>{from ? formatDisplayDate(from) : 'От'}</Text>
              <input
                ref={webFromRef}
                type="date"
                style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' } as any}
                onChange={(e: any) => {
                  const v = e.target.value;
                  if (!v) return;
                  const [y, mo, d] = v.split('-').map(Number);
                  setFrom(new Date(y, mo - 1, d));
                }}
              />
            </Pressable>
          ) : (
            <Pressable style={[styles.input, styles.dateInput]} onPress={() => setShowFromPicker(true)}>
              <Text style={from ? styles.dateText : styles.placeholderText}>{from ? formatDisplayDate(from) : 'От'}</Text>
            </Pressable>
          )}
          {Platform.OS === 'web' ? (
            <Pressable
              style={[styles.input, styles.dateInput]}
              onPress={() => { try { webToRef.current?.showPicker?.(); } catch { webToRef.current?.click?.(); } }}
            >
              <Text style={to ? styles.dateText : styles.placeholderText}>{to ? formatDisplayDate(to) : 'До'}</Text>
              <input
                ref={webToRef}
                type="date"
                style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' } as any}
                onChange={(e: any) => {
                  const v = e.target.value;
                  if (!v) return;
                  const [y, mo, d] = v.split('-').map(Number);
                  setTo(new Date(y, mo - 1, d));
                }}
              />
            </Pressable>
          ) : (
            <Pressable style={[styles.input, styles.dateInput]} onPress={() => setShowToPicker(true)}>
              <Text style={to ? styles.dateText : styles.placeholderText}>{to ? formatDisplayDate(to) : 'До'}</Text>
            </Pressable>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={[styles.downloadBtn, downloading && styles.btnDisabled]} onPress={handleDownload} disabled={downloading}>
          {downloading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.downloadBtnText}>Скачать CSV</Text>}
        </Pressable>
      </View>

      {showFromPicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <Pressable style={styles.pickerOverlay} onPress={() => setShowFromPicker(false)}>
            <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.pickerHeader}>
                <Pressable onPress={() => setShowFromPicker(false)}><Text style={styles.pickerDone}>Готово</Text></Pressable>
              </View>
              <DateTimePicker
                value={from ?? new Date()}
                mode="date"
                display="spinner"
                onChange={(_e, d) => { if (d) setFrom(d); }}
                textColor="#181818"
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
      {showFromPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={from ?? new Date()}
          mode="date"
          display="default"
          onChange={(_e, d) => { setShowFromPicker(false); if (d) setFrom(d); }}
        />
      )}
      {showToPicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <Pressable style={styles.pickerOverlay} onPress={() => setShowToPicker(false)}>
            <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.pickerHeader}>
                <Pressable onPress={() => setShowToPicker(false)}><Text style={styles.pickerDone}>Готово</Text></Pressable>
              </View>
              <DateTimePicker
                value={to ?? new Date()}
                mode="date"
                display="spinner"
                onChange={(_e, d) => { if (d) setTo(d); }}
                textColor="#181818"
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
      {showToPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={to ?? new Date()}
          mode="date"
          display="default"
          onChange={(_e, d) => { setShowToPicker(false); if (d) setTo(d); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#1E1E1E', gap: 12 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 28, lineHeight: 30, color: '#181818', marginTop: -2 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#181818' },

  content: { padding: 16 },
  description: { fontSize: 13, lineHeight: 19, fontFamily: 'Gramatika-Regular', color: '#687076', marginBottom: 20 },
  label: { fontSize: 12, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginBottom: 8 },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  dateInput: { flex: 1 },
  input: {
    borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#181818', backgroundColor: '#FAFAFA',
    justifyContent: 'center', position: 'relative',
  },
  dateText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#181818' },
  placeholderText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#9B9B9B' },
  errorText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#E02D2D', marginBottom: 12 },
  downloadBtn: { backgroundColor: '#181818', paddingVertical: 14, alignItems: 'center' },
  downloadBtnText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#fff', fontWeight: 'normal' },
  btnDisabled: { opacity: 0.6 },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#fff', paddingBottom: 32 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E5E5E5' },
  pickerDone: { fontSize: 16, lineHeight: 22, fontFamily: 'Gramatika-Regular', color: '#181818' },
});
