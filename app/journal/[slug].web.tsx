import Head from 'expo-router/head';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SiteFooter } from '@/components/web/site-footer';
import { SiteShell, useIsMobileWeb } from '@/components/web/site-shell';
import { TagList } from '@/components/web/tag-list';
import { API_BASE, endpoints } from '@/constants/env';
import { getArticle, type Article, type RelatedArticle } from '@/lib/api/journal';
import { parseFeedItems } from '@/lib/event-feed';
import { parseInlineMarkdown } from '@/lib/markdown-inline';

// "Окей, что ещё" — ближайшие события той же категории, что у события,
// привязанного к статье (article.event.category) — только когда оно есть;
// без привязанного события показывать "из той же категории" не из чего,
// блок просто не рендерится (см. categoryEvents/relatedBlock).
type UpcomingCategoryEvent = { id: string; title: string; coverUrl: string | null; datetimeStart: string | null };
const UPCOMING_EVENTS_LIMIT = 3;

function resolveEventCoverUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

// "Окей, что ещё" — до 3 связанных статей вместо баннера в конце (выбраны в
// админке, см. admin/journal-detail.tsx). Та же сетка-тройка (403/365/340),
// что и строки на /journal (см. ROW_ASPECTS в journal/index.web.tsx) — тут
// всегда ровно одна строка, т.к. связанных статей не больше 3.
const RELATED_ASPECTS: [number, number, number] = [403 / 285, 365 / 211, 340 / 232];
const RELATED_GRID_COLUMNS: [string, string, string] = ['1', '3', '5'];

// Баннер рядом со вторым подзаголовком — свой, отдельный от PromoBanner
// (того, что на /journal и /events): конкретная портретная картинка
// 720×1280 (текст сверху, фото снизу), не админско-настраиваемый промо-
// баннер списков. Квадратная обёртка (см. sectionBannerWrap) показывает
// только верхнюю (текстовую) часть, см. комментарий у bannerBlock.
const SECTION_BANNER_IMAGE = require('@/assets/images/journal-section-banner.jpg');

// Картинка в блоке "Скачать приложение" (мобильный, низ статьи) — раньше
// был просто серый плейсхолдер без картинки, взята с vladyakunin.ru (та же
// чб-портретная эстетика, что и у section-banner выше).
const APP_DOWNLOAD_IMAGE = require('@/assets/images/app-download-photo.png');
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

// Маркеры в "Текст" — админ ставит их отдельной "строкой-абзацем" где угодно
// (см. admin/journal-detail.tsx, кнопки "Вставить в текст" у события/похожей
// статьи), сам текст маркера убирается при рендере (никогда не виден). Два
// РАЗНЫХ случая:
// - {{event}} — позиция, как правило, ИМЕЕТ значение: CTA события должен
//   оказаться напротив того места, где стоит маркер (текст до него — одна
//   строка грида с обложкой/галереей/баннером, текст после — следующая
//   строка с самой карточкой, см. eventMarkerIdx/hasEventSplit ниже). НО
//   если после маркера в тексте не осталось ни одного настоящего абзаца
//   (маркер — последний, "текста мало"), разбивать не на что — тогда маркер
//   работает просто как включатель показа, а карточка идёт своим чередом в
//   правой колонке сразу после баннера (как похожие статьи ниже), без
//   разбиения текста. Баннер, для сравнения, НЕ позиционируется так — он
//   простой фиксированный элемент сразу после обложки/галереи, независимо
//   от текста.
// - {{related:<id>}} — позиция не важна, только факт: такая похожая статья
//   уходит в правую колонку (без привязки к конкретному абзацу).
const EVENT_TOKEN = '{{event}}';
const RELATED_TOKEN_RE = /^\{\{related:([0-9a-fA-F-]+)\}\}$/;

// Фолбэк для og:description/meta description, когда в админке не заполнено
// SEO-поле "Meta Description" — берём начало текста статьи, убираем
// markdown-маркеры тулбара (см. TOOLBAR_ACTIONS в admin/journal-detail.tsx) и
// служебные токены ({{event}}/{{related:...}}/"## "), схлопываем пробелы.
function excerptFromContent(content: string | null, maxLen = 160): string {
  if (!content) return '';
  const plain = content
    .replace(/\{\{event\}\}/g, '')
    .replace(/\{\{related:[0-9a-fA-F-]+\}\}/g, '')
    .replace(/^##\s*/gm, '')
    .replace(/[*_~=]{1,2}|\{[+-]|[+-]\}/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen).trimEnd()}…`;
}

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

// Дата+время — тот же формат, что и на самой странице события
// (events/[id].web.tsx formatDatetime), для мобильного CTA (renderEventCtaCard):
// там он "в точности как событие на мобильном", с временем, а не только датой.
function formatEventDatetime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const month = MONTHS_GEN[d.getMonth()];
    const hh = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${hh}:${mm}`;
  } catch {
    return iso ?? '';
  }
}

