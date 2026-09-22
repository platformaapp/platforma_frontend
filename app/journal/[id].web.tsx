import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PromoBanner } from '@/components/web/promo-banner';
import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { endpoints } from '@/constants/env';
import { getArticle, type Article } from '@/lib/api/journal';
import { getPublicTutorList, getPublicTutors } from '@/lib/api/tutor';

type RelatedEvent = { id: string; title: string; datetimeStart?: string; coverUrl?: string | null };

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function formatEventTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

/**
 * Контент статьи — обычный текст, абзацы разделены пустой строкой; строка,
 * начинающаяся с "## ", открывает второй блок (подзаголовок + текст) в той
 * же текстовой колонке. Второй "## " и дальше не поддерживаются — в макете
 * такой блок всего один.
 */
function parseContent(content: string | null): { intro: string[]; section: { heading: string; body: string[] } | null } {
  if (!content) return { intro: [], section: null };
  const headingIdx = content.indexOf('\n## ');
  const headingAtStart = content.startsWith('## ');
  if (!headingAtStart && headingIdx === -1) {
    return { intro: content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean), section: null };
  }
  const splitAt = headingAtStart ? 0 : headingIdx + 1;
  const before = content.slice(0, splitAt).trim();
  const after = content.slice(splitAt + 3).trim();
  const newlineIdx = after.indexOf('\n');
  const heading = (newlineIdx === -1 ? after : after.slice(0, newlineIdx)).trim();
  const body = (newlineIdx === -1 ? '' : after.slice(newlineIdx + 1)).trim();
  return {
    intro: before.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    section: { heading, body: body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) },
  };
}

