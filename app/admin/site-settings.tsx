import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clearAdminToken, getAdminToken } from '@/lib/admin-auth';
import {
  getAdminSiteSettings,
  updateSiteSettings,
  type BannerSetting,
  type NavItemSetting,
  type PartnerSetting,
} from '@/lib/api/site-settings';

const NAV_SLOT_LABELS = ['События', 'Наставники', 'Мои записи', 'Журнал', 'Личный кабинет'];

function emptyNavItems(): NavItemSetting[] {
  return NAV_SLOT_LABELS.map((label) => ({ label, iconUrl: '' }));
}

export default function AdminSiteSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [navItems, setNavItems] = useState<NavItemSetting[]>(emptyNavItems());
  const [banner, setBanner] = useState<BannerSetting>({});
  const [partners, setPartners] = useState<PartnerSetting[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');

  useEffect(() => {
    (async () => {
      const token = await getAdminToken();
      if (!token) { router.replace('/admin/login'); return; }
      try {
        const s = await getAdminSiteSettings();
        setNavItems(s.navItems.length === 5 ? s.navItems : emptyNavItems());
        setBanner(s.banner ?? {});
        setPartners(s.partners ?? []);
        setTopics(s.topics ?? []);
      } catch {
        setError('Не удалось загрузить настройки');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    const token = await getAdminToken();
    if (!token) { router.replace('/admin/login'); return; }
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      await updateSiteSettings({ navItems, banner, partners, topics });
      setSaveSuccess(true);
    } catch (e: any) {
      if (e?.message?.toLowerCase?.().includes('unauthorized')) {
        await clearAdminToken();
        router.replace('/admin/login');
        return;
      }
      setSaveError(e?.message ?? 'Не удалось сохранить');
    } finally {
      setIsSaving(false);
    }
  }

  function updateNavItem(index: number, patch: Partial<NavItemSetting>) {
    setNavItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function updatePartner(index: number, patch: Partial<PartnerSetting>) {
    setPartners((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPartner() {
    setPartners((prev) => [...prev, { name: '', logoUrl: '', linkUrl: '' }]);
  }

  function removePartner(index: number) {
    setPartners((prev) => prev.filter((_, i) => i !== index));
  }

  function addTopic() {
    const t = newTopic.trim();
    if (!t || topics.includes(t)) return;
    setTopics((prev) => [...prev, t]);
    setNewTopic('');
  }

  function removeTopic(t: string) {
    setTopics((prev) => prev.filter((x) => x !== t));
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>НАСТРОЙКИ САЙТА</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#181818" /></View>
      ) : error ? (
        <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Навигация */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Навигация</Text>
            <Text style={styles.sectionSubtitle}>
              Текст пунктов меню и (опционально) своя иконка вместо стандартной — ссылка на картинку.
            </Text>
            {navItems.map((item, i) => (
              <View key={i} style={styles.navRow}>
                <Text style={styles.navSlotLabel}>{NAV_SLOT_LABELS[i]}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Текст пункта меню"
                  placeholderTextColor="#9B9B9B"
                  value={item.label}
                  onChangeText={(t) => updateNavItem(i, { label: t })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Ссылка на иконку (необязательно)"
                  placeholderTextColor="#9B9B9B"
                  value={item.iconUrl}
                  onChangeText={(t) => updateNavItem(i, { iconUrl: t })}
                  autoCapitalize="none"
                />
              </View>
            ))}
          </View>

          {/* Баннер */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Баннер</Text>
            <Text style={styles.sectionSubtitle}>Картинка и ссылка баннера на главной. Если не заполнено — стандартный баннер.</Text>
            <TextInput
              style={styles.input}
              placeholder="Ссылка на картинку баннера"
              placeholderTextColor="#9B9B9B"
              value={banner.imageUrl ?? ''}
              onChangeText={(t) => setBanner((b) => ({ ...b, imageUrl: t }))}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Ссылка при клике на баннер"
              placeholderTextColor="#9B9B9B"
              value={banner.linkUrl ?? ''}
              onChangeText={(t) => setBanner((b) => ({ ...b, linkUrl: t }))}
              autoCapitalize="none"
            />
          </View>

          {/* Партнёры */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Партнёры</Text>
            <Text style={styles.sectionSubtitle}>
              Список заменяет блок «Наши большие друзья» на главной и у наставников. Если список пуст — показывается стандартный.
            </Text>
            {partners.map((p, i) => (
              <View key={i} style={styles.partnerRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Название"
                  placeholderTextColor="#9B9B9B"
                  value={p.name}
                  onChangeText={(t) => updatePartner(i, { name: t })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Ссылка на лого"
                  placeholderTextColor="#9B9B9B"
                  value={p.logoUrl}
                  onChangeText={(t) => updatePartner(i, { logoUrl: t })}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Ссылка (необязательно)"
                  placeholderTextColor="#9B9B9B"
                  value={p.linkUrl ?? ''}
                  onChangeText={(t) => updatePartner(i, { linkUrl: t })}
                  autoCapitalize="none"
                />
                <Pressable style={styles.removeBtn} onPress={() => removePartner(i)}>
                  <Text style={styles.removeBtnText}>Удалить</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addBtn} onPress={addPartner}>
              <Text style={styles.addBtnText}>+ Добавить партнёра</Text>
            </Pressable>
          </View>

          {/* Рубрикатор */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Рубрикатор</Text>
            <Text style={styles.sectionSubtitle}>
              Темы для наставников и событий. Если список пуст — показывается стандартный набор тем.
            </Text>
            <View style={styles.topicsWrap}>
              {topics.map((t) => (
                <Pressable key={t} style={styles.topicChip} onPress={() => removeTopic(t)}>
                  <Text style={styles.topicChipText}>{t} ✕</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.topicAddRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Новая тема"
                placeholderTextColor="#9B9B9B"
                value={newTopic}
                onChangeText={setNewTopic}
                onSubmitEditing={addTopic}
              />
              <Pressable style={styles.addBtn} onPress={addTopic}>
                <Text style={styles.addBtnText}>+ Добавить</Text>
              </Pressable>
            </View>
          </View>

          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
          {saveSuccess ? <Text style={styles.successText}>Сохранено</Text> : null}
          <Pressable style={[styles.saveBtn, isSaving && styles.btnDisabled]} onPress={handleSave} disabled={isSaving}>
            {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Сохранить</Text>}
          </Pressable>
        </ScrollView>
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
  headerTitle: { fontSize: 18, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#181818' },
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 48 },
  section: { borderWidth: 1, borderColor: '#1E1E1E', padding: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#181818', marginBottom: 6 },
  sectionSubtitle: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginBottom: 16, lineHeight: 18 },
  input: { borderWidth: 1, borderColor: '#1E1E1E', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#181818' },
  navRow: { marginBottom: 14, gap: 6 },
  navSlotLabel: { fontSize: 12, fontFamily: 'Gramatika-Regular', color: '#687076' },
  partnerRow: { marginBottom: 14, gap: 6, borderBottomWidth: 1, borderColor: '#E5E5E5', paddingBottom: 14 },
  removeBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  removeBtnText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#E02D2D', textDecorationLine: 'underline' },
  addBtn: { borderWidth: 1, borderColor: '#1E1E1E', paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start' },
  addBtnText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#181818' },
  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  topicChip: { borderWidth: 1, borderColor: '#1E1E1E', paddingVertical: 6, paddingHorizontal: 10 },
  topicChipText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#181818' },
  topicAddRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  errorText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#E02D2D', marginBottom: 10 },
  successText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#155724', backgroundColor: '#D4EDDA', paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  saveBtn: { backgroundColor: '#181818', height: 52, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontFamily: 'Gramatika-Regular', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
});
