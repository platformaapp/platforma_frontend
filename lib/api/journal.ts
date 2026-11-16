/**
 * API-клиент для журнала (статьи). Бэкенд: GET/POST/PATCH/DELETE /api/articles
 * (создание/изменение/удаление — только через админку, см. /admin/journal).
 *
 * Поле category хранит формат материала — глагол-действие, а не
 * существительное ("Обсудить"/"Посмотреть"/"Посетить"), значения совпадают
 * с фильтр-пилюлями в /journal один в один, отдельного поля "формат" на
 * бэкенде нет. Правый CTA "Написать текст" на /journal — не формат статьи,
 * не входит в этот список (открывает регистрацию, не фильтрует).
 */

import { API_BASE, endpoints } from '@/constants/env';

export const ARTICLE_FORMATS = ['Обсудить', 'Посмотреть', 'Посетить'] as const;
export type ArticleFormat = (typeof ARTICLE_FORMATS)[number];

export interface ArticleAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  roleTitle: string | null;
  // Короткое био автора — сигнал E-E-A-T, бэкенд отдаёт его напрямую в
  // объекте author статьи (см. ArticleAuthorDto.short_bio на бэкенде).
  shortBio: string | null;
}

export interface RelatedArticle {
  id: string;
  title: string;
  category: string | null;
  coverUrl: string | null;
  slug: string;
}

export interface ArticleEvent {
  id: string;
  title: string;
  coverUrl: string | null;
  datetimeStart: string | null;
  price: number;
  // Категория привязанного события (enum EventCategory бэкенда — см.
  // CATEGORY_LABELS в events/index.web.tsx) — для блока "Окей, что ещё" на
  // странице статьи: ближайшие события той же категории.
  category: string | null;
}