// Строка, начинающаяся с "##" (после обрезки пробелов — любое количество
// пробельных символов, включая неразрывный пробел и табы, или вообще без
// них), открывает подзаголовок + текст после него. Раньше детект искал
// точную подстроку "\n## " — ломался на переносах строк \r\n (частый
// результат вставки текста из Word/Telegram/Google Docs) и на любом другом
// пробеле после "##", кроме обычного. Построчный разбор с регуляркой
// устойчив к обоим случаям. Поддерживается ЛЮБОЕ число "##"-подзаголовков
// подряд (не только один, как раньше) — баннер в статье встаёт именно
// напротив ВТОРОГО из них (см. hasSecondHeading/secondHeadingIdx ниже),
// первый подзаголовок баннером не затрагивается.
function parseContent(content: string | null): { intro: string[]; sections: { heading: string; body: string[] }[] } {
  if (!content) return { intro: [], sections: [] };
  const lines = content.split(/\r\n|\r|\n/);
  const headingLineIdxs: number[] = [];
  lines.forEach((l, i) => { if (/^##(?!#)/.test(l.trim())) headingLineIdxs.push(i); });
  if (headingLineIdxs.length === 0) {
    return { intro: content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean), sections: [] };
  }
  const before = lines.slice(0, headingLineIdxs[0]).join('\n').trim();
  const sections = headingLineIdxs.map((startIdx, i) => {
    const endIdx = i + 1 < headingLineIdxs.length ? headingLineIdxs[i + 1] : lines.length;
    const heading = lines[startIdx].trim().replace(/^##(?!#)\s*/, '').trim();
    const bodyText = lines.slice(startIdx + 1, endIdx).join('\n').trim();
    return { heading, body: bodyText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) };
  });
  return {
    intro: before.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    sections,
  };
}

export default function ArticleScreenWeb() {
  const router = useRouter();
  const isMobile = useIsMobileWeb();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryEvents, setCategoryEvents] = useState<UpcomingCategoryEvent[]>([]);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      setError('');
      const a = await getArticle(slug);
      setArticle(a);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить материал');
      setArticle(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  // Ближайшие события той же категории, что у привязанного к статье события
  // (см. UpcomingCategoryEvent выше) — для "Окей, что ещё" в конце статьи.
  // Серверной фильтрации по категории у /events/feed нет (см. events-feed-
  // query.dto.ts бэкенда), поэтому берём одну страницу фида и фильтруем на
  // клиенте — тот же приём, что уже используется в explore/[id].web.tsx для
  // "Событий наставника".
  useEffect(() => {
    const linkedEvent = article?.event;
    if (!linkedEvent?.category) { setCategoryEvents([]); return; }
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${endpoints.eventsFeed}?page=1&per_page=50`);
        if (!res.ok) return;
        const data = await res.json();
        const raw = parseFeedItems(data) as Record<string, unknown>[];
        const now = Date.now();
        const matches: UpcomingCategoryEvent[] = raw
          .filter((r) => String(r.id ?? '') !== linkedEvent.id && r.category === linkedEvent.category)
          .map((r) => ({
            id: String(r.id ?? ''),
            title: String(r.title ?? ''),
            coverUrl: resolveEventCoverUrl(r.coverUrl ?? r.cover_url),
            datetimeStart: (r.datetimeStart ?? r.datetime_start ?? r.startAt ?? r.start_at) as string | undefined ?? null,
          }))
          .filter((e) => !e.datetimeStart || new Date(e.datetimeStart).getTime() > now)
          .sort((a, b) => (a.datetimeStart ?? '').localeCompare(b.datetimeStart ?? ''))
          .slice(0, UPCOMING_EVENTS_LIMIT);
        if (active) setCategoryEvents(matches);
      } catch { /* блок "Окей, что ещё" просто не покажется */ }
    })();
    return () => { active = false; };
    // Нарочно зависим только от id/category, а не от всего article.event:
    // остальные его поля (cover_url/price/...) не влияют на подборку "той
    // же категории".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.event?.id, article?.event?.category]);

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

  const { intro, sections } = parseContent(article.content);
  const [galleryLeft, galleryRight] = article.gallery;

  // H1 — видимый заголовок на странице, заменяет обычный title, только
  // если задан в админке (SEO-блок, admin/journal-detail.tsx); seoTitle/
  // metaDescription ни на что в разметке страницы не влияют, кроме <head>.
  const visibleTitle = article.h1 || article.title;
  const titleElement = <Text style={[styles.title, isMobile && styles.titleMobile]}>{visibleTitle}</Text>;
  const pageTitle = article.seoTitle || article.title;
  const pageDescription = article.metaDescription || excerptFromContent(article.content);
  // og:title/og:description — отдельные поля (могут отличаться от
  // формулировки сниппета в поиске), фолбэк на seoTitle/metaDescription,
  // если не заданы — см. комментарий у Article.ogTitle на бэкенде.
  const ogTitle = article.ogTitle || pageTitle;
  const ogDescription = article.ogDescription || pageDescription;
  const pageUrl = `https://platformaapp.ru/journal/${article.slug}`;
  // canonical — явно заданный в админке (для дублей/пересекающихся по теме
  // статей) или собственный URL статьи по умолчанию.
  const canonicalUrl = article.canonicalUrl || pageUrl;
  // robots — noindex/nofollow настраиваются в админке точечно на статью
  // (черновики/слабый контент/дубли), не убирая её с самого сайта.
  const robotsParts = [article.noindex ? 'noindex' : 'index', article.nofollow ? 'nofollow' : 'follow'];
  // Structured data (schema.org Article) — datePublished/dateModified и
  // автор, сигнал E-E-A-T и свежести контента для поисковика.
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: pageTitle,
    description: pageDescription || undefined,
    image: article.coverUrl || undefined,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { '@type': 'Person', name: article.author.name },
  };
  // og:* — превью при расшаривании ссылки (Telegram и т.п.). ВАЖНО: сайт
  // собирается как статический SPA-шелл без SSR (app.json: web.output =
  // "static", .htaccess/_redirects переписывают любой путь на /index.html),
  // поэтому <head>, который сюда попадает через expo-router/head, рисуется
  // уже В БРАУЗЕРЕ после загрузки JS и данных статьи. Боты соцсетей (в т.ч.
  // Telegram) JS не исполняют — эти теги они не увидят, превью будет
  // дефолтным/пустым, пока сайт не получит серверный рендер для этих
  // маршрутов. Google и Яндекс дорендеривают JS (с задержкой), им эти
  // теги всё же помогают — поэтому оставляем.
  const headElement = (
    <Head>
      <title>{pageTitle}</title>
      {pageDescription ? <meta name="description" content={pageDescription} /> : null}
      <meta name="robots" content={robotsParts.join(', ')} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:type" content="article" />
      <meta property="og:title" content={ogTitle} />
      {ogDescription ? <meta property="og:description" content={ogDescription} /> : null}
      <meta property="og:url" content={pageUrl} />
      {article.coverUrl ? <meta property="og:image" content={article.coverUrl} /> : null}
      <meta name="twitter:card" content={article.coverUrl ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={ogTitle} />
      {ogDescription ? <meta name="twitter:description" content={ogDescription} /> : null}
      {article.coverUrl ? <meta name="twitter:image" content={article.coverUrl} /> : null}
      <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
    </Head>
  );

  // Под заголовком — только имя, серым, без фото и без роли/био (раньше
  // был целый блок с фото+имя+роль+био, см. git history), кликабельно на
  // страницу наставника, если он известен.
  const authorBlock = article.author.name ? (
    <View style={styles.authorRow}>
      {article.author.id ? (
        <Pressable style={styles.authorNameShrink} onPress={() => router.push(`/(tabs)/explore/${article.author.id}` as any)}>
          <Text style={styles.author}>{article.author.name}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.author, styles.authorNameShrink]}>{article.author.name}</Text>
      )}
      <TagList tags={article.tags} textStyle={styles.author} onTagPress={(t) => router.push(`/journal?tag=${encodeURIComponent(t)}` as any)} />
    </View>
  ) : null;

  // Обложка и галерея — единый медиа-блок: текст статьи начинается под
  // обложкой, галерея (если есть) идёт сразу под ней же, а не привязана к
  // случайному "## "-подзаголовку (у реальных статей его никогда нет).
  // Подпись — только под второй (правой) фотографией, см. admin/journal-detail.tsx.
  const mediaBlock = (
    <>
      {article.coverUrl ? (
        <Image source={{ uri: article.coverUrl }} style={styles.coverImage} resizeMode="cover" accessibilityLabel={article.coverAlt || article.title} />
      ) : (
        <View style={styles.coverImage} />
      )}
      {galleryLeft || galleryRight ? (
        <View style={styles.galleryRow}>
          {galleryLeft ? (
            <Image source={{ uri: galleryLeft }} style={styles.galleryImage} resizeMode="cover" accessibilityLabel={article.galleryAlt[0] || article.title} />
          ) : null}
          {galleryRight ? (
            <View style={styles.galleryImageWithCaption}>
              <Image source={{ uri: galleryRight }} style={styles.galleryImageInner} resizeMode="cover" accessibilityLabel={article.galleryAlt[1] || article.galleryCaption || article.title} />
              {article.galleryCaption ? <Text style={styles.galleryCaption}>{article.galleryCaption}</Text> : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );

  // Баннер — опционально, выключается в админке (article.showBanner). Это
  // свой, конкретный баннер (не PromoBanner с /journal и /events).
  // Квадрат шириной 50% родительского блока, по центру (паддинг-трюк:
  // paddingBottom — тот же процент, что и width, см. тот же приём у
  // avatarBox на /explore). Картинка внутри — inset:0 (top/left/right/
  // bottom:0, см. тот же приём у avatar там же) и resizeMode="cover" —
  // заполняет квадрат целиком и обрезается по центру независимо от
  // исходных пропорций картинки (не aspectRatio: react-native-web
  // игнорирует aspectRatio для Image из require(), см. git history).
  // На мобильном баннер — первым перед статьёй (см. mobileStack ниже) и по
  // ширине как обложка (100%, не 50%-квадрат по центру, как на десктопе) —
  // sectionBannerWrapMobile меняет только width/paddingBottom, крупность
  // кропа (квадрат) остаётся та же, т.к. картинка-источник уже квадратная.
  const bannerBlock = article.showBanner ? (
    <Pressable style={[styles.sectionBannerWrap, isMobile && styles.sectionBannerWrapMobile]} onPress={() => Linking.openURL(SECTION_BANNER_TELEGRAM_URL)}>
      <Image source={SECTION_BANNER_IMAGE} style={styles.sectionBanner} resizeMode="cover" />
    </Pressable>
  ) : null;

  // "Окей, что ещё" — те же токены карточки, что раньше были у похожих
  // статей (relatedCategory/relatedTitle), плюс дата события.
  function renderUpcomingEventCard(item: UpcomingCategoryEvent, posInRow: 0 | 1 | 2) {
    const dateText = formatEventDate(item.datetimeStart ?? undefined);
    return (
      <Pressable key={item.id} style={{ gridColumn: RELATED_GRID_COLUMNS[posInRow] } as any} onPress={() => router.push(`/(tabs)/events/${item.id}` as any)}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={[styles.relatedImage, { aspectRatio: RELATED_ASPECTS[posInRow] }]} resizeMode="cover" />
        ) : (
          <View style={[styles.relatedImage, { aspectRatio: RELATED_ASPECTS[posInRow] }]} />
        )}
        <Text style={styles.relatedTitle}>{item.title}</Text>
        {dateText ? <Text style={styles.relatedCategory}>{dateText}</Text> : null}
      </Pressable>
    );
  }

  // Одна похожая статья, вставленная маркером {{related:<id>}} прямо в текст
  // — компактная карточка в ширину текстовой колонки, а не строка грида-тройки.
  function renderRelatedInlineCard(item: RelatedArticle) {
    return (
      <Pressable style={styles.inlineRelatedCard} onPress={() => router.push(`/journal/${item.slug}` as any)}>
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

  // CTA "Записаться на событие" — показывается, только если событие выбрано
  // И в тексте стоит маркер {{event}}; позиция самого маркера, как правило,
  // ЯВЛЯЕТСЯ координатой — см. eventMarkerIdx/hasEventSplit ниже (и
  // комментарий у EVENT_TOKEN выше про случай "текста мало").
  // Мобильный CTA — в точности как страница самого события на мобильном
  // (events/[id].web.tsx: titleMobile → дата/цена в ряд → обложка → кнопка
  // "Зарегистрироваться" в chipButton). Десктопный — своя компактная
  // карточка: картинка, заголовок, "+ Записаться на событие" в одной
  // строке с датой; ширина ограничена картинкой (EVENT_CTA_WIDTH), чтобы
  // заголовок не был шире неё.
  function renderEventCtaCard() {
    if (!safeArticle.event) return null;
    const event = safeArticle.event;

    if (isMobile) {
      const datetimeText = formatEventDatetime(event.datetimeStart ?? undefined);
      const priceText = event.price != null ? `${event.price.toLocaleString('ru-RU')} Р` : 'Бесплатно';
      return (
        <View style={styles.ctaBlock}>
          <Pressable onPress={() => router.push(`/(tabs)/events/${event.id}` as any)}>
            <Text style={[styles.title, styles.titleMobile, styles.ctaEventTitleMobile]}>{event.title}</Text>
            <View style={styles.ctaEventMetaRow}>
              {datetimeText ? <Text style={styles.ctaEventMetaValue}>{datetimeText}</Text> : null}
              <Text style={styles.ctaEventMetaValue}>{priceText}</Text>
            </View>
            {event.coverUrl ? (
              <Image source={{ uri: event.coverUrl }} style={styles.ctaEventThumbMobile} resizeMode="cover" />
            ) : (
              <View style={styles.ctaEventThumbMobile} />
            )}
            <View style={styles.chipButton}>
              <Text style={styles.chipButtonText}>Зарегистрироваться</Text>
            </View>
          </Pressable>
        </View>
      );
    }

    const dateText = formatEventDate(event.datetimeStart ?? undefined);
    return (
      <View style={styles.ctaBlock}>
        <Pressable style={[styles.ctaCard, styles.eventCtaCardDesktop]} onPress={() => router.push(`/(tabs)/events/${event.id}` as any)}>
          {event.coverUrl ? (
            <Image source={{ uri: event.coverUrl }} style={styles.eventCtaImage} resizeMode="cover" />
          ) : (
            <View style={styles.eventCtaImage} />
          )}
          <Text style={[styles.ctaCardTitle, styles.ctaCardTitleNoLabel]}>{event.title}</Text>
          <View style={styles.eventCtaFooterRow}>
            <Text style={styles.actionLinkText}>+ Записаться на событие</Text>
            {dateText ? <Text style={styles.ctaCardMeta}>{dateText}</Text> : null}
          </View>
        </Pressable>
      </View>
    );
  }

  // Весь текст статьи как плоский упорядоченный список (абзацы intro, затем,
  // если есть "## "-подзаголовок, сам подзаголовок и абзацы после него) —
  // чтобы найти позицию маркера {{event}} В ТЕКСТЕ ЦЕЛИКОМ, а не только
  // внутри intro или только внутри section.
  type TextItem = { heading: boolean; text: string };
  const textItems: TextItem[] = [
    ...intro.map((text) => ({ heading: false, text })),
    ...sections.flatMap((s) => [{ heading: true, text: s.heading }, ...s.body.map((text) => ({ heading: false, text }))]),
  ];

  function isRealTextItem(it: TextItem) {
    const t = it.text.trim();
    return t !== '' && t !== EVENT_TOKEN && !RELATED_TOKEN_RE.test(t);
  }

  function renderTextItems(items: TextItem[], keyPrefix: string) {
    return items
      .filter((it) => { const t = it.text.trim(); return t !== EVENT_TOKEN && !RELATED_TOKEN_RE.test(t); })
      .map((it, i) => (
        <Text key={`${keyPrefix}-${i}`} style={it.heading ? styles.subheading : styles.body}>
          {parseInlineMarkdown(it.text)}
        </Text>
      ));
  }

  // CTA события — как правило, НЕ фиксированная позиция в стопке справа (как
  // баннер, который всегда просто идёт следом за галереей), а именно
  // НАПРОТИВ того абзаца, где админ поставил маркер {{event}} (см. "Вставить
  // в текст" в admin/journal-detail.tsx) — так же, как раньше работала пара
  // подзаголовок+баннер: текст до маркера и "правая колонка до этого места"
  // — одна строка грида, текст после маркера и сама карточка — следующая.
  // Исключение — "текста мало": если после маркера нет ни одного настоящего
  // абзаца (разбивать не на что — вторая строка была бы пустой слева), маркер
  // работает просто как включатель, карточка идёт в sideStack после баннера.
  const rawEventMarkerIdx = article.event ? textItems.findIndex((it) => it.text.trim() === EVENT_TOKEN) : -1;
  const hasEventMarker = rawEventMarkerIdx !== -1;
  const hasEventSplit = hasEventMarker && textItems.slice(rawEventMarkerIdx + 1).some(isRealTextItem);
  const eventMarkerIdx = hasEventSplit ? rawEventMarkerIdx : -1;
  const beforeEventItems = hasEventSplit ? textItems.slice(0, eventMarkerIdx) : textItems;
  const afterEventItems = hasEventSplit ? textItems.slice(eventMarkerIdx + 1) : [];

  // Похожие статьи, размещённые маркером {{related:<id>}} где-либо в тексте,
  // уходят в правую колонку (в порядке маркеров) и не дублируются в блоке
  // "Окей, что ещё" в конце — туда попадают только те, что админ не отметил
  // маркером явно (старое поведение). В отличие от события — без привязки к
  // конкретному абзацу, просто следом за остальным содержимым правой колонки.
  const relatedInlineIds = Array.from(new Set(
    textItems.map((it) => it.text.trim().match(RELATED_TOKEN_RE)?.[1]).filter((x): x is string => !!x)
  ));
  const relatedInlineItems = relatedInlineIds
    .map((rid) => article.relatedArticles.find((r) => r.id === rid))
    .filter((r): r is RelatedArticle => !!r);
  const relatedInlineBlock = relatedInlineItems.map((item) => <View key={item.id}>{renderRelatedInlineCard(item)}</View>);

  // "Окей, что ещё" — ближайшие события той же категории, что у привязанного
  // к статье события (см. categoryEvents выше); без привязанного события
  // блок не рендерится вовсе — "та же категория" не из чего вывести.
  const relatedBlock = categoryEvents.length > 0 ? (
    <View style={styles.relatedSection}>
      <Text style={styles.relatedSectionTitle}>Ближайшие события</Text>
      <View style={[styles.relatedRow, isMobile && styles.relatedRowMobile]}>
        {categoryEvents.map((e, i) => renderUpcomingEventCard(e, (isMobile ? 0 : i) as 0 | 1 | 2))}
      </View>
    </View>
  ) : null;

  const beforeEventBlock = renderTextItems(beforeEventItems, 'before');
  const afterEventBlock = hasEventSplit ? renderTextItems(afterEventItems, 'after') : null;

  // Баннер напротив ВТОРОГО подзаголовка (desktop only — на мобильном всё и
  // так одной колонкой), не первого: та же техника грид-сплита, что у CTA
  // события выше ("так же, как раньше работала пара подзаголовок+баннер"),
  // но держим её независимой от события — только когда маркера {{event}} в
  // статье нет вовсе, чтобы не пришлось сводить два независимых разбиения
  // на строки в одной сетке. secondHeadingIdx — позиция ВТОРОГО по счёту
  // "##"-подзаголовка в textItems (первый подзаголовок баннер не трогает);
  // "от него и дальше" уходит во вторую строку вместе с баннером, который
  // там встаёт по верхнему краю строки (там же, где начинается сам
  // подзаголовок) — без лишних стилей, просто по дефолтному выравниванию
  // грид-ячейки. Если в статье меньше двух подзаголовков — сплита нет,
  // баннер идёт своим обычным порядком в sideStack (см. bannerBlock ниже).
  const headingIndices = textItems.reduce<number[]>((acc, it, i) => { if (it.heading) acc.push(i); return acc; }, []);
  const hasSecondHeading = headingIndices.length >= 2;
  const secondHeadingIdx = hasSecondHeading ? headingIndices[1] : -1;
  const bannerOpposesHeading = !isMobile && hasSecondHeading && !hasEventMarker;
  const beforeHeadingBlock = bannerOpposesHeading ? renderTextItems(textItems.slice(0, secondHeadingIdx), 'beforeHeading') : null;
  const fromHeadingBlock = bannerOpposesHeading ? renderTextItems(textItems.slice(secondHeadingIdx), 'fromHeading') : null;

  return (
    <SiteShell>
      {headElement}
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={[styles.pageContent, isMobile && styles.pageContentMobile]}>
        {isMobile ? (
          // Мобильная раскладка — один столбец: заголовок, автор (под ним,
          // см. десктопную колонку — там тот же порядок), обложка/галерея/
          // баннер, затем текст до маркера события; если он есть и
          // текста после хватает (hasEventSplit) — сама карточка ровно на
          // его месте в тексте, затем текст после. Иначе (нет маркера или
          // "текста мало") — carточка (если маркер всё же есть) и похожие
          // статьи идут после баннера, а текст — один непрерывный поток.
          <View style={styles.mobileStack}>
            {bannerBlock}
            {titleElement}
            {authorBlock}
            <View style={styles.mobileMediaBlock}>
              {mediaBlock}
              {!hasEventSplit && hasEventMarker ? renderEventCtaCard() : null}
              {!hasEventSplit ? relatedInlineBlock : null}
            </View>
            {beforeEventBlock}
            {hasEventSplit ? renderEventCtaCard() : null}
            {afterEventBlock}
            {hasEventSplit ? relatedInlineBlock : null}
          </View>
        ) : (
          // CSS Grid — обычно одна строка: заголовок+автор+весь текст слева,
          // обложка+галерея+баннер(+CTA, если не hasEventSplit)+похожие
          // справа. Вторая строка — если hasEventSplit (текст после маркера
          // слева, карточка события справа) ИЛИ bannerOpposesHeading (текст
          // от подзаголовка слева, баннер справа, по верхнему краю строки —
          // там же, где начинается сам подзаголовок) — варианты взаимно
          // исключают друг друга (см. bannerOpposesHeading выше).
          <View style={styles.articleGrid}>
            <View>
              {titleElement}
              {authorBlock}
              {bannerOpposesHeading ? beforeHeadingBlock : beforeEventBlock}
            </View>
            <View style={styles.colImageTop}>
              {mediaBlock}
              {bannerOpposesHeading ? null : bannerBlock}
              {!hasEventSplit && hasEventMarker ? renderEventCtaCard() : null}
              {!hasEventSplit ? relatedInlineBlock : null}
            </View>
            {hasEventSplit ? (
              <>
                <View>{afterEventBlock}</View>
                <View>{renderEventCtaCard()}{relatedInlineBlock}</View>
              </>
            ) : bannerOpposesHeading ? (
              <>
                <View>{fromHeadingBlock}</View>
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
              <Image source={APP_DOWNLOAD_IMAGE} style={styles.ctaCardImage} resizeMode="cover" />
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
  pageContentMobile: { paddingHorizontal: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  errorText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#E02D2D', textAlign: 'center', marginBottom: 16 },
  retryButton: { borderWidth: 1, borderColor: '#010101', paddingVertical: 10, paddingHorizontal: 32 },
  retryButtonText: { fontSize: 14, fontFamily: 'Gramatika-Regular', color: '#010101' },

  // Обычно одна строка (весь текст слева, обложка/галерея/баннер/CTA/похожие
  // справа). Вторая строка появляется, только если есть hasEventSplit —
  // rowGap нужен именно на этот случай (без него вторая строка стартует
  // вплотную к первой).
  articleGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 32, rowGap: 40, marginBottom: 40 } as any,
  mobileStack: { marginBottom: 40 },
  // gap — отступ между элементами sideStack (обложка+галерея / баннер / CTA
  // события / карточки похожих статей), когда их несколько сразу.
  mobileMediaBlock: { marginBottom: 24, gap: 40 },
  // Раньше здесь был maxHeight: 494 — зажимал высоту колонки с обложкой и
  // галереей жёстким потолком. Когда под второй фоткой появлялась подпись,
  // суммарная высота содержимого (обложка + галерея + подпись) превышала
  // этот потолок, и flexbox сжимал саму фотографию, чтобы уместиться —
  // "подпись уменьшала высоту фотографии". Колонка должна просто занимать
  // столько места, сколько нужно её содержимому.
  // gap — см. mobileMediaBlock выше, тот же смысл.
  colImageTop: { minWidth: 240, gap: 0 },
  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 40, marginTop: 0},
  titleMobile: { fontSize: 25, lineHeight: 28 },
  subheading: { fontSize: 30, lineHeight: 30, fontFamily: 'Gramatika-Regular', fontWeight: '400', color: '#010101', marginBottom: 16 },
  // Только имя под заголовком, серым — раньше тут был целый блок (фото +
  // имя + роль + био), убрали всё, кроме имени (см. git history). Размер —
  // как у прежнего authorBio (14/18), а не у прежнего имени (18).
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 },
  // minWidth:0 — см. тот же приём в events/[id].web.tsx/explore/[id].web.tsx:
  // при нехватке места сжимается имя автора, а не теги (TagList сам
  // flexShrink:0 — никогда не обрезается троеточием).
  authorNameShrink: { flexShrink: 1, minWidth: 0 },
  author: { fontSize: 14, lineHeight: 18, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#687076' },
  body: { fontSize: 18, lineHeight: 26, fontFamily: 'Gramatika-Regular', color: '#010101', marginBottom: 24 },
  coverImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#E5E5E5' },
  // alignItems: 'flex-start' обязателен — без него flexbox по умолчанию
  // растягивает (stretch) оба элемента ряда до высоты самого высокого: когда
  // под правой фоткой есть подпись, её обёртка становится "выше" левой
  // фотографии по натуральному контенту, и левая фотография насильно
  // растягивается (теряя квадратную aspectRatio), либо наоборот сжимается —
  // в любом случае перестаёт быть квадратной. С flex-start каждая картинка
  // остаётся своего естественного (aspectRatio) размера независимо от подписи.
  galleryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginTop: 16, marginBottom: 16 },
  galleryImage: { flex: 1, aspectRatio: 1, backgroundColor: '#E5E5E5', maxWidth: '50%' },
  // Правая фотография — с подписью под ней, поэтому своя обёртка вместо
  // flex/maxWidth прямо на Image (как у galleryImage/левой фотографии).
  galleryImageWithCaption: { flex: 1, maxWidth: '50%' },
  galleryImageInner: { width: '100%', aspectRatio: 1, backgroundColor: '#E5E5E5' },
  galleryCaption: { fontSize: 13, lineHeight: 17, fontFamily: 'Gramatika-Regular', color: '#687076', marginTop: 8, textAlign: 'right' },
  // Квадрат шириной 50% родителя, по центру — paddingBottom тем же
  // процентом, что и width, даёт height = width (тот же приём, что у
  // avatarBox на /explore: AVATAR_RATIO*100% при width:'100%' там, здесь
  // 50%/50% — паддинг-проценты всегда считаются от ширины родителя, то есть
  // при собственной width:50% это и есть квадрат).
  sectionBannerWrap: { width: '50%', alignSelf: 'center', position: 'relative', overflow: 'hidden', paddingBottom: '50%' } as any,
  // Мобильный вариант — по ширине как обложка (100%, не центрированный
  // 50%-квадрат), см. комментарий у bannerBlock.
  sectionBannerWrapMobile: { width: '100%', alignSelf: 'stretch', paddingBottom: '100%', marginBottom: 24 } as any,
  sectionBanner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', backgroundColor: '#E5E5E5' },

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

  // marginTop убран (была лишняя "двойная" вставка между текстом и CTA —
  // React Native не схлопывает соседние margin, как в обычном CSS, поэтому
  // marginBottom:24 предыдущего абзаца (styles.body) и marginTop:8 этого
  // блока складывались, а не схлопывались в больший из двух).
  // width:'100%' + alignItems:'center' (не alignSelf на самой карточке —
  // проверено рендером: карточка с maxWidth и без явного width не сжимается
  // по контенту сама по себе, остаётся прижатой к левому краю) — сам блок на
  // всю ширину родителя, а узкую (maxWidth) карточку внутри центрирует как
  // обычный flex-контейнер.
  ctaBlock: { marginBottom: 40, width: '100%', alignItems: 'center' },
  actionLinkText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 15, color: '#E02D2D', paddingVertical: 8, marginBottom: 0 },
  // Те же токены, что и у карточек на /journal (cardCategory/cardTitleText +
  // featuredLabelOne/featuredTitleOne) — картинка на всю ширину блока, под
  // ней подпись и заголовок, а не мелкая горизонтальная мини-карточка.
  // maxWidth — тот, что раньше был на ctaBlock (сам блок теперь на всю
  // ширину ради центрирования, см. выше), width:'100%' — чтобы на узких
  // экранах карточка занимала всю доступную ширину, а не только maxWidth.
  ctaCard: { width: '100%', maxWidth: 420 },
  // CTA события на десктопе — заголовок не должен быть шире картинки
  // (EVENT_CTA_WIDTH её фиксирует), иначе текст растягивается до maxWidth
  // ctaBlock (420), шире самой картинки под ним.
  eventCtaCardDesktop: { maxWidth: EVENT_CTA_WIDTH },
  ctaCardImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#E5E5E5' },
  // Размер как у карточки события в статье про советский самиздат — см.
  // расчёт EVENT_CTA_WIDTH/HEIGHT выше.
  eventCtaImage: { width: EVENT_CTA_WIDTH, height: EVENT_CTA_HEIGHT, backgroundColor: '#E5E5E5' },
  ctaCardTitle: { fontSize: 30, lineHeight: 27, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginTop: 13 },
  // У блока "Скачать приложение" нет строки-подписи над заголовком — сдвигаем
  // заголовок так же, как если бы подпись была (20 её marginTop + 13 обычный).
  ctaCardTitleNoLabel: { marginTop: 33 },
  // "+ Записаться на событие" слева, дата справа — одна строка под
  // заголовком (было: ссылка отдельной строкой над картинкой, дата отдельной
  // строкой под заголовком).
  eventCtaFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  ctaCardMeta: { fontSize: 15, fontFamily: 'Gramatika-Regular', color: '#000' },
  // Мобильный CTA события — в точности как сама страница события на
  // мобильном (events/[id].web.tsx: titleMobile, mobileMetaRow/Value,
  // mobileThumb, chipButton/chipButtonText) — значения скопированы оттуда.
  ctaEventTitleMobile: { marginBottom: 8 },
  ctaEventMetaRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  ctaEventMetaValue: { fontSize: 12, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101' },
  ctaEventThumbMobile: { width: '100%', aspectRatio: 649 / 360, backgroundColor: '#E5E5E5', marginBottom: 16 },
  chipButton: { backgroundColor: '#F0F5FB', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  chipButtonText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 18, color: '#68717A' },
  appCardStores: { flexDirection: 'row', gap: 16, marginTop: 16 },
  storeLinkText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 13, color: '#E02D2D' },
});
