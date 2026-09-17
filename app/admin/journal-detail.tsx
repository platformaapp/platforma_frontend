import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Alert,
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

const FORMATS = ['Подкаст', 'Текст', 'Интервью'] as const;

type TutorOption = { id: string; fullName: string; email: string };

function resolveUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

async function uploadAdminImage(uri: string): Promise<string> {
  const token = await getAdminToken();
  if (!token) throw new Error('Требуется авторизация');
  const formData = new FormData();
  const filename = `article_${Date.now()}.jpg`;
  if (Platform.OS === 'web') {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    formData.append('file', blob, filename);
  } else {
    formData.append('file', { uri, name: filename, type: 'image/jpeg' } as any);
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

async function pickImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Ошибка', 'Необходимо разрешение на доступ к фотографиям');
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

export default function AdminJournalDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isNew = !id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>(FORMATS[1]);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);

  const [author, setAuthor] = useState<TutorOption | null>(null);
  const [authorQuery, setAuthorQuery] = useState('');
  const [authorOptions, setAuthorOptions] = useState<TutorOption[]>([]);
  const [authorSearching, setAuthorSearching] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Проверяем токен на входе всегда — и в режиме создания тоже (isNew раньше
  // пропускал эту проверку целиком, и форма создания открывалась без логина).
  useEffect(() => {
    let active = true;
    (async () => {
      const token = await getAdminToken();
      if (!token) { router.replace('/admin/login'); return; }
      if (isNew) { if (active) setLoading(false); return; }
      try {
        const res = await fetch(`${endpoints.adminArticles}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) { await clearAdminToken(); router.replace('/admin/login'); return; }
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          if (active) setLoadError(d?.message ?? `Ошибка ${res.status}`);
          return;
        }
        const a = await res.json();
        if (!active) return;
        setTitle(a.title ?? '');
        setContent(a.content ?? '');
        setCategory(a.category ?? FORMATS[1]);
        setCoverUri(resolveUrl(a.cover_url));
        setGallery(Array.isArray(a.gallery) ? a.gallery.map((g: string) => resolveUrl(g) ?? g) : []);
        if (a.author) setAuthor({ id: a.author.id, fullName: a.author.name, email: '' });
      } catch {
        if (active) setLoadError('Не удалось загрузить материал');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id, isNew, router]);

  useEffect(() => {
    if (!authorQuery.trim()) { setAuthorOptions([]); return; }
    let active = true;
    const t = setTimeout(async () => {
      const token = await getAdminToken();
      if (!token) return;
      setAuthorSearching(true);
      try {
        const params = new URLSearchParams({ role: 'tutor', search: authorQuery.trim(), per_page: '10' });
        const res = await fetch(`${endpoints.adminUsers}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        if (active) setAuthorOptions(items.map((u: any) => ({ id: u.id, fullName: u.fullName ?? u.email, email: u.email })));
      } catch { /* ignore */ }
      finally { if (active) setAuthorSearching(false); }
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [authorQuery]);

  async function handlePickCover() {
    const uri = await pickImage();
    if (uri) setCoverUri(uri);
  }

  async function handleAddGalleryImage() {
    if (gallery.length >= 2) return;
    const uri = await pickImage();
    if (uri) setGallery((g) => [...g, uri]);
  }

  function removeGalleryImage(idx: number) {
    setGallery((g) => g.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!title.trim()) { setSaveError('Укажите название'); return; }
    if (!author) { setSaveError('Выберите автора'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const token = await getAdminToken();
      if (!token) { router.replace('/admin/login'); return; }

      let uploadedCover: string | undefined;
      if (coverUri && coverUri.startsWith('data:')) {
        setCoverUploading(true);
        try { uploadedCover = await uploadAdminImage(coverUri); } finally { setCoverUploading(false); }
      } else if (coverUri) {
        uploadedCover = coverUri;
      }

      let uploadedGallery: string[] | undefined;
      const needsUpload = gallery.some((g) => g.startsWith('data:'));
      if (needsUpload) {
        setGalleryUploading(true);
        try {
          uploadedGallery = await Promise.all(gallery.map((g) => (g.startsWith('data:') ? uploadAdminImage(g) : g)));
        } finally { setGalleryUploading(false); }
      } else {
        uploadedGallery = gallery;
      }

      const body: Record<string, unknown> = {
        title: title.trim(),
        content: content.trim() || undefined,
        category,
        cover_url: uploadedCover,
        gallery: uploadedGallery,
        author_id: author.id,
      };

      const url = isNew ? endpoints.adminArticles : `${endpoints.adminArticles}/${id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { await clearAdminToken(); router.replace('/admin/login'); return; }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message ?? (Array.isArray(d?.message) ? d.message.join(', ') : `Ошибка ${res.status}`));
      }
      router.back();
    } catch (e) {
      setSaveError((e as Error)?.message ?? 'Не удалось сохранить материал');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Удалить материал?', title, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: handleDelete },
    ]);
  }

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      const token = await getAdminToken();
      if (!token) { router.replace('/admin/login'); return; }
      const res = await fetch(`${endpoints.adminArticles}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { await clearAdminToken(); router.replace('/admin/login'); return; }
      if (!res.ok && res.status !== 204) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message ?? `Ошибка ${res.status}`);
      }
      router.back();
    } catch (e) {
      Alert.alert('Ошибка', (e as Error)?.message ?? 'Не удалось удалить материал');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <View style={[styles.centered, { paddingTop: insets.top }]}><ActivityIndicator size="large" color="#181818" /></View>;
  }

  if (loadError) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{loadError}</Text>
        <Pressable style={styles.backBtnOutline} onPress={() => router.back()}><Text style={styles.backBtnOutlineText}>← Назад</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backArrow}>‹</Text></Pressable>
        <Text style={styles.headerTitle}>{isNew ? 'НОВЫЙ МАТЕРИАЛ' : 'РЕДАКТИРОВАНИЕ'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Обложка</Text>
        <Pressable style={styles.coverBtn} onPress={handlePickCover}>
          {coverUri ? <Image source={{ uri: coverUri }} style={styles.coverPreview} resizeMode="cover" /> : <Text style={styles.coverBtnText}>Выбрать изображение</Text>}
        </Pressable>
        {coverUri ? <Pressable onPress={() => setCoverUri(null)}><Text style={styles.removeLink}>Удалить обложку</Text></Pressable> : null}

        <Text style={styles.label}>Название</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Название материала" placeholderTextColor="#9B9B9B" />

        <Text style={styles.label}>Формат</Text>
        <View style={styles.formatRow}>
          {FORMATS.map((f) => (
            <Pressable key={f} style={[styles.formatChip, category === f && styles.formatChipActive]} onPress={() => setCategory(f)}>
              <Text style={[styles.formatChipText, category === f && styles.formatChipTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Автор</Text>
        {author ? (
          <View style={styles.authorSelected}>
            <Text style={styles.authorSelectedText}>{author.fullName}</Text>
            <Pressable onPress={() => { setAuthor(null); setAuthorQuery(''); }}><Text style={styles.removeLink}>Изменить</Text></Pressable>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={authorQuery}
              onChangeText={setAuthorQuery}
              placeholder="Поиск наставника по имени или почте"
              placeholderTextColor="#9B9B9B"
            />
            {authorSearching ? <ActivityIndicator style={{ marginTop: 8 }} color="#181818" /> : null}
            {authorOptions.map((opt) => (
              <Pressable key={opt.id} style={styles.authorOption} onPress={() => { setAuthor(opt); setAuthorOptions([]); }}>
                <Text style={styles.authorOptionName}>{opt.fullName}</Text>
                <Text style={styles.authorOptionEmail}>{opt.email}</Text>
              </Pressable>
            ))}
          </>
        )}

        <Text style={styles.label}>Текст</Text>
        <Text style={styles.hint}>Строка вида «## Подзаголовок» открывает второй блок статьи (подзаголовок + текст рядом с галереей).</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={content}
          onChangeText={setContent}
          placeholder={'Первый абзац...\n\n## Подзаголовок\n\nТекст второго блока...'}
          placeholderTextColor="#9B9B9B"
          multiline
          numberOfLines={10}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Галерея (до 2 изображений)</Text>
        <View style={styles.galleryRow}>
          {gallery.map((g, i) => (
            <View key={i} style={styles.galleryItem}>
              <Image source={{ uri: g }} style={styles.galleryImage} resizeMode="cover" />
              <Pressable style={styles.galleryRemove} onPress={() => removeGalleryImage(i)}>
                <Text style={styles.galleryRemoveText}>✕</Text>
              </Pressable>
            </View>
          ))}
          {gallery.length < 2 ? (
            <Pressable style={styles.galleryAdd} onPress={handleAddGalleryImage}>
              <Text style={styles.galleryAddText}>+</Text>
            </Pressable>
          ) : null}
        </View>

        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

        <Pressable
          style={[styles.saveBtn, (saving || coverUploading || galleryUploading) && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving || coverUploading || galleryUploading}
        >
          {coverUploading || galleryUploading ? (
            <Text style={styles.saveBtnText}>Загрузка изображений…</Text>
          ) : saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>{isNew ? 'Создать' : 'Сохранить'}</Text>
          )}
        </Pressable>

        {!isNew ? (
          <Pressable style={[styles.deleteBtn, deleting && styles.btnDisabled]} onPress={confirmDelete} disabled={deleting}>
            {deleting ? <ActivityIndicator color="#721c24" size="small" /> : <Text style={styles.deleteBtnText}>Удалить материал</Text>}
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#E02D2D', marginTop: 12 },
  backBtnOutline: { borderWidth: 1, borderColor: '#181818', paddingVertical: 10, paddingHorizontal: 20, marginTop: 16 },
  backBtnOutlineText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#1E1E1E', gap: 12 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 28, lineHeight: 30, color: '#181818', marginTop: -2 },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: 'Inter-Regular', fontWeight: '700', color: '#181818' },

  content: { paddingHorizontal: 16, paddingBottom: 48 },
  label: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 6, marginTop: 18 },
  hint: { fontSize: 11, lineHeight: 15, fontFamily: 'Inter-Regular', color: '#9B9B9B', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818', backgroundColor: '#FAFAFA',
  },
  inputMultiline: { minHeight: 200, textAlignVertical: 'top' },
  removeLink: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#E02D2D', marginTop: 6 },

  coverBtn: { borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#FAFAFA', height: 160, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverPreview: { width: '100%', height: 160 },
  coverBtnText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#9B9B9B' },

  formatRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  formatChip: { borderWidth: 1, borderColor: '#1E1E1E', paddingVertical: 8, paddingHorizontal: 14 },
  formatChipActive: { backgroundColor: '#181818' },
  formatChipText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818' },
  formatChipTextActive: { color: '#fff' },

  authorSelected: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E5E5E5', padding: 12, backgroundColor: '#FAFAFA' },
  authorSelectedText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#181818' },
  authorOption: { borderWidth: 1, borderColor: '#E5E5E5', borderTopWidth: 0, padding: 10 },
  authorOptionName: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#181818' },
  authorOptionEmail: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#9B9B9B' },

  galleryRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  galleryItem: { width: 96, height: 96, position: 'relative' },
  galleryImage: { width: '100%', height: '100%' },
  galleryRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  galleryRemoveText: { fontSize: 11, color: '#fff' },
  galleryAdd: { width: 96, height: 96, borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center' },
  galleryAddText: { fontSize: 24, color: '#9B9B9B' },

  saveBtn: { marginTop: 24, backgroundColor: '#181818', paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#fff', fontWeight: '600' },
  deleteBtn: { marginTop: 12, borderWidth: 1, borderColor: '#721c24', paddingVertical: 14, alignItems: 'center' },
  deleteBtnText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#721c24' },
  btnDisabled: { opacity: 0.6 },
});
