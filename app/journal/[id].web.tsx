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

// Картинка в блоке "Скачать приложение" (мобильный, низ статьи) — раньше
// был просто серый плейсхолдер без картинки, взята с vladyakunin.ru (та же
// чб-портретная эстетика, что и у section-banner выше).
const APP_DOWNLOAD_IMAGE = require('@/assets/images/app-download-photo.png');
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

  // "Мало текста" — считаем по суммарной длине настоящих абзацев (маркеры
  // {{event}}/{{related:<id>}} не в счёт), не по их количеству: один длинный
  // абзац — это не "мало текста", а несколько однословных — да. Влияет
  // только на форму баннера ниже (bannerBlock) — квадратом вместо длинной
  // портретной картинки, когда текста при ней было бы слишком мало.
  const LITTLE_TEXT_THRESHOLD = 600;
  const totalTextLength = [...intro, ...(section?.body ?? [])]
    .filter((p) => { const t = p.trim(); return t !== '' && t !== EVENT_TOKEN && !RELATED_TOKEN_RE.test(t); })
    .reduce((sum, p) => sum + p.length, 0);
  const hasLittleText = totalTextLength < LITTLE_TEXT_THRESHOLD;

  const titleElement = <Text style={[styles.title, isMobile && styles.titleMobile]}>{article.title}</Text>;

  // Под заголовком — только имя, серым, без фото и без роли/био (раньше
  // был целый блок с фото+имя+роль+био, см. git history), кликабельно на
  // страницу наставника, если он известен.
  const authorBlock = article.author.name ? (
    <View style={styles.authorRow}>
      {article.author.id ? (
        <Pressable onPress={() => router.push(`/(tabs)/explore/${article.author.id}` as any)}>
          <Text style={styles.author}>{article.author.name}</Text>
        </Pressable>
      ) : (
        <Text style={styles.author}>{article.author.name}</Text>
      )}
    </View>
  ) : null;

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

  // Баннер — опционально, выключается в админке (article.showBanner), по
  // умолчанию показан. Фиксированный элемент правой колонки — идёт сразу
  // под обложкой/галереей, независимо от текста и позиции маркера события
  // (см. комментарий у EVENT_TOKEN выше — баннер не позиционируется, в
  // отличие от CTA события). Это свой, конкретный баннер (не PromoBanner
  // с /journal и /events).
  // Небольшой, фиксированной ширины (как сайдбар-баннер рядом с текстом на
  // theblueprint.ru), а не во всю колонку — alignSelf: 'flex-start' не даёт
  // ему растянуться на всю ширину грид-ячейки.
  // Когда текста в статье мало (hasLittleText) — длинная портретная картинка
  // смотрится несоразмерно рядом с коротким текстом, поэтому показываем её
  // квадратом: сама картинка не меняется (не искажается, та же ширина и
  // натуральная пропорциональная высота), просто обёртка обрезает её по
  // квадрату через overflow:'hidden', оставляя видимой верхнюю часть — ровно
  // ту, где текст ("Собираем личные рекомендации...").
  const bannerBlock = article.showBanner ? (
    <Pressable style={[styles.sectionBannerWrap, hasLittleText && styles.sectionBannerWrapSquare]} onPress={() => Linking.openURL(SECTION_BANNER_TELEGRAM_URL)}>
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

  // CTA "Записаться на событие" — показывается, только если событие выбрано
  // И в тексте стоит маркер {{event}}; позиция самого маркера, как правило,
  // ЯВЛЯЕТСЯ координатой — см. eventMarkerIdx/hasEventSplit ниже (и
  // комментарий у EVENT_TOKEN выше про случай "текста мало").
  // "+ Записаться на событие" — под заголовком, в одной строке с датой (на
  // противоположных концах), а не отдельной строкой-ссылкой над картинкой,
  // как раньше. Заголовок (ctaCardTitle) не должен быть шире картинки — на
  // десктопе у картинки фиксированная ширина (EVENT_CTA_WIDTH), поэтому
  // ограничиваем ею весь блок (eventCtaCardDesktop); на мобильном картинка
  // и так на всю ширину блока (ctaCardImage), ограничивать нечем.
  function renderEventCtaCard() {
    if (!safeArticle.event) return null;
    const event = safeArticle.event;
    const dateText = formatEventDate(event.datetimeStart ?? undefined);
    return (
      <View style={styles.ctaBlock}>
        <Pressable style={[styles.ctaCard, !isMobile && styles.eventCtaCardDesktop]} onPress={() => router.push(`/(tabs)/events/${event.id}` as any)}>
          {event.coverUrl ? (
            <Image source={{ uri: event.coverUrl }} style={isMobile ? styles.ctaCardImage : styles.eventCtaImage} resizeMode="cover" />
          ) : (
            <View style={isMobile ? styles.ctaCardImage : styles.eventCtaImage} />
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
    ...(section ? [{ heading: true, text: section.heading }, ...section.body.map((text) => ({ heading: false, text }))] : []),
  ];

  function isRealTextItem(it: TextItem) {
    const t = it.text.trim();
    return t !== '' && t !== EVENT_TOKEN && !RELATED_TOKEN_RE.test(t);
  }

  function renderTextItems(items: TextItem[], keyPrefix: string) {
    return items
      .filter((it) => { const t = it.text.trim(); return t !== EVENT_TOKEN && !RELATED_TOKEN_RE.test(t); })
      .map((it, i) => (
        <Text key={`${keyPrefix}-${i}`} style={it.heading ? [styles.subheading, isMobile && styles.subheadingMobile] : styles.body}>
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
  const relatedArticlesForEnd = article.relatedArticles.filter((r) => !relatedInlineIds.includes(r.id));
  const relatedInlineBlock = relatedInlineItems.map((item) => <View key={item.id}>{renderRelatedInlineCard(item)}</View>);

  const relatedBlock = relatedArticlesForEnd.length > 0 ? (
    <View style={styles.relatedSection}>
      <Text style={styles.relatedSectionTitle}>Окей, что ещё</Text>
      <View style={[styles.relatedRow, isMobile && styles.relatedRowMobile]}>
        {relatedArticlesForEnd.map((a, i) => renderRelatedCard(a, (isMobile ? 0 : i) as 0 | 1 | 2))}
      </View>
    </View>
  ) : null;

  const beforeEventBlock = renderTextItems(beforeEventItems, 'before');
  const afterEventBlock = hasEventSplit ? renderTextItems(afterEventItems, 'after') : null;

  return (
    <SiteShell>
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
            {titleElement}
            {authorBlock}
            <View style={styles.mobileMediaBlock}>
              {mediaBlock}
              {bannerBlock}
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
          // справа. Если hasEventSplit — вторая строка: текст после маркера
          // слева, сама карточка справа, на одном уровне (та же техника, что
          // у пары подзаголовок+баннер) — похожие статьи переезжают в неё же.
          <View style={styles.articleGrid}>
            <View>
              {titleElement}
              {authorBlock}
              {beforeEventBlock}
            </View>
            <View style={styles.colImageTop}>
              {mediaBlock}
              {bannerBlock}
              {!hasEventSplit && hasEventMarker ? renderEventCtaCard() : null}
              {!hasEventSplit ? relatedInlineBlock : null}
            </View>
            {hasEventSplit ? (
              <>
                <View>{afterEventBlock}</View>
                <View>{renderEventCtaCard()}{relatedInlineBlock}</View>
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
  colImageTop: { minWidth: 240, gap: 40 },
  title: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 40, marginTop: 0},
  titleMobile: { fontSize: 25, lineHeight: 28 },
  // Тот же размер, что у заголовка статьи (title/titleMobile) — тем же
  // способом (общий стиль + мобильный оверрайд), раньше на мобильном
  // подзаголовок оставался в десктопном размере (40/36), крупнее заголовка
  // (25/28).
  subheading: { fontSize: 40, lineHeight: 36, fontFamily: 'Gramatika-Regular', fontWeight: 'normal', color: '#010101', marginBottom: 16 },
  subheadingMobile: { fontSize: 25, lineHeight: 28 },
  // Только имя под заголовком, серым — раньше тут был целый блок (фото +
  // имя + роль + био), убрали всё, кроме имени (см. git history). Размер —
  // как у прежнего authorBio (14/18), а не у прежнего имени (18).
  authorRow: { marginBottom: 24 },
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
  galleryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginTop: 16 },
  galleryImage: { flex: 1, aspectRatio: 1, backgroundColor: '#E5E5E5', maxWidth: '50%' },
  // Правая фотография — с подписью под ней, поэтому своя обёртка вместо
  // flex/maxWidth прямо на Image (как у galleryImage/левой фотографии).
  galleryImageWithCaption: { flex: 1, maxWidth: '50%' },
  galleryImageInner: { width: '100%', aspectRatio: 1, backgroundColor: '#E5E5E5' },
  galleryCaption: { fontSize: 13, lineHeight: 17, fontFamily: 'Gramatika-Regular', color: '#687076', marginTop: 8, textAlign: 'right' },
  sectionBannerWrap: { width: SECTION_BANNER_WIDTH, alignSelf: 'flex-start' },
  // "Мало текста" — квадратная обёртка обрезает картинку снизу (overflow),
  // сама картинка (sectionBanner) не меняется — остаётся во всю свою
  // натуральную пропорциональную высоту, просто видна только верхняя
  // квадратная часть (см. комментарий у bannerBlock выше).
  sectionBannerWrapSquare: { height: SECTION_BANNER_WIDTH, overflow: 'hidden' },
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
  actionLinkText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 15, color: '#E02D2D', paddingVertical: 8, marginBottom: 0 },
  // Те же токены, что и у карточек на /journal (cardCategory/cardTitleText +
  // featuredLabelOne/featuredTitleOne) — картинка на всю ширину блока, под
  // ней подпись и заголовок, а не мелкая горизонтальная мини-карточка.
  ctaCard: {},
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
  appCardStores: { flexDirection: 'row', gap: 16, marginTop: 16 },
  storeLinkText: { fontFamily: 'Gramatika-Regular', fontWeight: 'normal', fontSize: 13, color: '#E02D2D' },
});
