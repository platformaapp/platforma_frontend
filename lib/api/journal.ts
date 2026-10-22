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
  // Бэкенд не отдаёт короткое био в объекте author статьи — заполняется на
  // странице статьи через кросс-референс со списком наставников (см. lib/api/tutor.ts).
  shortBio?: string;
}

export interface RelatedArticle {
  id: string;
  title: string;
  category: string | null;
  coverUrl: string | null;
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
    },
    relatedArticles: Array.isArray(raw.related_articles)
      ? (raw.related_articles as Record<string, unknown>[]).map((r) => ({
          id: String(r.id ?? ''),
          title: String(r.title ?? ''),
          category: (r.category as string) ?? null,
          coverUrl: resolveUrl(r.cover_url as string | undefined),
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
    createdAt: String(raw.created_at ?? ''),
    updatedAt: String(raw.updated_at ?? ''),
  };
}

export async function getArticles(params?: { page?: number; perPage?: number; category?: string }): Promise<ArticlesPage> {
  const search = new URLSearchParams();
  search.set('page', String(params?.page ?? 1));
  search.set('per_page', String(params?.perPage ?? 20));
  if (params?.category) search.set('category', params.category);

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

export async function getArticle(id: string): Promise<Article> {
  const res = await fetch(`${endpoints.articles}/${id}`);
  if (!res.ok) throw new Error(`Не удалось загрузить материал (${res.status})`);
  const data = await res.json();
  return normalizeArticle(data);
}
