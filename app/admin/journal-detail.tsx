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

import { AdminTagsInput } from '@/components/admin/tags-input';
import { BackArrowIcon } from '@/components/web/back-arrow-icon';
import { API_BASE, endpoints } from '@/constants/env';
import { clearAdminToken, getAdminToken } from '@/lib/admin-auth';
import { resizeImageForUpload } from '@/lib/resize-image-for-upload';

const FORMATS = ['Обсудить', 'Посмотреть', 'Посетить'] as const;

// Тулбар над "Текст" — каждая кнопка оборачивает выделенный фрагмент парой
// маркеров; разбирает их parseInlineMarkdown (lib/markdown-inline.tsx) на
// странице статьи. Не настоящий markdown — фиксированный набор пар под то,
// что умеет тулбар (жирный/курсив/подчёркнутый/зачёркнутый/выделение
// цветом/крупнее/мельче), ссылка — отдельной кнопкой с запросом URL.
const TOOLBAR_ACTIONS: { label: string; title: string; before: string; after: string }[] = [
  { label: 'Жирный', title: 'Жирный', before: '**', after: '**' },
  { label: 'Курсив', title: 'Курсив', before: '*', after: '*' },
  { label: 'Подчёркнутый', title: 'Подчёркнутый', before: '__', after: '__' },
  { label: 'Зачёркнутый', title: 'Зачёркнутый', before: '~~', after: '~~' },
  { label: 'Выделить цветом', title: 'Выделить цветом', before: '==', after: '==' },
  { label: 'Крупнее', title: 'Крупнее', before: '{+', after: '+}' },
  { label: 'Мельче', title: 'Мельче', before: '{-', after: '-}' },
];

type TutorOption = { id: string; fullName: string; email: string };
type ArticleOption = { id: string; title: string; category: string | null };
type EventOption = { id: string; title: string; datetimeStart: string | null };

function resolveUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

