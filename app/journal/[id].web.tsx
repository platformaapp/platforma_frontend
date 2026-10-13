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
// 720×1280, не админско-настраиваемый промо-баннер списков. Небольшой,
// фиксированного размера (как сайдбар-баннер рядом с текстом на
// theblueprint.ru), а не во всю колонку.
// Ширина и высота заданы числом явно (не width:'100%' + aspectRatio) — у
// Image из require() react-native-web подставляет вместо недостающей
// высоты натуральный пиксельный размер файла (1280), игнорируя aspectRatio
// и растягивая/искажая картинку; явная числовая высота это перебивает.
const SECTION_BANNER_IMAGE = require('@/assets/images/journal-section-banner.jpg');
const SECTION_BANNER_ASPECT_RATIO = 720 / 1280;
const SECTION_BANNER_WIDTH = 300;
const SECTION_BANNER_HEIGHT = Math.round(SECTION_BANNER_WIDTH / SECTION_BANNER_ASPECT_RATIO);
const SECTION_BANNER_TELEGRAM_URL = 'https://t.me/p34forma';

// Размер картинки CTA события внутри статьи — как в статье про советский
// самиздат (aspect-ratio 1.72986, max-width 365, max-height 180). Высота —
// связывающее ограничение (365/1.72986 ≈ 211 > 180), поэтому реальная
// ширина меньше 365. Явные числа, а не aspectRatio+maxWidth+maxHeight —
// та же причина, что и у SECTION_BANNER_* выше: react-native-web сам
// переводит aspectRatio в явную высоту ДО применения max-height, из-за чего
// max-height обрезает картинку, а ширина обратно не пересчитывается (должна
// бы по спеке CSS, но для Image из react-native-web — нет), и картинка
// просто растягивается не в тех пропорциях.
const EVENT_CTA_ASPECT_RATIO = 1.72986;
const EVENT_CTA_MAX_WIDTH = 365;
const EVENT_CTA_MAX_HEIGHT = 180;
const EVENT_CTA_HEIGHT = Math.min(EVENT_CTA_MAX_HEIGHT, Math.round(EVENT_CTA_MAX_WIDTH / EVENT_CTA_ASPECT_RATIO));
const EVENT_CTA_WIDTH = Math.round(EVENT_CTA_HEIGHT * EVENT_CTA_ASPECT_RATIO);

// Маркеры для вставки события/похожей статьи прямо в текст — админ ставит их
// отдельной "строкой-абзацем" где угодно в "Текст" (см. admin/journal-detail.tsx,
// кнопки "Вставить в текст" у события/похожей статьи). CTA "Записаться на
// событие" показывается ТОЛЬКО на месте маркера {{event}} — без него не
// рендерится вовсе (раньше по умолчанию падал в конец статьи, это было
// ошибкой: такой CTA должен быть внутри текста, а не оторван от него).
// Похожие статьи без маркера {{related:<id>}} по-прежнему попадают в блок
// "Окей, что ещё" в конце — этого поведения просьба не касалась.
const EVENT_TOKEN = '{{event}}';
const RELATED_TOKEN_RE = /^\{\{related:([0-9a-fA-F-]+)\}\}$/;

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

// Только дата, без времени и без имени автора в карточке события внутри
// статьи (см. renderEventCtaCard) — это CTA события, а не материала, автору
// там делать нечего.
function formatEventDate(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  } catch {
    return '';
  }
}

