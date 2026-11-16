import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE, endpoints } from '@/constants/env';
import { clearAdminToken, getAdminToken } from '@/lib/admin-auth';
import { adminGoBack } from '@/lib/admin-nav';
import { resizeImageForUpload } from '@/lib/resize-image-for-upload';
import {
  getAdminSiteSettings,
  updateSiteSettings,
  type AboutUsSetting,
  type BannerSetting,
  type NavItemSetting,
  type PartnerSetting,
} from '@/lib/api/site-settings';

const NAV_SLOT_LABELS = ['События', 'Наставники', 'Мои записи', 'Журнал', 'Личный кабинет'];

function emptyNavItems(): NavItemSetting[] {
  return NAV_SLOT_LABELS.map((label) => ({ label, iconUrl: '' }));
}

// Тот же приём, что в admin/journal-detail.tsx (handlePickCover/uploadAdminImage):
// выбор из галереи кладёт локальный uri (data:/blob) для превью сразу, сама
// загрузка на сервер происходит только при "Сохранить" — там же заменяем
// локальный uri на настоящий URL перед отправкой (см. handleSave).
async function pickImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.alert('Необходимо разрешение на доступ к фотографиям'); }
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  const uri = result.assets[0].uri;
  if (Platform.OS === 'web' && uri.startsWith('blob:')) {
    try {
      const resp = await fetch(uri);
      const blob = await resp.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return uri;
    }
  }
  return uri;
}

async function uploadAdminImage(uri: string): Promise<string> {
  const token = await getAdminToken();
  if (!token) throw new Error('Требуется авторизация');
  const resizedUri = await resizeImageForUpload(uri);
  const formData = new FormData();
  const filename = `site_${Date.now()}.jpg`;
  if (Platform.OS === 'web') {
    const resp = await fetch(resizedUri);
    const blob = await resp.blob();
    formData.append('file', blob, filename);
  } else {
    formData.append('file', { uri: resizedUri, name: filename, type: 'image/jpeg' } as any);
  }
  const res = await fetch(endpoints.uploadImage, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message ?? `Ошибка загрузки изображения (${res.status})`);
  }
  const data = await res.json();
  if (!data?.url) throw new Error('Сервер не вернул URL изображения');
  const url = data.url as string;
  return url.startsWith('http') ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

function isLocalUri(uri: string | undefined): boolean {
  return !!uri && (uri.startsWith('data:') || uri.startsWith('blob:') || uri.startsWith('file:'));
}