async function uploadAdminImage(uri: string): Promise<string> {
  const token = await getAdminToken();
  if (!token) throw new Error('Требуется авторизация');
  const resizedUri = await resizeImageForUpload(uri);
  const formData = new FormData();
  const filename = `article_${Date.now()}.jpg`;
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

async function pickImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.alert('Необходимо разрешение на доступ к фотографиям'); }
    else Alert.alert('Ошибка', 'Необходимо разрешение на доступ к фотографиям');
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
  // Человекочитаемый URL (/journal/<slug>) — единственный публичный путь к
  // статье. Пусто при создании = бэкенд сгенерирует сам из title; при
  // редактировании пусто значит "не менять" (слаг НЕ пересчитывается из
  // title автоматически — иначе правка заголовка молча ломала бы уже
  // расшаренные ссылки).
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [contentSelection, setContentSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [category, setCategory] = useState<string>(FORMATS[1]);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  // Alt-текст обложки — картиночный поиск и доступность.
  const [coverAlt, setCoverAlt] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryCaption, setGalleryCaption] = useState('');
  // Alt-текст для каждой картинки галереи — galleryAlt[i] ↔ gallery[i].
  const [galleryAlt, setGalleryAlt] = useState<string[]>([]);
  // Баннер рядом со вторым подзаголовком — опционально, по умолчанию
  // включён (старое поведение для уже существующих статей).
  const [showBanner, setShowBanner] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  // SEO — необязательные поля, не влияют на вид статьи на сайте: seoTitle
  // идёт в <title>, metaDescription — в <meta name="description">, h1 —
  // видимый заголовок статьи ВМЕСТО обычного title (если задан).
  const [seoTitle, setSeoTitle] = useState('');
  const [h1, setH1] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  // Краткое описание для карточек в ленте/журнале — ОТДЕЛЬНО от Meta
  // Description (та — сниппет в выдаче поиска).
  const [excerpt, setExcerpt] = useState('');
  // <link rel="canonical"> — для дублей/пересекающихся по теме статей.
  const [canonicalUrl, setCanonicalUrl] = useState('');
  // og:title/og:description — превью при шаринге, опционально
  // переопределяют SEO Title/Meta Description.
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  // noindex/nofollow — точечно закрыть статью от индексации (черновики,
  // слабый контент, дубли), не убирая её с сайта.
  const [noindex, setNoindex] = useState(false);
  const [nofollow, setNofollow] = useState(false);
  // Дата публикации (YYYY-MM-DD) — для schema.org datePublished и сигнала
  // свежести контента; по умолчанию при создании бэкенд ставит "сейчас".
  const [publishedAt, setPublishedAt] = useState('');

  const [author, setAuthor] = useState<TutorOption | null>(null);
  const [authorQuery, setAuthorQuery] = useState('');
  const [authorOptions, setAuthorOptions] = useState<TutorOption[]>([]);
  const [authorSearching, setAuthorSearching] = useState(false);

  // "Окей, что ещё" в конце статьи — до 3 связанных статей, выбранных
  // здесь при создании/редактировании (см. [id].web.tsx, блок вместо
  // баннера в конце).
  const [relatedArticles, setRelatedArticles] = useState<ArticleOption[]>([]);
  const [relatedQuery, setRelatedQuery] = useState('');
  const [relatedOptions, setRelatedOptions] = useState<ArticleOption[]>([]);
  const [relatedSearching, setRelatedSearching] = useState(false);

  // Событие, привязанное к статье — CTA "Записаться на событие" на странице
  // статьи (см. [id].web.tsx). В отличие от похожих статей — одно, не три.
  const [event, setEvent] = useState<EventOption | null>(null);
  const [eventQuery, setEventQuery] = useState('');
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [eventSearching, setEventSearching] = useState(false);

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
        setSlug(a.slug ?? '');
        setContent(a.content ?? '');
        setCategory(a.category ?? FORMATS[1]);
        setCoverUri(resolveUrl(a.cover_url));
        setCoverAlt(a.cover_alt ?? '');
        setGallery(Array.isArray(a.gallery) ? a.gallery.map((g: string) => resolveUrl(g) ?? g) : []);
        setGalleryCaption(a.gallery_caption ?? '');
        setGalleryAlt(Array.isArray(a.gallery_alt) ? a.gallery_alt : []);
        setShowBanner(a.show_banner ?? true);
        setTags(Array.isArray(a.tags) ? a.tags : []);
        setSeoTitle(a.seo_title ?? '');
        setH1(a.h1 ?? '');
        setMetaDescription(a.meta_description ?? '');
        setExcerpt(a.excerpt ?? '');
        setCanonicalUrl(a.canonical_url ?? '');
        setOgTitle(a.og_title ?? '');
        setOgDescription(a.og_description ?? '');
        setNoindex(a.noindex ?? false);
        setNofollow(a.nofollow ?? false);
        setPublishedAt(a.published_at ? String(a.published_at).slice(0, 10) : '');
        if (a.author) setAuthor({ id: a.author.id, fullName: a.author.name, email: '' });
        if (Array.isArray(a.related_articles)) {
          setRelatedArticles(a.related_articles.map((r: any) => ({ id: r.id, title: r.title, category: r.category ?? null })));
        }
        if (a.event) setEvent({ id: a.event.id, title: a.event.title, datetimeStart: a.event.datetime_start ?? null });
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

  useEffect(() => {
    if (!relatedQuery.trim()) { setRelatedOptions([]); return; }
    let active = true;
    const t = setTimeout(async () => {
      const token = await getAdminToken();
      if (!token) return;
      setRelatedSearching(true);
      try {
        const params = new URLSearchParams({ search: relatedQuery.trim(), per_page: '10' });
        const res = await fetch(`${endpoints.adminArticles}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data?.data) ? data.data : [];
        const selectedIds = new Set(relatedArticles.map((r) => r.id));
        const opts = items
          .map((a: any) => ({ id: a.id, title: a.title, category: a.category ?? null }))
          .filter((a: ArticleOption) => a.id !== id && !selectedIds.has(a.id));
        if (active) setRelatedOptions(opts);
      } catch { /* ignore */ }
      finally { if (active) setRelatedSearching(false); }
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [relatedQuery, relatedArticles, id]);

  function addRelatedArticle(opt: ArticleOption) {
    if (relatedArticles.length >= 3) return;
    setRelatedArticles((prev) => [...prev, opt]);
    setRelatedQuery('');
    setRelatedOptions([]);
  }

  function removeRelatedArticle(articleId: string) {
    setRelatedArticles((prev) => prev.filter((r) => r.id !== articleId));
  }

  useEffect(() => {
    if (!eventQuery.trim()) { setEventOptions([]); return; }
    let active = true;
    const t = setTimeout(async () => {
      const token = await getAdminToken();
      if (!token) return;
      setEventSearching(true);
      try {
        const params = new URLSearchParams({ search: eventQuery.trim(), per_page: '10' });
        const res = await fetch(`${endpoints.adminEventsAdmin}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        const opts = items.map((e: any) => ({ id: e.id, title: e.title, datetimeStart: e.datetimeStart ?? null }));
        if (active) setEventOptions(opts);
      } catch { /* ignore */ }
      finally { if (active) setEventSearching(false); }
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [eventQuery]);

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
    setGalleryAlt((a) => a.filter((_, i) => i !== idx));
  }

  function setGalleryAltAt(idx: number, value: string) {
    setGalleryAlt((a) => {
      const next = [...a];
      while (next.length <= idx) next.push('');
      next[idx] = value;
      return next;
    });
  }

  // Оборачивает текущее выделение в "Текст" парой маркеров тулбара (если
  // ничего не выделено — вставляет пустую пару на месте курсора).
  //
  // После вставки обязательно обновляем contentSelection на новые индексы
  // (там, где теперь лежит тот же исходный фрагмент, сдвинутый на длину
  // before) — без этого второй клик по тулбару (второе форматирование той
  // же фразы, напр. "A+" затем "Ж") использует СТАРЫЕ индексы уже на НОВОЙ
  // (более длинной) строке текста, и маркеры попадают внутрь слова, а не
  // вокруг него (ровно на длину первой вставленной пары символов).
  function wrapContentSelection(before: string, after: string) {
    const { start, end } = contentSelection;
    const selected = content.slice(start, end);
    setContent(content.slice(0, start) + before + selected + after + content.slice(end));
    const newStart = start + before.length;
    setContentSelection({ start: newStart, end: newStart + selected.length });
  }

  function insertLink() {
    const url = typeof window !== 'undefined' ? window.prompt('Ссылка (URL)') : null;
    if (!url) return;
    const { start, end } = contentSelection;
    const label = content.slice(start, end) || 'текст ссылки';
    setContent(content.slice(0, start) + `[${label}](${url})` + content.slice(end));
  }

  // Вставляет строку «## Подзаголовок» (см. parseContent в [id].web.tsx) —
  // отдельной кнопкой, а не парой маркеров вокруг выделения, т.к. это не
  // инлайн-форматирование, а отдельный блок текста на своей строке.
  function insertSubheading() {
    const { start, end } = contentSelection;
    const selected = content.slice(start, end);
    const headingText = selected || 'Подзаголовок';
    const prefix = '\n\n## ';
    setContent(content.slice(0, start) + prefix + headingText + '\n\n' + content.slice(end));
    const headingStart = start + prefix.length;
    setContentSelection({ start: headingStart, end: headingStart + headingText.length });
  }

  // Вставляет маркер в позицию курсора в "Текст" — на странице статьи он
  // заменяется на сам блок (CTA события / карточку похожей статьи) в этом же
  // месте, а не в конце статьи (см. renderParagraphs в [id].web.tsx). Если
  // маркер нигде не вставлен — блок всё равно показывается в конце (старое
  // поведение, для уже существующих статей).
  function insertEventToken() {
    const { start, end } = contentSelection;
    setContent(content.slice(0, start) + `\n\n{{event}}\n\n` + content.slice(end));
  }

  function insertRelatedToken(articleId: string) {
    const { start, end } = contentSelection;
    setContent(content.slice(0, start) + `\n\n{{related:${articleId}}}\n\n` + content.slice(end));
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
        // Пусто — не отправляем вовсе: бэкенд сам сгенерирует slug из title
        // при создании, а при редактировании undefined значит "не менять"
        // (см. UpdateArticleDto.slug на бэкенде).
        slug: slug.trim() || undefined,
        content: content.trim() || undefined,
        category,
        cover_url: uploadedCover,
        cover_alt: coverAlt.trim() || undefined,
        gallery: uploadedGallery,
        gallery_caption: galleryCaption.trim() || undefined,
        gallery_alt: galleryAlt.map((a) => a.trim()),
        show_banner: showBanner,
        tags,
        seo_title: seoTitle.trim() || undefined,
        h1: h1.trim() || undefined,
        meta_description: metaDescription.trim() || undefined,
        excerpt: excerpt.trim() || undefined,
        canonical_url: canonicalUrl.trim() || undefined,
        og_title: ogTitle.trim() || undefined,
        og_description: ogDescription.trim() || undefined,
        noindex,
        nofollow,
        // YYYY-MM-DD из <input type="date"> — бэкенду нужен валидный
        // ISO-datetime (@IsDateString), достраиваем время в полночь UTC.
        published_at: publishedAt.trim() ? `${publishedAt.trim()}T00:00:00.000Z` : undefined,
        related_article_ids: relatedArticles.map((r) => r.id),
        event_id: event ? event.id : null,
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

  // Alert.alert с несколькими кнопками — react-native-web это полный no-op
  // (см. node_modules/react-native-web/.../Alert: static alert() {}), поэтому
  // окно подтверждения никогда не появлялось и handleDelete не вызывался.
  // Админка работает на web — используем window.confirm напрямую.
  function confirmDelete() {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Удалить материал «${title}»?`)) handleDelete();
      return;
    }
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
      const msg = (e as Error)?.message ?? 'Не удалось удалить материал';
      if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.alert(msg); }
      else Alert.alert('Ошибка', msg);
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
        <Pressable style={[styles.backBtnOutline, styles.backBtnOutlineRow]} onPress={() => router.back()}>
          <BackArrowIcon width={16} height={15} />
          <Text style={styles.backBtnOutlineText}>Назад</Text>
        </Pressable>
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
        {coverUri ? (
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={coverAlt}
            onChangeText={setCoverAlt}
            placeholder="Alt-текст обложки (для картиночного поиска)"
            placeholderTextColor="#9B9B9B"
          />
        ) : null}

        <Text style={styles.label}>Название</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Название материала" placeholderTextColor="#9B9B9B" />

        <Text style={styles.label}>Слаг (URL)</Text>
        <Text style={styles.hint}>
          Адрес статьи — platformaapp.ru/journal/<Text style={styles.hintStrong}>{slug.trim() || '...'}</Text>. Если оставить пустым — сгенерируется
          автоматически из названия. Только строчные латинские буквы, цифры и дефисы. При смене названия уже сохранённый
          слаг сам не меняется — ссылки на статью не ломаются.
        </Text>
        <TextInput
          style={styles.input}
          value={slug}
          onChangeText={setSlug}
          placeholder="kak-chitat-kritiku-na-kino"
          placeholderTextColor="#9B9B9B"
          autoCapitalize="none"
          autoCorrect={false}
        />

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
        <Text style={styles.hint}>
          Строка вида «## Подзаголовок» добавляет подзаголовок — можно несколько таких строк подряд по тексту. Баннер на
          странице статьи встаёт напротив ВТОРОГО по счёту подзаголовка (если он есть). Выделите
          фрагмент и нажмите кнопку форматирования ниже — она обернёт выделение нужными символами. Выделение не должно
          перескакивать через пустую строку (абзац) — форматирование применяется внутри одного абзаца, оборачивание
          нескольких абзацев сразу не сработает ни у одного из них.
        </Text>
        <View style={styles.toolbarRow}>
          <Pressable style={styles.toolbarBtn} onPress={insertSubheading} accessibilityLabel="Подзаголовок">
            <Text style={styles.toolbarBtnText}>Подзаголовок</Text>
          </Pressable>
          {TOOLBAR_ACTIONS.map((a) => (
            <Pressable key={a.label} style={styles.toolbarBtn} onPress={() => wrapContentSelection(a.before, a.after)} accessibilityLabel={a.title}>
              <Text style={styles.toolbarBtnText}>{a.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.toolbarBtn} onPress={insertLink} accessibilityLabel="Ссылка">
            <Text style={styles.toolbarBtnText}>Ссылка</Text>
          </Pressable>
        </View>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={content}
          onChangeText={setContent}
          onSelectionChange={(e) => setContentSelection(e.nativeEvent.selection)}
          selection={contentSelection}
          placeholder={'Первый абзац...\n\n## Подзаголовок\n\nТекст второго блока...'}
          placeholderTextColor="#9B9B9B"
          multiline
          numberOfLines={10}
          textAlignVertical="top"
        />

        <Pressable style={styles.checkboxRow} onPress={() => setShowBanner((v) => !v)}>
          <View style={[styles.checkboxBox, showBanner && styles.checkboxBoxChecked]}>
            {showBanner ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxLabel}>Показывать баннер рядом со вторым подзаголовком</Text>
        </Pressable>

        <Text style={styles.label}>Теги</Text>
        <Text style={styles.hint}>Показываются на странице статьи напротив имени автора (#тег).</Text>
        <AdminTagsInput tags={tags} onChange={setTags} />

        <Text style={styles.label}>Галерея (до 2 изображений)</Text>
        <View style={styles.galleryRow}>
          {gallery.map((g, i) => (
            <View key={i} style={styles.galleryItem}>
              <Image source={{ uri: g }} style={styles.galleryImage} resizeMode="cover" />
              <Pressable style={styles.galleryRemove} onPress={() => removeGalleryImage(i)}>
                <Text style={styles.galleryRemoveText}>✕</Text>
              </Pressable>
              <TextInput
                style={[styles.input, styles.galleryAltInput]}
                value={galleryAlt[i] ?? ''}
                onChangeText={(v) => setGalleryAltAt(i, v)}
                placeholder="Alt-текст"
                placeholderTextColor="#9B9B9B"
              />
            </View>
          ))}
          {gallery.length < 2 ? (
            <Pressable style={styles.galleryAdd} onPress={handleAddGalleryImage}>
              <Text style={styles.galleryAddText}>+</Text>
            </Pressable>
          ) : null}
        </View>
        {gallery.length > 1 ? (
          <>
            <Text style={styles.label}>Подпись под второй фотографией</Text>
            <TextInput
              style={styles.input}
              value={galleryCaption}
              onChangeText={setGalleryCaption}
              placeholder="Короткая подпись к фото"
              placeholderTextColor="#9B9B9B"
            />
          </>
        ) : null}

        <Text style={styles.label}>«Окей, что ещё» — похожие статьи (до 3)</Text>
        <Text style={styles.hint}>
          По умолчанию показываются блоком в конце статьи. Чтобы разместить статью внутри текста — поставьте курсор в
          нужное место в поле «Текст» и нажмите «Вставить в текст» у статьи ниже.
        </Text>
        {relatedArticles.length > 0 ? (
          <View style={styles.relatedChipsRow}>
            {relatedArticles.map((r) => (
              <View key={r.id} style={styles.relatedChip}>
                <Text style={styles.relatedChipText} numberOfLines={1}>{r.title}</Text>
                <Pressable onPress={() => insertRelatedToken(r.id)}><Text style={styles.insertLinkText}>Вставить в текст</Text></Pressable>
                <Pressable onPress={() => removeRelatedArticle(r.id)}><Text style={styles.relatedChipRemove}>✕</Text></Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {relatedArticles.length < 3 ? (
          <>
            <TextInput
              style={styles.input}
              value={relatedQuery}
              onChangeText={setRelatedQuery}
              placeholder="Поиск статьи по названию"
              placeholderTextColor="#9B9B9B"
            />
            {relatedSearching ? <ActivityIndicator style={{ marginTop: 8 }} color="#181818" /> : null}
            {relatedOptions.map((opt) => (
              <Pressable key={opt.id} style={styles.authorOption} onPress={() => addRelatedArticle(opt)}>
                <Text style={styles.authorOptionName}>{opt.title}</Text>
                {opt.category ? <Text style={styles.authorOptionEmail}>{opt.category}</Text> : null}
              </Pressable>
            ))}
          </>
        ) : null}

        <Text style={styles.label}>Событие — CTA «Записаться на событие» на странице статьи</Text>
        <Text style={styles.hint}>
          Показывается только внутри текста статьи — поставьте курсор в нужное место в поле «Текст» и нажмите
          «Вставить в текст» ниже. Без этого CTA на странице статьи не появится.
        </Text>
        {event ? (
          <View style={styles.authorSelected}>
            <Text style={styles.authorSelectedText}>{event.title}</Text>
            <Pressable onPress={() => insertEventToken()}><Text style={styles.insertLinkText}>Вставить в текст</Text></Pressable>
            <Pressable onPress={() => setEvent(null)}><Text style={styles.removeLink}>Изменить</Text></Pressable>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={eventQuery}
              onChangeText={setEventQuery}
              placeholder="Поиск события по названию"
              placeholderTextColor="#9B9B9B"
            />
            {eventSearching ? <ActivityIndicator style={{ marginTop: 8 }} color="#181818" /> : null}
            {eventOptions.map((opt) => (
              <Pressable key={opt.id} style={styles.authorOption} onPress={() => { setEvent(opt); setEventQuery(''); setEventOptions([]); }}>
                <Text style={styles.authorOptionName}>{opt.title}</Text>
                {opt.datetimeStart ? <Text style={styles.authorOptionEmail}>{new Date(opt.datetimeStart).toLocaleDateString('ru-RU')}</Text> : null}
              </Pressable>
            ))}
          </>
        )}

        <Text style={styles.sectionDivider}>SEO-оформление</Text>
        <Text style={styles.hint}>Необязательные поля, на вид статьи на сайте не влияют (кроме H1 — если задан, заменяет собой видимый заголовок статьи).</Text>

        <Text style={styles.label}>SEO Title</Text>
        <TextInput
          style={styles.input}
          value={seoTitle}
          onChangeText={setSeoTitle}
          placeholder="Заголовок для <title> — по умолчанию обычное название статьи"
          placeholderTextColor="#9B9B9B"
        />

        <Text style={styles.label}>H1</Text>
        <TextInput
          style={styles.input}
          value={h1}
          onChangeText={setH1}
          placeholder="Видимый заголовок на странице — по умолчанию обычное название статьи"
          placeholderTextColor="#9B9B9B"
        />

        <Text style={styles.label}>Meta Description</Text>
        <Text style={styles.hint}>Сниппет в выдаче поиска — 150–160 символов. Если оставить пустым, Google сам вырежет кусок текста статьи (часто криво).</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline, { minHeight: 88 }]}
          value={metaDescription}
          onChangeText={setMetaDescription}
          placeholder="Короткое описание для поисковой выдачи"
          placeholderTextColor="#9B9B9B"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Excerpt</Text>
        <Text style={styles.hint}>Отдельно от Meta Description — этот текст показывается в карточках на /journal и в блоках похожих статей, а не в поисковой выдаче.</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline, { minHeight: 66 }]}
          value={excerpt}
          onChangeText={setExcerpt}
          placeholder="Краткое описание для карточки статьи"
          placeholderTextColor="#9B9B9B"
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Canonical URL</Text>
        <Text style={styles.hint}>
          Для статей, пересекающихся по теме с другой — укажите здесь адрес «главной» версии, и поисковик будет
          считать эту статью её дублем (не покажет обе в выдаче). Обычно не нужно — по умолчанию статья canonical сама на себя.
        </Text>
        <TextInput
          style={styles.input}
          value={canonicalUrl}
          onChangeText={setCanonicalUrl}
          placeholder="https://platformaapp.ru/journal/drugaya-statya"
          placeholderTextColor="#9B9B9B"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>OG Title</Text>
        <Text style={styles.hint}>Заголовок превью при шаринге в соцсети/мессенджеры — если пусто, берётся SEO Title.</Text>
        <TextInput
          style={styles.input}
          value={ogTitle}
          onChangeText={setOgTitle}
          placeholder="По умолчанию — SEO Title"
          placeholderTextColor="#9B9B9B"
        />

        <Text style={styles.label}>OG Description</Text>
        <Text style={styles.hint}>Описание превью при шаринге — если пусто, берётся Meta Description.</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline, { minHeight: 66 }]}
          value={ogDescription}
          onChangeText={setOgDescription}
          placeholder="По умолчанию — Meta Description"
          placeholderTextColor="#9B9B9B"
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Дата публикации</Text>
        <Text style={styles.hint}>Для даты «опубликовано»/«обновлено» в поисковой выдаче. Если оставить пустым — при создании ставится сегодняшняя дата.</Text>
        <TextInput
          style={styles.input}
          value={publishedAt}
          onChangeText={setPublishedAt}
          placeholder="ГГГГ-ММ-ДД"
          placeholderTextColor="#9B9B9B"
        />

        <Pressable style={styles.checkboxRow} onPress={() => setNoindex((v) => !v)}>
          <View style={[styles.checkboxBox, noindex && styles.checkboxBoxChecked]}>
            {noindex ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxLabel}>noindex — закрыть статью от индексации (черновик/слабый контент/дубль). Статья остаётся на сайте как обычно.</Text>
        </Pressable>

        <Pressable style={styles.checkboxRow} onPress={() => setNofollow((v) => !v)}>
          <View style={[styles.checkboxBox, nofollow && styles.checkboxBoxChecked]}>
            {nofollow ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxLabel}>nofollow — не передавать вес по ссылкам с этой страницы</Text>
        </Pressable>

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
  errorText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#E02D2D', marginTop: 12 },
  backBtnOutline: { borderWidth: 1, borderColor: '#181818', paddingVertical: 10, paddingHorizontal: 20, marginTop: 16 },
  backBtnOutlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtnOutlineText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#181818' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#1E1E1E', gap: 12 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 28, lineHeight: 30, color: '#181818', marginTop: -2 },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#181818' },

  content: { paddingHorizontal: 16, paddingBottom: 48 },
  label: { fontSize: 12, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginBottom: 6, marginTop: 18 },
  hint: { fontSize: 11, lineHeight: 15, fontFamily: 'Gramatika-Regular', color: '#9B9B9B', marginBottom: 8 },
  hintStrong: { color: '#181818' },
  sectionDivider: { fontSize: 14, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#181818', marginTop: 32, paddingTop: 18, borderTopWidth: 1, borderColor: '#1E1E1E' },
  input: {
    borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#181818', backgroundColor: '#FAFAFA',
  },
  inputMultiline: { minHeight: 200, textAlignVertical: 'top' },
  toolbarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  // Раньше кнопки были 32x32 с однобуквенной подписью (Ж/К/Ч/...) —
  // заменены на словесные подписи, поэтому ширина теперь по контенту
  // (paddingHorizontal), а не фиксированная.
  toolbarBtn: { height: 32, paddingHorizontal: 10, borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center' },
  toolbarBtnText: { fontSize: 12, fontFamily: 'Gramatika-Regular', color: '#181818' },
  removeLink: { fontSize: 12, fontFamily: 'Gramatika-Regular', color: '#E02D2D', marginTop: 6 },
  insertLinkText: { fontSize: 12, fontFamily: 'Gramatika-Regular', color: '#181818', textDecorationLine: 'underline' },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  checkboxBox: { width: 20, height: 20, borderWidth: 1, borderColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
  checkboxBoxChecked: { backgroundColor: '#181818' },
  checkboxMark: { fontSize: 13, color: '#fff', lineHeight: 14 },
  checkboxLabel: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#181818' },

  coverBtn: { borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#FAFAFA', height: 160, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverPreview: { width: '100%', height: 160 },
  coverBtnText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#9B9B9B' },

  formatRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  formatChip: { borderWidth: 1, borderColor: '#1E1E1E', paddingVertical: 8, paddingHorizontal: 14 },
  formatChipActive: { backgroundColor: '#181818' },
  formatChipText: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#181818' },
  formatChipTextActive: { color: '#fff' },

  authorSelected: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E5E5E5', padding: 12, backgroundColor: '#FAFAFA' },
  authorSelectedText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#181818' },
  authorOption: { borderWidth: 1, borderColor: '#E5E5E5', borderTopWidth: 0, padding: 10 },
  authorOptionName: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#181818' },
  authorOptionEmail: { fontSize: 11, fontFamily: 'Gramatika-Regular', color: '#9B9B9B' },

  relatedChipsRow: { gap: 8, marginBottom: 8 },
  relatedChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderColor: '#E5E5E5', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#FAFAFA' },
  relatedChipText: { flex: 1, fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#181818' },
  relatedChipRemove: { fontSize: 13, color: '#9B9B9B' },

  galleryRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' },
  // height убран (раньше был 96, как и ширина) — теперь под картинкой ещё
  // инпут alt-текста, высота по контенту.
  galleryItem: { width: 96, position: 'relative' },
  galleryImage: { width: 96, height: 96 },
  galleryRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  galleryRemoveText: { fontSize: 11, color: '#fff' },
  galleryAltInput: { width: 96, marginTop: 6, fontSize: 11, paddingHorizontal: 6, paddingVertical: 6 },
  galleryAdd: { width: 96, height: 96, borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center' },
  galleryAddText: { fontSize: 24, color: '#9B9B9B' },

  saveBtn: { marginTop: 24, backgroundColor: '#181818', paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#fff', fontWeight: 'normal' },
  deleteBtn: { marginTop: 12, borderWidth: 1, borderColor: '#721c24', paddingVertical: 14, alignItems: 'center' },
  deleteBtnText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#721c24' },
  btnDisabled: { opacity: 0.6 },
});