export default function ArticleScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [relatedEvent, setRelatedEvent] = useState<RelatedEvent | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setError('');
      const a = await getArticle(id);
      setArticle(a);

      // Объект author в ответе статьи не содержит shortBio — подтягиваем его
      // через список наставников (тот же приём, что и на странице события).
      if (!a.author.shortBio) {
        try {
          const [authList, publicList] = await Promise.all([getPublicTutorList(), getPublicTutors()]);
          const tutor = authList.find((t) => t.id === a.author.id) ?? publicList.find((t) => t.id === a.author.id);
          const shortBio = (tutor as any)?.shortBio ?? (tutor as any)?.short_bio;
          if (shortBio) {
            setArticle((prev) => (prev ? { ...prev, author: { ...prev.author, shortBio } } : prev));
          }
        } catch { /* короткое био необязательно — блок автора остаётся без него */ }
      }

      try {
        const feedRes = await fetch(`${endpoints.eventsFeed}?per_page=50`);
        if (feedRes.ok) {
          const data = await feedRes.json();
          const list: unknown[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
          const now = Date.now();
          const upcoming = list
            .map((r: any) => ({
              id: String(r.id ?? ''),
              title: String(r.title ?? ''),
              datetimeStart: r.datetimeStart ?? r.datetime_start ?? undefined,
              coverUrl: r.coverUrl ?? r.cover_url ?? null,
              mentorId: String(r.mentor?.id ?? r.mentor?.userId ?? ''),
            }))
            .filter((e) => e.mentorId === a.author.id && (!e.datetimeStart || new Date(e.datetimeStart).getTime() > now));
          setRelatedEvent(upcoming[0] ?? null);
        }
      } catch { /* related event is optional, ignore failures */ }
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить материал');
      setArticle(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <SiteShell><View style={styles.centered}><ActivityIndicator size="large" color="#010101" /></View></SiteShell>;
  }

  if (error || !article) {
    return (
      <SiteShell>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Материал не найден'}</Text>
          <Pressable style={styles.retryButton} onPress={load}><Text style={styles.retryButtonText}>Повторить</Text></Pressable>
        </View>
      </SiteShell>
    );
  }

  const { intro, section } = parseContent(article.content);
  const [galleryLeft, galleryRight] = article.gallery;

  // Заголовок статьи + блок автора — общий "хедер", не зависящий от того,
  // мобильная это раскладка или десктопная.
  const headerBlock = (
    <>
      <Text style={styles.title}>{article.title}</Text>
      <View style={[styles.authorRow, isMobile && styles.authorRowMobile]}>
        <View>
          {article.author.name ? <Text style={styles.author}>{article.author.name}</Text> : null}
          {article.author.roleTitle ? <Text style={styles.role}>{article.author.roleTitle}</Text> : null}
          {article.author.shortBio ? <Text style={styles.authorBio}>{article.author.shortBio}</Text> : null}
        </View>
        {article.author.avatarUrl ? <Image source={{ uri: article.author.avatarUrl }} style={styles.authorAvatar} /> : <View style={styles.authorAvatar} />}
      </View>
    </>
  );

  // Обложка и галерея — единый медиа-блок: текст статьи начинается под
  // обложкой, галерея (если есть) идёт сразу под ней же, а не привязана к
  // случайному "## "-подзаголовку (у реальных статей его никогда нет).
  const mediaBlock = (
    <>
      {article.coverUrl ? <Image source={{ uri: article.coverUrl }} style={styles.coverImage} resizeMode="cover" /> : <View style={styles.coverImage} />}
      {galleryLeft || galleryRight ? (
        <View style={styles.galleryRow}>
          {galleryLeft ? <Image source={{ uri: galleryLeft }} style={styles.galleryImage} resizeMode="cover" /> : null}
          {galleryRight ? <Image source={{ uri: galleryRight }} style={styles.galleryImage} resizeMode="cover" /> : null}
        </View>
      ) : null}
    </>
  );

  const textBlock = (
    <>
      {intro.map((p, i) => <Text key={i} style={styles.body}>{p}</Text>)}
      {section ? (
        <>
          <Text style={styles.subheading}>{section.heading}</Text>
          {section.body.map((p, i) => <Text key={i} style={styles.body}>{p}</Text>)}
        </>
      ) : null}
    </>
  );

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageContent}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/journal' as any))}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>

        {isMobile ? (
          // Мобильная раскладка — один столбец: заголовок и автор сверху,
          // затем обложка и галерея, и только после них текст статьи.
          <View style={styles.mobileStack}>
            {headerBlock}
            <View style={styles.mobileMediaBlock}>{mediaBlock}</View>
            {textBlock}
          </View>
        ) : (
          <View style={styles.row}>
            <View style={styles.colText}>
              {headerBlock}
              {textBlock}
            </View>
            <View style={styles.colImage}>
              {mediaBlock}
            </View>
          </View>
        )}

        <PromoBanner withTelegramLink />

        {/* На десктопе блоки "Записаться на событие" и "Скачать приложение" убраны */}
        {isMobile && relatedEvent ? (
          <View style={styles.ctaBlock}>
            <Pressable onPress={() => router.push(`/(tabs)/events/${relatedEvent.id}` as any)}>
              <Text style={styles.actionLinkText}>+ Записаться на событие</Text>
            </Pressable>
            <Pressable style={styles.ctaCard} onPress={() => router.push(`/(tabs)/events/${relatedEvent.id}` as any)}>
              {relatedEvent.coverUrl ? <Image source={{ uri: relatedEvent.coverUrl }} style={styles.ctaCardImage} resizeMode="cover" /> : <View style={styles.ctaCardImage} />}
              <Text style={styles.ctaCardLabel} numberOfLines={1}>{article.author.name}</Text>
              <Text style={styles.ctaCardTitle} numberOfLines={2}>{relatedEvent.title}</Text>
              <Text style={styles.ctaCardMeta}>{formatEventTime(relatedEvent.datetimeStart)}</Text>
            </Pressable>
          </View>
        ) : null}

        {isMobile ? (
          <View style={styles.ctaBlock}>
            <Text style={styles.actionLinkText}>Скачать приложение</Text>
            <View style={styles.ctaCard}>
              <View style={styles.ctaCardImage} />
              <Text style={[styles.ctaCardTitle, styles.ctaCardTitleNoLabel]} numberOfLines={3}>Скачайте приложение p34 и найдите себе наставника по душе</Text>
              <View style={styles.appCardStores}>
                <Pressable onPress={() => Linking.openURL('https://apps.apple.com')}>
                  <Text style={styles.storeLinkText}>app store</Text>
                </Pressable>
                <Pressable onPress={() => Linking.openURL('https://play.google.com')}>
                  <Text style={styles.storeLinkText}>google play</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>

        <SiteFooter />
      </ScrollView>
    </SiteShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 24, paddingBottom: 24 },
  pageContent: { paddingHorizontal: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 16 },
  retryButton: { borderWidth: 1, borderColor: '#010101', paddingVertical: 10, paddingHorizontal: 32 },
  retryButtonText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101' },

  backArrow: { fontSize: 25, color: '#010101', marginBottom: 24 },
  // Десктоп: единая двухколоночная строка — весь текст (заголовок, автор,
  // абзацы) в одной колонке, обложка+галерея — в другой; так текст и медиа
  // просто текут каждый в своей колонке, не привязанные построчно друг к
  // другу. Мобильный: один столбец, порядок задаётся отдельно в JSX
  // (headerBlock → mediaBlock → textBlock — текст начинается под обложкой).
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 32, marginBottom: 40 },
  mobileStack: { marginBottom: 40 },
  mobileMediaBlock: { marginBottom: 24 },
  // flexShrink явно 1 — у RN Web дефолт 0, без этого колонка не сжимается
  // ниже flexBasis и текст вылезает за край на узких экранах.
  colText: { flexBasis: 420, flexGrow: 1, flexShrink: 1, minWidth: 280 },
  colImage: { flexBasis: 420, flexGrow: 1, flexShrink: 1, minWidth: 240 },
  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 16 },
  subheading: { fontSize: 25, lineHeight: 30, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 16 },
  // Имя+роль+био — текстом сверху, квадратное (не круглое) фото под ним;
  // большой отступ снизу перед первым абзацем — см. референс (десктоп-макет).
  // На мобильном тот же отступ выглядит пустым провалом без картинки рядом —
  // сокращаем его.
  authorRow: { marginBottom: 240 },
  authorRowMobile: { marginBottom: 32 },
  authorAvatar: { width: 48, height: 48, marginTop: 12, backgroundColor: '#E5E5E5' },
  author: { fontSize: 15, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
  role: { fontSize: 13, fontFamily: 'Gramatika-Regular', color: '#687076' },
  authorBio: { fontSize: 13, lineHeight: 18, fontFamily: 'Gramatika-Regular', color: '#010101', marginTop: 8, maxWidth: 280 },
  body: { fontSize: 19, lineHeight: 26, fontFamily: 'Gramatika-Regular', color: '#010101', marginBottom: 16 },
  coverImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#E5E5E5' },
  galleryRow: { flexDirection: 'row', gap: 16, marginTop: 16 },
  galleryImage: { flex: 1, aspectRatio: 1, backgroundColor: '#E5E5E5' },

  ctaBlock: { marginTop: 8, marginBottom: 40, maxWidth: 420 },
  actionLinkText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 15, color: '#E02D2D', paddingVertical: 8, marginBottom: 4 },
  // Те же токены, что и у карточек на /journal (cardCategory/cardTitleText +
  // featuredLabelOne/featuredTitleOne) — картинка на всю ширину блока, под
  // ней подпись и заголовок, а не мелкая горизонтальная мини-карточка.
  ctaCard: {},
  ctaCardImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#E5E5E5' },
  ctaCardLabel: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#687076', marginTop: 20 },
  ctaCardTitle: { fontSize: 30, lineHeight: 27, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginTop: 13 },
  // У блока "Скачать приложение" нет строки-подписи над заголовком — сдвигаем
  // заголовок так же, как если бы подпись была (20 её marginTop + 13 обычный).
  ctaCardTitleNoLabel: { marginTop: 33 },
  ctaCardMeta: { width: '100%', fontSize: 15, fontFamily: 'Gramatika-Regular', color: '#000', textAlign: 'right', marginTop: 20 },
  appCardStores: { flexDirection: 'row', gap: 16, marginTop: 16 },
  storeLinkText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 13, color: '#E02D2D' },
});
