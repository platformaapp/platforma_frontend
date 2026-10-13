import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { getArticle, type Article, type RelatedArticle } from '@/lib/api/journal';
import { getPublicTutorList, getPublicTutors } from '@/lib/api/tutor';
import { parseInlineMarkdown } from '@/lib/markdown-inline';

// "Окей, что ещё" — до 3 связанных статей вместо баннера в конце (выбраны в
// админке, см. admin/journal-detail.tsx). Та же сетка-тройка (403/365/340),
// что и строки на /journal (см. ROW_ASPECTS в journal/index.web.tsx) — тут
// всегда ровно одна строка, т.к. связанных статей не больше 3.
const RELATED_ASPECTS: [number, number, number] = [403 / 285, 365 / 211, 340 / 232];
const RELATED_GRID_COLUMNS: [string, string, string] = ['1', '3', '5'];

// Баннер рядом со вторым подзаголовком — свой, отдельный от PromoBanner
// (того, что на /journal и /events): конкретная портретная картинка
// 720×1280, не админско-настраиваемый промо-баннер списков.
const SECTION_BANNER_IMAGE = require('@/assets/images/journal-section-banner.jpg');
const SECTION_BANNER_ASPECT_RATIO = 720 / 1280;
const SECTION_BANNER_TELEGRAM_URL = 'https://t.me/p34forma';

