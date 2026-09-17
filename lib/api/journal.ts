/**
 * API-клиент для журнала (статьи). Бэкенд: GET/POST/PATCH/DELETE /api/articles
 * (создание/изменение/удаление — только через админку, см. /admin/journal).
 *
 * Поле category хранит формат материала — "Подкаст" | "Текст" | "Интервью"
 * (фильтры "Подкасты"/"Тексты"/"Интервью" в /journal); это переиспользованное
 * поле, отдельного поля "формат" на бэкенде нет.
 */

import { API_BASE, endpoints } from '@/constants/env';

export const ARTICLE_FORMATS = ['Подкаст', 'Текст', 'Интервью'] as const;
export type ArticleFormat = (typeof ARTICLE_FORMATS)[number];

export interface ArticleAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  roleTitle: string | null;
}

export interface Article {
  id: string;
  title: string;
  content: string | null;
  category: string | null;
  coverUrl: string | null;
  gallery: string[];
  author: ArticleAuthor;
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
    author: {
      id: String(author.id ?? ''),
      name: String(author.name ?? ''),
      avatarUrl: resolveUrl(author.avatar_url as string | undefined),
      roleTitle: (author.role_title as string) ?? null,
    },
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