// Строка, начинающаяся с "##" (после обрезки пробелов — любое количество
// пробельных символов, включая неразрывный пробел и табы, или вообще без
// них), открывает второй блок (подзаголовок + текст). Раньше детект искал
// точную подстроку "\n## " — ломался на переносах строк \r\n (частый
// результат вставки текста из Word/Telegram/Google Docs) и на любом другом
// пробеле после "##", кроме обычного. Построчный разбор с регуляркой
// устойчив к обоим случаям. Второй "##" и дальше не поддерживаются — в
// макете такой блок всего один.
function parseContent(content: string | null): { intro: string[]; section: { heading: string; body: string[] } | null } {
  if (!content) return { intro: [], section: null };
  const lines = content.split(/\r\n|\r|\n/);
  const headingLineIdx = lines.findIndex((l) => /^##(?!#)/.test(l.trim()));
  if (headingLineIdx === -1) {
    return { intro: content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean), section: null };
  }
  const heading = lines[headingLineIdx].trim().replace(/^##(?!#)\s*/, '').trim();
  const before = lines.slice(0, headingLineIdx).join('\n').trim();
  const after = lines.slice(headingLineIdx + 1).join('\n').trim();
  return {
    intro: before.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    section: { heading, body: after.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) },
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
  // Опционально — выключается в админке (article.showBanner), по умолчанию
  // показан. Это свой, конкретный баннер (не PromoBanner с /journal и /events).
  // Небольшой, фиксированной ширины (как сайдбар-баннер рядом с текстом на
  // theblueprint.ru), а не во всю колонку — alignSelf: 'flex-start' не даёт
  // ему растянуться на всю ширину грид-ячейки.
  const bannerBlock = section && article.showBanner ? (
    <Pressable style={styles.sectionBannerWrap} onPress={() => Linking.openURL(SECTION_BANNER_TELEGRAM_URL)}>
      <Image source={SECTION_BANNER_IMAGE} style={styles.sectionBanner} resizeMode="cover" />
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

  // CTA "Записаться на событие" — вынесен в функцию, т.к. рендерится на месте
  // маркера {{event}} в тексте.
  function renderEventCtaCard() {
    if (!safeArticle.event) return null;
    const event = safeArticle.event;
    return (
      <View style={styles.ctaBlock}>
        <Pressable onPress={() => router.push(`/(tabs)/events/${event.id}` as any)}>
          <Text style={styles.actionLinkText}>+ Записаться на событие</Text>
        </Pressable>
        <Pressable style={styles.ctaCard} onPress={() => router.push(`/(tabs)/events/${event.id}` as any)}>
          {event.coverUrl ? (
            <Image source={{ uri: event.coverUrl }} style={isMobile ? styles.ctaCardImage : styles.eventCtaImage} resizeMode="cover" />
          ) : (
            <View style={isMobile ? styles.ctaCardImage : styles.eventCtaImage} />
          )}
          <Text style={[styles.ctaCardTitle, styles.ctaCardTitleNoLabel]}>{event.title}</Text>
          <Text style={styles.ctaCardMeta}>{formatEventDate(event.datetimeStart ?? undefined)}</Text>
        </Pressable>
      </View>
    );
  }

  // Абзацы текста статьи, с подстановкой {{event}}/{{related:<id>}} на их
  // месте вместо обычного параграфа — так админ может разместить событие или
  // похожую статью прямо внутри текста, а не только в конце (см. комментарий
  // у EVENT_TOKEN/RELATED_TOKEN_RE выше).
  //
  // CTA события — сбоку от текста (не на всю ширину колонки), на десктопе:
  // CSS float тут не работает предсказуемо (react-native-web рендерит View
  // как flex-контейнеры по умолчанию, а float не действует на flex-item —
  // даже обёртка самого плавающего блока в display:'block' не помогает,
  // т.к. ПОСЛЕДУЮЩИЕ абзацы всё равно остаются flex-item'ами общей колонки
  // и не обтекают его). Вместо float — пара "абзац сразу после маркера +
  // карточка" в одной строке грида (тот же приём, что и подзаголовок+баннер
  // выше), раз и навсегда предсказуемо работающий способ расположить что-то
  // рядом с конкретным абзацем. Абзац, идущий СРАЗУ после {{event}},
  // "жертвуется" на эту пару — остальные абзацы остаются на всю ширину.
  function renderParagraphs(paragraphs: string[], keyPrefix: string) {
    const nodes: React.ReactNode[] = [];
    for (let i = 0; i < paragraphs.length; i++) {
      const key = `${keyPrefix}-${i}`;
      const trimmed = paragraphs[i].trim();

      if (trimmed === EVENT_TOKEN) {
        if (!safeArticle.event) continue;
        const next = paragraphs[i + 1];
        const nextIsPlainText = next !== undefined && next.trim() !== EVENT_TOKEN && !RELATED_TOKEN_RE.test(next.trim());
        if (!isMobile && nextIsPlainText) {
          nodes.push(
            <View key={key} style={styles.eventCtaRow}>
              <Text style={styles.body}>{parseInlineMarkdown(next)}</Text>
              {renderEventCtaCard()}
            </View>
          );
          i += 1; // абзац-пара уже отрисован выше, не дублируем его обычным текстом
          continue;
        }
        nodes.push(<View key={key}>{renderEventCtaCard()}</View>);
        continue;
      }

      const relMatch = trimmed.match(RELATED_TOKEN_RE);
      if (relMatch) {
        const item = safeArticle.relatedArticles.find((r) => r.id === relMatch[1]);
        if (item) nodes.push(<View key={key}>{renderRelatedInlineCard(item)}</View>);
        continue;
      }

      nodes.push(<Text key={key} style={styles.body}>{parseInlineMarkdown(paragraphs[i])}</Text>);
    }
    return nodes;
  }

  // Похожие статьи, уже размещённые маркером внутри текста, не дублируются
  // блоком в конце — только те, что админ не разместил явно, попадают в
  // старое поведение (конец статьи). Событие такого запасного варианта не
  // имеет — см. комментарий у EVENT_TOKEN выше.
  const allParagraphs = [...intro, ...(section?.body ?? [])];
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
      <Text style={styles.subheading}>{parseInlineMarkdown(section.heading)}</Text>
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
  // rowGap обязателен: без него вторая строка грида (подзаголовок+текст /
  // баннер) стартует вплотную к первой — при длинной галерее это выглядит
  // как "баннер наезжает на картинки" (визуально ноль отступа между ними).
  articleGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 32, rowGap: 40, marginBottom: 40 } as any,
  mobileStack: { marginBottom: 40 },
  mobileMediaBlock: { marginBottom: 24 },
  // Раньше здесь был maxHeight: 494 — зажимал высоту колонки с обложкой и
  // галереей жёстким потолком. Когда под второй фоткой появлялась подпись,
  // суммарная высота содержимого (обложка + галерея + подпись) превышала
  // этот потолок, и flexbox сжимал саму фотографию, чтобы уместиться —
  // "подпись уменьшала высоту фотографии". Колонка должна просто занимать
  // столько места, сколько нужно её содержимому.
  colImageTop: { minWidth: 240 },
  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 40, marginTop: 0},
  titleMobile: { fontSize: 25, lineHeight: 28 },
  // ~2x исходного размера (был 25/30) — иначе подзаголовок визуально
  // сливается с обычным текстом статьи.
  subheading: { fontSize: 50, lineHeight: 56, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 16 },
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
  body: { fontSize: 18, lineHeight: 26, fontFamily: 'Gramatika-Regular', color: '#010101', marginBottom: 24 },
  coverImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#E5E5E5' },
  // alignItems: 'flex-start' обязателен — без него flexbox по умолчанию
  // растягивает (stretch) оба элемента ряда до высоты самого высокого: когда
  // под правой фоткой есть подпись, её обёртка становится "выше" левой
  // фотографии по натуральному контенту, и левая фотография насильно
  // растягивается (теряя квадратную aspectRatio), либо наоборот сжимается —
  // в любом случае перестаёт быть квадратной. С flex-start каждая картинка
  // остаётся своего естественного (aspectRatio) размера независимо от подписи.
  galleryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginTop: 16 },
  galleryImage: { flex: 1, aspectRatio: 1, backgroundColor: '#E5E5E5', maxWidth: '50%' },
  // Правая фотография — с подписью под ней, поэтому своя обёртка вместо
  // flex/maxWidth прямо на Image (как у galleryImage/левой фотографии).
  galleryImageWithCaption: { flex: 1, maxWidth: '50%' },
  galleryImageInner: { width: '100%', aspectRatio: 1, backgroundColor: '#E5E5E5' },
  galleryCaption: { fontSize: 13, lineHeight: 17, fontFamily: 'Gramatika-Regular', color: '#687076', marginTop: 8 },
  sectionBannerWrap: { width: SECTION_BANNER_WIDTH, alignSelf: 'flex-start' },
  sectionBanner: { width: SECTION_BANNER_WIDTH, height: SECTION_BANNER_HEIGHT, backgroundColor: '#E5E5E5' },

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
  // CTA события внутри текста статьи — сбоку от абзаца, идущего сразу после
  // маркера {{event}} (см. renderParagraphs): простая CSS-grid строка в две
  // колонки, тот же приём, что и у подзаголовка с баннером выше. Правая
  // колонка — под размер самой карточки (365), левая забирает остаток.
  eventCtaRow: { display: 'grid', gridTemplateColumns: '1fr 365px', columnGap: 24, marginBottom: 24 } as any,
  actionLinkText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 15, color: '#E02D2D', paddingVertical: 8, marginBottom: 4 },
  // Те же токены, что и у карточек на /journal (cardCategory/cardTitleText +
  // featuredLabelOne/featuredTitleOne) — картинка на всю ширину блока, под
  // ней подпись и заголовок, а не мелкая горизонтальная мини-карточка.
  ctaCard: {},
  ctaCardImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#E5E5E5' },
  // Размер как у карточки события в статье про советский самиздат — см.
  // расчёт EVENT_CTA_WIDTH/HEIGHT выше.
  eventCtaImage: { width: EVENT_CTA_WIDTH, height: EVENT_CTA_HEIGHT, backgroundColor: '#E5E5E5' },
  ctaCardTitle: { fontSize: 30, lineHeight: 27, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginTop: 13 },
  // У блока "Скачать приложение" нет строки-подписи над заголовком — сдвигаем
  // заголовок так же, как если бы подпись была (20 её marginTop + 13 обычный).
  ctaCardTitleNoLabel: { marginTop: 33 },
  ctaCardMeta: { width: '100%', fontSize: 15, fontFamily: 'Gramatika-Regular', color: '#000', textAlign: 'right', marginTop: 20 },
  appCardStores: { flexDirection: 'row', gap: 16, marginTop: 16 },
  storeLinkText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 13, color: '#E02D2D' },
});