// Маркеры для вставки события/похожей статьи прямо в текст (а не только в
// конце) — админ ставит их отдельной "строкой-абзацем" где угодно в "Текст"
// (см. admin/journal-detail.tsx, кнопки "Вставить в текст" у события/похожей
// статьи). Если маркера нет нигде в статье — старое поведение сохраняется:
// блок показывается в конце (см. relatedArticlesForEnd/eventInlineUsed ниже).
const EVENT_TOKEN = '{{event}}';
const RELATED_TOKEN_RE = /^\{\{related:([0-9a-fA-F-]+)\}\}$/;

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function formatEventTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
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

  const titleElement = <Text style={[styles.title, isMobile && styles.titleMobile]}>{article.title}</Text>;

  // На десктопе идёт сразу под заголовком (см. колонку текста); на мобильном
  // — после обложки, а не перед ней (см. референс: заголовок → обложка →
  // автор → текст).
  const authorNameAndRole = (
    <>
      {article.author.name ? <Text style={styles.author}>{article.author.name}</Text> : null}
      {article.author.roleTitle ? <Text style={styles.role}>{article.author.roleTitle}</Text> : null}
    </>
  );

  const authorBlock = (
    <View style={[styles.authorRow, isMobile && styles.authorRowMobile]}>
      <View>
        {article.author.id ? (
          <Pressable onPress={() => router.push(`/(tabs)/explore/${article.author.id}` as any)}>
            {authorNameAndRole}
          </Pressable>
        ) : authorNameAndRole}
        {article.author.shortBio ? <Text style={styles.authorBio}>{article.author.shortBio}</Text> : null}
      </View>
      {article.author.avatarUrl ? <Image source={{ uri: article.author.avatarUrl }} style={styles.authorAvatar} /> : <View style={styles.authorAvatar} />}
    </View>
  );

  // Обложка и галерея — единый медиа-блок: текст статьи начинается под
  // обложкой, галерея (если есть) идёт сразу под ней же, а не привязана к
  // случайному "## "-подзаголовку (у реальных статей его никогда нет).
  // Подпись — только под второй (правой) фотографией, см. admin/journal-detail.tsx.
  const mediaBlock = (
    <>
      {article.coverUrl ? <Image source={{ uri: article.coverUrl }} style={styles.coverImage} resizeMode="cover" /> : <View style={styles.coverImage} />}
      {galleryLeft || galleryRight ? (
        <View style={styles.galleryRow}>
          {galleryLeft ? <Image source={{ uri: galleryLeft }} style={styles.galleryImage} resizeMode="cover" /> : null}
          {galleryRight ? (
            <View style={styles.galleryImageWithCaption}>
              <Image source={{ uri: galleryRight }} style={styles.galleryImageInner} resizeMode="cover" />
              {article.galleryCaption ? <Text style={styles.galleryCaption}>{article.galleryCaption}</Text> : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );

  // Баннер — только рядом со вторым подзаголовком (см. ниже, desktop grid
  // row 2); если в статье нет "## "-блока, баннеру просто не с чем
  // соседствовать — не показываем его отдельно в конце, как было раньше.
  // Это свой, конкретный баннер (не PromoBanner с /journal и /events).
  const bannerBlock = section ? (
    <Pressable onPress={() => Linking.openURL(SECTION_BANNER_TELEGRAM_URL)}>
      <Image source={SECTION_BANNER_IMAGE} style={[styles.sectionBanner, { aspectRatio: SECTION_BANNER_ASPECT_RATIO }]} resizeMode="cover" />
    </Pressable>
  ) : null;

  function renderRelatedCard(item: RelatedArticle, posInRow: 0 | 1 | 2) {
    return (
      <Pressable key={item.id} style={{ gridColumn: RELATED_GRID_COLUMNS[posInRow] } as any} onPress={() => router.push(`/journal/${item.id}` as any)}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={[styles.relatedImage, { aspectRatio: RELATED_ASPECTS[posInRow] }]} resizeMode="cover" />
        ) : (
          <View style={[styles.relatedImage, { aspectRatio: RELATED_ASPECTS[posInRow] }]} />
        )}
        {item.category ? <Text style={styles.relatedCategory}>{item.category}</Text> : null}
        <Text style={styles.relatedTitle}>{item.title}</Text>
      </Pressable>
    );
  }

  // Одна похожая статья, вставленная маркером {{related:<id>}} прямо в текст
  // — компактная карточка в ширину текстовой колонки, а не строка грида-тройки.
  function renderRelatedInlineCard(item: RelatedArticle) {
    return (
      <Pressable style={styles.inlineRelatedCard} onPress={() => router.push(`/journal/${item.id}` as any)}>
        {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.inlineRelatedImage} resizeMode="cover" /> : <View style={styles.inlineRelatedImage} />}
        {item.category ? <Text style={styles.relatedCategory}>{item.category}</Text> : null}
        <Text style={styles.relatedTitle}>{item.title}</Text>
      </Pressable>
    );
  }

  // TS не умеет протащить сужение "article не null" (проверено выше, при
  // раннем return) внутрь вложенных function-деклараций — фиксируем это
  // локальной константой с заведомо известным типом.
  const safeArticle: Article = article;

  // CTA "Записаться на событие" — вынесен в функцию, т.к. рендерится либо на
  // месте маркера {{event}} в тексте, либо (если маркера нет) в конце статьи.
  function renderEventCtaCard() {
    if (!safeArticle.event) return null;
    const event = safeArticle.event;
    return (
      <View style={styles.ctaBlock}>
        <Pressable onPress={() => router.push(`/(tabs)/events/${event.id}` as any)}>
          <Text style={styles.actionLinkText}>+ Записаться на событие</Text>
        </Pressable>
        <Pressable style={styles.ctaCard} onPress={() => router.push(`/(tabs)/events/${event.id}` as any)}>
          {event.coverUrl ? <Image source={{ uri: event.coverUrl }} style={styles.ctaCardImage} resizeMode="cover" /> : <View style={styles.ctaCardImage} />}
          <Text style={styles.ctaCardLabel} numberOfLines={1}>{safeArticle.author.name}</Text>
          <Text style={styles.ctaCardTitle}>{event.title}</Text>
          <Text style={styles.ctaCardMeta}>{formatEventTime(event.datetimeStart ?? undefined)}</Text>
        </Pressable>
      </View>
    );
  }

  // Абзацы текста статьи, с подстановкой {{event}}/{{related:<id>}} на их
  // месте вместо обычного параграфа — так админ может разместить событие или
  // похожую статью прямо внутри текста, а не только в конце (см. комментарий
  // у EVENT_TOKEN/RELATED_TOKEN_RE выше).
  function renderParagraphs(paragraphs: string[], keyPrefix: string) {
    return paragraphs.map((p, i) => {
      const key = `${keyPrefix}-${i}`;
      const trimmed = p.trim();
      if (trimmed === EVENT_TOKEN) {
        return safeArticle.event ? <View key={key}>{renderEventCtaCard()}</View> : null;
      }
      const relMatch = trimmed.match(RELATED_TOKEN_RE);
      if (relMatch) {
        const item = safeArticle.relatedArticles.find((r) => r.id === relMatch[1]);
        return item ? <View key={key}>{renderRelatedInlineCard(item)}</View> : null;
      }
      return <Text key={key} style={styles.body}>{parseInlineMarkdown(p)}</Text>;
    });
  }

  // Статьи/событие, уже размещённые маркером внутри текста, не дублируются
  // блоком в конце — только те, что админ не разместил явно, попадают в
  // старое поведение (конец статьи).
  const allParagraphs = [...intro, ...(section?.body ?? [])];
  const eventInlineUsed = allParagraphs.some((p) => p.trim() === EVENT_TOKEN);
  const relatedInlineIds = new Set(
    allParagraphs.map((p) => p.trim().match(RELATED_TOKEN_RE)?.[1]).filter((x): x is string => !!x)
  );
  const relatedArticlesForEnd = article.relatedArticles.filter((r) => !relatedInlineIds.has(r.id));

  const relatedBlock = relatedArticlesForEnd.length > 0 ? (
    <View style={styles.relatedSection}>
      <Text style={styles.relatedSectionTitle}>Окей, что ещё</Text>
      <View style={[styles.relatedRow, isMobile && styles.relatedRowMobile]}>
        {relatedArticlesForEnd.map((a, i) => renderRelatedCard(a, (isMobile ? 0 : i) as 0 | 1 | 2))}
      </View>
    </View>
  ) : null;

  const introBlock = renderParagraphs(intro, 'intro');

  const sectionBlock = section ? (
    <>
      <Text style={styles.subheading}>{section.heading}</Text>
      {renderParagraphs(section.body, 'section')}
    </>
  ) : null;

  return (
    <SiteShell>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageContent}>
        {isMobile ? (
          // Мобильная раскладка — один столбец: заголовок, затем обложка (+
          // галерея), затем автор, и только после них текст статьи. Баннер
          // (если есть второй подзаголовок) — сразу после второго блока
          // текста, "рядом" тут не применимо (один столбец).
          <View style={styles.mobileStack}>
            {titleElement}
            <View style={styles.mobileMediaBlock}>{mediaBlock}</View>
            {authorBlock}
            {introBlock}
            {sectionBlock}
            {bannerBlock}
          </View>
        ) : (
          // CSS Grid, а не два независимых flex-столбца — нужно, чтобы вторая
          // строка (подзаголовок+текст / баннер) стартовала на одном уровне в
          // обеих колонках: баннер должен оказаться напротив второго
          // подзаголовка, а это достижимо только если это пара прямых детей
          // грида в одной и той же строке (см. тот же приём на /explore/[id]).
          <View style={styles.articleGrid}>
            <View>
              {titleElement}
              {authorBlock}
              {introBlock}
            </View>
            <View style={styles.colImageTop}>
              {mediaBlock}
            </View>
            {section ? (
              <>
                <View>{sectionBlock}</View>
                <View>{bannerBlock}</View>
              </>
            ) : null}
          </View>
        )}

        {relatedBlock}

        {/* Событие, явно привязанное к статье в админке — показываем тут,
            только если админ не вставил маркер {{event}} внутри текста (см.
            renderParagraphs выше); иначе оно уже отрендерено на своём месте. */}
        {article.event && !eventInlineUsed ? renderEventCtaCard() : null}

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

  // Десктоп: CSS Grid (не два независимых flex-столбца) — строка 2
  // (подзаголовок+текст / баннер) должна стартовать на одном уровне в обеих
  // колонках, иначе баннер не окажется напротив подзаголовка (см. комментарий
  // в JSX). Мобильный: один столбец, порядок — отдельно в JSX (titleElement →
  // mediaBlock → authorBlock → introBlock → sectionBlock → bannerBlock).
  articleGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 32, marginBottom: 40 } as any,
  mobileStack: { marginBottom: 40 },
  mobileMediaBlock: { marginBottom: 24 },
  colImageTop: { minWidth: 240, maxHeight: 494 },
  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 40, marginTop: 0},
  titleMobile: { fontSize: 25, lineHeight: 28 },
  subheading: { fontSize: 25, lineHeight: 30, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 16 },
  // Имя+роль+био — текстом сверху, квадратное (не круглое) фото под ним;
  // большой отступ снизу перед первым абзацем — см. референс (десктоп-макет).
  // На мобильном тот же отступ выглядит пустым провалом без картинки рядом —
  // сокращаем его.
  authorRow: { marginBottom: 240 },
  authorRowMobile: { marginBottom: 32 },
  authorAvatar: { width: 48, height: 48, marginTop: 12, backgroundColor: '#E5E5E5' },
  author: { fontSize: 18, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
  role: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#687076' },
  authorBio: { fontSize: 18, lineHeight: 18, fontFamily: 'Gramatika-Regular', color: '#010101', marginTop: 8, maxWidth: 280 },
  body: { fontSize: 18, lineHeight: 26, fontFamily: 'Gramatika-Regular', color: '#010101', marginBottom: 16 },
  coverImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#E5E5E5' },
  galleryRow: { flexDirection: 'row', gap: 16, marginTop: 16 },
  galleryImage: { flex: 1, aspectRatio: 1, backgroundColor: '#E5E5E5', maxWidth: '50%' },
  // Правая фотография — с подписью под ней, поэтому своя обёртка вместо
  // flex/maxWidth прямо на Image (как у galleryImage/левой фотографии).
  galleryImageWithCaption: { flex: 1, maxWidth: '50%' },
  galleryImageInner: { width: '100%', aspectRatio: 1, backgroundColor: '#E5E5E5' },
  galleryCaption: { fontSize: 13, lineHeight: 17, fontFamily: 'Gramatika-Regular', color: '#687076', marginTop: 8 },
  sectionBanner: { width: '100%', backgroundColor: '#E5E5E5' },

  // "Окей, что ещё" — те же токены карточки, что на /journal (cardCategory/
  // cardTitleText), сетка-тройка 403/365/340 (см. ROW_ASPECTS в journal/index.web.tsx).
  relatedSection: { marginTop: 97, marginBottom: 40 },
  relatedSectionTitle: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 40 },
  relatedRow: { display: 'grid', gridTemplateColumns: '403fr 75fr 365fr 266fr 340fr' } as any,
  relatedRowMobile: { display: 'flex', flexDirection: 'column', gap: 24 } as any,
  relatedImage: { width: '100%', backgroundColor: '#E5E5E5' },
  relatedCategory: { fontSize: 18, fontFamily: 'Gramatika-Regular', color: '#687076', lineHeight: 18, marginTop: 18 },
  relatedTitle: { fontSize: 25, lineHeight: 25, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginTop: 12 },

  // Похожая статья, вставленная маркером прямо в текст — в ширину текстовой
  // колонки (maxWidth 420, как у ctaBlock), а не грид-тройка как в конце статьи.
  inlineRelatedCard: { marginVertical: 24, maxWidth: 420 },
  inlineRelatedImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#E5E5E5' },

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
