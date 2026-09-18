import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { endpoints } from '@/constants/env';
import { clearAdminToken, getAdminToken } from '@/lib/admin-auth';

/**
 * Дата в поле "от"/"до" — просто YYYY-MM-DD, отправляем как есть в query
 * (бэкенд сам парсит через `new Date(...)`). Оба поля можно оставить
 * пустыми — тогда выгрузка за весь период.
 */
export default function AdminPaymentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload() {
    setDownloading(true);
    setError('');
    try {
      const token = await getAdminToken();
      if (!token) { router.replace('/admin/login'); return; }

      const params = new URLSearchParams();
      if (from.trim()) params.set('from', from.trim());
      if (to.trim()) params.set('to', to.trim());
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
          <TextInput
            style={[styles.input, styles.dateInput]}
            value={from}
            onChangeText={setFrom}
            placeholder="От: ГГГГ-ММ-ДД"
            placeholderTextColor="#9B9B9B"
          />
          <TextInput
            style={[styles.input, styles.dateInput]}
            value={to}
            onChangeText={setTo}
            placeholder="До: ГГГГ-ММ-ДД"
            placeholderTextColor="#9B9B9B"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={[styles.downloadBtn, downloading && styles.btnDisabled]} onPress={handleDownload} disabled={downloading}>
          {downloading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.downloadBtnText}>Скачать CSV</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#1E1E1E', gap: 12 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 28, lineHeight: 30, color: '#181818', marginTop: -2 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818' },

  content: { padding: 16 },
  description: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter-Regular', color: '#687076', marginBottom: 20 },
  label: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 8 },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  dateInput: { flex: 1 },
  input: {
    borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818', backgroundColor: '#FAFAFA',
  },
  errorText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D', marginBottom: 12 },
  downloadBtn: { backgroundColor: '#181818', paddingVertical: 14, alignItems: 'center' },
  downloadBtnText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#fff', fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
});