export interface Article {
  id: string;
  title: string;
  content: string | null;
  category: string | null;
  coverUrl: string | null;
  gallery: string[];
  // Подпись под второй (правой) фотографией галереи — gallery[1].
  galleryCaption: string | null;
  author: ArticleAuthor;
  // "Окей, что ещё" в конце статьи — до 3 статей, выбранных в админке
  // (см. admin/journal-detail.tsx). Только на findOne (списки отдают []).
  relatedArticles: RelatedArticle[];
  // Событие, явно привязанное к статье в админке (CTA "Записаться на
  // событие") — null, если не выбрано.
  event: ArticleEvent | null;
  // Баннер рядом со вторым подзаголовком — опционально, настраивается в
  // админке (см. admin/journal-detail.tsx).
  showBanner: boolean;
  // Хэштеги (без "#") — показываются напротив имени автора на странице
  // статьи, задаются в админке.
  tags: string[];
  // SEO-поля (см. admin/journal-detail.tsx, секция "SEO") — все опциональные,
  // страница статьи использует фолбэк на title/content, если не заданы.
  // seoTitle → <title>, metaDescription → <meta name="description">,
  // h1 → видимый заголовок на странице статьи вместо title.
  seoTitle: string | null;
  h1: string | null;
  metaDescription: string | null;
  // Человекочитаемый URL — ЕДИНСТВЕННЫЙ публичный путь к статье
  // (/journal/<slug>), см. комментарий у getArticle ниже. Никогда не
  // пустой (бэкенд гарантирует NOT NULL + UNIQUE).
  slug: string;
  // <link rel="canonical"> — если задан, используется вместо собственного
  // URL статьи (см. комментарий у Article.canonicalUrl на бэкенде).
  canonicalUrl: string | null;
  // noindex/nofollow → <meta name="robots">; статья остаётся на сайте как
  // обычно, просто закрыта от индексации конкретным поисковиком.
  noindex: boolean;
  nofollow: boolean;
  // Дата публикации — для schema.org datePublished и сигнала свежести
  // контента; отдельно от createdAt/updatedAt (см. бэкенд).
  publishedAt: string;
  // Краткое описание для карточек в ленте/журнале — ОТДЕЛЬНО от
  // metaDescription (тот — сниппет в выдаче поиска), см. комментарий у
  // Article.excerpt на бэкенде.
  excerpt: string | null;
  // og:title/og:description — превью при шаринге, опционально
  // переопределяют seoTitle/metaDescription (фолбэк на них же, если не заданы).
  ogTitle: string | null;
  ogDescription: string | null;
  // Alt-текст обложки и галереи (coverAlt ↔ coverUrl, galleryAlt[i] ↔ gallery[i]).
  coverAlt: string | null;
  galleryAlt: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ArticlesPage {
  items: Article[];
  page: number;
  perPage: number;
  total: number;
}

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

function normalizeArticle(raw: Record<string, unknown>): Article {
  const author = (raw.author ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    content: (raw.content as string) ?? null,
    category: (raw.category as string) ?? null,
    coverUrl: resolveUrl(raw.cover_url as string | undefined),
    gallery: Array.isArray(raw.gallery) ? (raw.gallery as string[]).map((g) => resolveUrl(g) ?? g) : [],
    galleryCaption: (raw.gallery_caption as string) ?? null,
    author: {
      id: String(author.id ?? ''),
      name: String(author.name ?? ''),
      avatarUrl: resolveUrl(author.avatar_url as string | undefined),
      roleTitle: (author.role_title as string) ?? null,
      shortBio: (author.short_bio as string) ?? null,
    },
    relatedArticles: Array.isArray(raw.related_articles)
      ? (raw.related_articles as Record<string, unknown>[]).map((r) => ({
          id: String(r.id ?? ''),
          title: String(r.title ?? ''),
          category: (r.category as string) ?? null,
          coverUrl: resolveUrl(r.cover_url as string | undefined),
          slug: String(r.slug ?? ''),
        }))
      : [],
    event: raw.event && typeof raw.event === 'object'
      ? (() => {
          const e = raw.event as Record<string, unknown>;
          return {
            id: String(e.id ?? ''),
            title: String(e.title ?? ''),
            coverUrl: resolveUrl(e.cover_url as string | undefined),
            datetimeStart: (e.datetime_start as string) ?? null,
            price: typeof e.price === 'number' ? e.price : Number(e.price ?? 0),
            category: (e.category as string) ?? null,
          };
        })()
      : null,
    showBanner: raw.show_banner !== false,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    seoTitle: (raw.seo_title as string) ?? null,
    h1: (raw.h1 as string) ?? null,
    metaDescription: (raw.meta_description as string) ?? null,
    slug: String(raw.slug ?? ''),
    canonicalUrl: (raw.canonical_url as string) ?? null,
    noindex: raw.noindex === true,
    nofollow: raw.nofollow === true,
    publishedAt: String(raw.published_at ?? raw.created_at ?? ''),
    excerpt: (raw.excerpt as string) ?? null,
    ogTitle: (raw.og_title as string) ?? null,
    ogDescription: (raw.og_description as string) ?? null,
    coverAlt: (raw.cover_alt as string) ?? null,
    galleryAlt: Array.isArray(raw.gallery_alt) ? (raw.gallery_alt as string[]) : [],
    createdAt: String(raw.created_at ?? ''),
    updatedAt: String(raw.updated_at ?? ''),
  };
}

export async function getArticles(params?: { page?: number; perPage?: number; category?: string; authorId?: string }): Promise<ArticlesPage> {
  const search = new URLSearchParams();
  search.set('page', String(params?.page ?? 1));
  search.set('per_page', String(params?.perPage ?? 20));
  if (params?.category) search.set('category', params.category);
  if (params?.authorId) search.set('author_id', params.authorId);

  const res = await fetch(`${endpoints.articles}?${search.toString()}`);
  if (!res.ok) throw new Error(`Не удалось загрузить журнал (${res.status})`);
  const data = await res.json();
  const rawItems = Array.isArray(data?.data) ? data.data : [];
  return {
    items: rawItems.map(normalizeArticle),
    page: data?.pagination?.page ?? 1,
    perPage: data?.pagination?.per_page ?? rawItems.length,
    total: data?.pagination?.total ?? rawItems.length,
  };
}

// Единственный публичный путь к статье — /api/articles/<slug> (slug —
// человекочитаемый URL, см. комментарий у Article.slug выше). Бэкенд
// резолвит ЭТОТ маршрут по slug, не по id — GET по старому uuid отвечает
// 404 (осознанное решение, не временная мера, см. ArticlesController на
// бэкенде).
export async function getArticle(slug: string): Promise<Article> {
  const res = await fetch(`${endpoints.articles}/${slug}`);
  if (!res.ok) throw new Error(`Не удалось загрузить материал (${res.status})`);
  const data = await res.json();
  return normalizeArticle(data);
}