// Поля вроде navItems[].iconUrl необязательны (@IsOptional() на бэкенде), но
// пустая строка '' — это НЕ undefined, и @IsUrl() всё равно её проверяет и
// отклоняет ("must be a URL address") — ровно так ломалось сохранение любых
// настроек (например, ссылки баннера), пока хоть один из 5 пунктов меню не
// имел своей иконки. Перед отправкой стираем пустые строки в undefined.
function emptyToUndefined(v: string | undefined): string | undefined {
  return v && v.trim() ? v : undefined;
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
  const [aboutUs, setAboutUs] = useState<AboutUsSetting>({});

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
        setAboutUs(s.aboutUs ?? {});
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
      // Локальные превью (data:/blob: — только что выбранные через "Выбрать
      // изображение", ещё не на сервере) загружаем прямо перед сохранением,
      // заменяя на настоящие URL — та же логика, что в admin/journal-detail.tsx.
      let finalBanner = banner;
      if (isLocalUri(banner.imageUrl)) {
        const url = await uploadAdminImage(banner.imageUrl as string);
        finalBanner = { ...banner, imageUrl: url };
        setBanner(finalBanner);
      }
      let finalPartners = partners;
      if (partners.some((p) => isLocalUri(p.logoUrl))) {
        finalPartners = await Promise.all(
          partners.map(async (p) => (isLocalUri(p.logoUrl) ? { ...p, logoUrl: await uploadAdminImage(p.logoUrl) } : p))
        );
        setPartners(finalPartners);
      }
      let finalAboutUs = aboutUs;
      if (isLocalUri(aboutUs.photoUrl)) {
        const url = await uploadAdminImage(aboutUs.photoUrl as string);
        finalAboutUs = { ...aboutUs, photoUrl: url };
        setAboutUs(finalAboutUs);
      }
      const sanitizedNavItems = navItems.map((it) => ({ ...it, iconUrl: emptyToUndefined(it.iconUrl) }));
      const sanitizedBanner = { ...finalBanner, imageUrl: emptyToUndefined(finalBanner.imageUrl), linkUrl: emptyToUndefined(finalBanner.linkUrl) };
      const sanitizedPartners = finalPartners.map((p) => ({ ...p, linkUrl: emptyToUndefined(p.linkUrl) }));
      const sanitizedAboutUs = { ...finalAboutUs, photoUrl: emptyToUndefined(finalAboutUs.photoUrl) };
      await updateSiteSettings({
        navItems: sanitizedNavItems,
        banner: sanitizedBanner,
        partners: sanitizedPartners,
        topics,
        aboutUs: sanitizedAboutUs,
      });
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

  async function handlePickBannerImage() {
    const uri = await pickImage();
    if (uri) setBanner((b) => ({ ...b, imageUrl: uri }));
  }

  async function handlePickAboutUsPhoto() {
    const uri = await pickImage();
    if (uri) setAboutUs((a) => ({ ...a, photoUrl: uri }));
  }

  async function handlePickPartnerLogo(index: number) {
    const uri = await pickImage();
    if (uri) updatePartner(index, { logoUrl: uri });
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
        <Pressable onPress={() => adminGoBack(router, '/admin/dashboard')} style={styles.backBtn}>
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

          {/* Баннер — используется между строками на /events и /journal. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Баннер</Text>
            <Text style={styles.sectionSubtitle}>Картинка и ссылка баннера между событиями/статьями. Если не заполнено — стандартный баннер.</Text>
            <Pressable style={styles.imagePickBtn} onPress={handlePickBannerImage}>
              {banner.imageUrl ? (
                <Image source={{ uri: banner.imageUrl }} style={styles.imagePickPreview} resizeMode="cover" />
              ) : (
                <Text style={styles.imagePickBtnText}>Выбрать изображение</Text>
              )}
            </Pressable>
            {banner.imageUrl ? (
              <Pressable onPress={() => setBanner((b) => ({ ...b, imageUrl: '' }))}>
                <Text style={styles.removeLink}>Удалить картинку</Text>
              </Pressable>
            ) : null}
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
                <Pressable style={styles.imagePickBtnSmall} onPress={() => handlePickPartnerLogo(i)}>
                  {p.logoUrl ? (
                    <Image source={{ uri: p.logoUrl }} style={styles.imagePickPreviewSmall} resizeMode="contain" />
                  ) : (
                    <Text style={styles.imagePickBtnText}>Выбрать лого</Text>
                  )}
                </Pressable>
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

          {/* О нас — страница по ссылке p(34) в шапке: большое фото, заголовок, текст. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>О нас</Text>
            <Text style={styles.sectionSubtitle}>Страница по клику на p(34) в шапке — большое фото, заголовок, текст.</Text>
            <Pressable style={styles.imagePickBtn} onPress={handlePickAboutUsPhoto}>
              {aboutUs.photoUrl ? (
                <Image source={{ uri: aboutUs.photoUrl }} style={styles.imagePickPreview} resizeMode="cover" />
              ) : (
                <Text style={styles.imagePickBtnText}>Выбрать изображение</Text>
              )}
            </Pressable>
            {aboutUs.photoUrl ? (
              <Pressable onPress={() => setAboutUs((a) => ({ ...a, photoUrl: '' }))}>
                <Text style={styles.removeLink}>Удалить картинку</Text>
              </Pressable>
            ) : null}
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Заголовок"
              placeholderTextColor="#9B9B9B"
              value={aboutUs.heading ?? ''}
              onChangeText={(t) => setAboutUs((a) => ({ ...a, heading: t }))}
            />
            <TextInput
              style={[styles.input, styles.inputMultiline, { marginTop: 8 }]}
              placeholder="Текст"
              placeholderTextColor="#9B9B9B"
              value={aboutUs.text ?? ''}
              onChangeText={(t) => setAboutUs((a) => ({ ...a, text: t }))}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
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
  content: { width: '100%', maxWidth: 840, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 48 },
  section: { borderWidth: 1, borderColor: '#1E1E1E', padding: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#181818', marginBottom: 6 },
  sectionSubtitle: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginBottom: 16, lineHeight: 18 },
  input: { borderBottomWidth: 1, borderColor: '#1E1E1E', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#181818' },
  inputMultiline: { minHeight: 160, textAlignVertical: 'top' },
  navRow: { marginBottom: 14, gap: 6 },
  navSlotLabel: { fontSize: 12, fontFamily: 'Gramatika-Regular', color: '#687076' },
  partnerRow: { marginBottom: 14, gap: 6, borderBottomWidth: 1, borderColor: '#E5E5E5', paddingBottom: 14 },
  removeBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  removeBtnText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#E02D2D' },
  removeLink: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#E02D2D', marginTop: 6, alignSelf: 'flex-start' },
  imagePickBtn: { borderWidth: 1, borderColor: '#1E1E1E', borderStyle: 'dashed', height: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA', overflow: 'hidden' },
  imagePickPreview: { width: '100%', height: '100%' },
  imagePickBtnSmall: { borderWidth: 1, borderColor: '#1E1E1E', borderStyle: 'dashed', height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA', overflow: 'hidden' },
  imagePickPreviewSmall: { width: '100%', height: '100%' },
  imagePickBtnText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#687076' },
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
