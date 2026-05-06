import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { endpoints } from '@/constants/env';
import { clearAdminToken, getAdminToken } from '@/lib/admin-auth';

export default function AdminCommissionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commissionInput, setCommissionInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      const token = await getAdminToken();
      if (!token) { router.replace('/admin/login'); return; }
      try {
        const res = await fetch(endpoints.adminSettings, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) { await clearAdminToken(); router.replace('/admin/login'); return; }
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d?.message ?? `Ошибка загрузки (${res.status})`);
          return;
        }
        const data = await res.json();
        const rate = data.commissionRate ?? data.commission_rate ?? data.platformCommission ?? data.platform_commission;
        if (rate != null) setCommissionInput(String(rate));
      } catch {
        setError('Не удалось загрузить настройки');
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    const raw = commissionInput.trim().replace(',', '.');
    const value = parseFloat(raw);
    if (raw === '' || isNaN(value) || value < 0 || value > 100) {
      setSaveError('Введите число от 0 до 100');
      return;
    }
    const token = await getAdminToken();
    if (!token) { router.replace('/admin/login'); return; }
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const res = await fetch(`${endpoints.adminSettings}/commission`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commissionRate: value }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaveError(d?.message ?? `Ошибка (${res.status})`);
        return;
      }
      setSaveSuccess(true);
    } catch {
      setSaveError('Не удалось сохранить');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>КОМИССИИ</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); setError(''); }}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Платформенная комиссия</Text>
            <Text style={styles.sectionSubtitle}>
              Применяется ко всем наставникам, у которых не задана индивидуальная комиссия.
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Например: 15"
                placeholderTextColor="#9B9B9B"
                value={commissionInput}
                onChangeText={(t) => { setCommissionInput(t); setSaveError(''); setSaveSuccess(false); }}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
              <View style={styles.inputSuffix}>
                <Text style={styles.inputSuffixText}>%</Text>
              </View>
            </View>
            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
            {saveSuccess ? <Text style={styles.successText}>Сохранено</Text> : null}
            <Pressable
              style={[styles.saveBtn, isSaving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>Сохранить</Text>
              }
            </Pressable>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Индивидуальные комиссии наставников</Text>
            <Text style={styles.infoText}>
              Задаются на странице управления пользователями. Кнопка «%» рядом с каждым наставником.
              Если поле пустое — используется платформенная комиссия.
            </Text>
            <Pressable style={styles.usersBtn} onPress={() => router.push('/admin/users' as any)}>
              <Text style={styles.usersBtnText}>Перейти к пользователям</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#1E1E1E', gap: 12 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 28, lineHeight: 30, color: '#181818', marginTop: -2 },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  section: { borderWidth: 1, borderColor: '#1E1E1E', padding: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818', marginBottom: 6 },
  sectionSubtitle: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 16, lineHeight: 18 },
  inputRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#1E1E1E', marginBottom: 10 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 14, fontSize: 16, fontFamily: 'Inter-Regular', color: '#181818' },
  inputSuffix: { width: 44, borderLeftWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
  inputSuffixText: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#181818' },
  errorText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D', marginBottom: 10 },
  successText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#155724', backgroundColor: '#D4EDDA', paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  saveBtn: { backgroundColor: '#181818', height: 52, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter-Regular', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
  infoBox: { borderWidth: 1, borderColor: '#E5E5E5', padding: 16, backgroundColor: '#F8F8F8' },
  infoTitle: { fontSize: 14, fontFamily: 'Inter-Regular', fontWeight: '600', color: '#181818', marginBottom: 6 },
  infoText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#555', lineHeight: 18, marginBottom: 14 },
  usersBtn: { borderWidth: 1, borderColor: '#1E1E1E', height: 44, alignItems: 'center', justifyContent: 'center' },
  usersBtnText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  retryBtn: { borderWidth: 1, borderColor: '#181818', paddingVertical: 10, paddingHorizontal: 24 },
  retryText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
});
