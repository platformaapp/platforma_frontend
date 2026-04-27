/**
 * GET /api/events/my — мероприятия и session_based, на которые записан студент.
 * Обязательно: role=student
 */

import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';
import { API_BASE } from '@/constants/env';

function resolveUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('blob:')) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

export type MyEventsFilter = 'all' | 'events' | 'personal';
export type MyEventsTime = 'all' | 'upcoming' | 'past';

export interface MyEventsQuery {
  role?: 'student' | 'tutor';
  filter?: MyEventsFilter;
  time?: MyEventsTime;
  page?: number;
  per_page?: number;
}

/** Элемент из GET /events/my (гибкий разбор полей бэкенда) */
export interface MyEventItem {
  id: string;
  title: string;
  type?: string;
  teacher?: unknown;
  student?: unknown;
  start_at?: string;
  startAt?: string;
  price?: number;
  time_left?: string;
  timeLeft?: string;
  status?: string;
  coverUrl?: string | null;
  cover_url?: string | null;
}

export interface MyEventsPagination {
  page: number;
  per_page: number;
  total: number;
}

export function teacherName(teacher: unknown): string {
  if (!teacher) return '';
  if (typeof teacher === 'string') return teacher;
  if (typeof teacher === 'object' && teacher !== null) {
    const t = teacher as Record<string, unknown>;
    return (
      (t.name as string) ??
      (t.fullName as string) ??
      (t.full_name as string) ??
      ''
    );
  }
  return '';
}

export function normalizeMyEventItem(raw: Record<string, unknown>): MyEventItem {
  // Items from /api/events/my may have event data either flat or nested inside `event`
  const nested = (raw.event ?? raw.eventData) as Record<string, unknown> | undefined;
  // Merge: nested fields are the base, top-level fields override
  const r: Record<string, unknown> = nested ? { ...nested, ...raw } : raw;

  const start = (r.start_at ?? r.startAt ?? r.datetimeStart ?? r.datetime_start) as string | undefined;
  return {
    id: String(r.id ?? raw.event_id ?? nested?.id ?? ''),
    title: (r.title as string) ?? (nested?.title as string) ?? '',
    type: r.type as string | undefined,
    teacher: r.teacher ?? r.mentor ?? r.tutor ?? nested?.teacher ?? nested?.mentor,
    student: r.student,
    start_at: start,
    startAt: start,
    price: typeof r.price === 'number' ? r.price : undefined,
    time_left: (r.time_left ?? r.timeLeft) as string | undefined,
    status: r.status as string | undefined,
    coverUrl: resolveUrl(
      r.coverUrl ?? r.cover_url ?? r.imageUrl ?? r.image_url ??
      r.cover ?? r.thumbnail ?? r.photo ?? r.photoUrl ?? r.photo_url ??
      nested?.coverUrl ?? nested?.cover_url ?? nested?.imageUrl ?? nested?.image_url
    ),
  };
}

export async function getMyEventsForStudent(
  query: Partial<MyEventsQuery> = {}
): Promise<{ items: MyEventItem[]; pagination: MyEventsPagination }> {
  const token = await getAuthToken();
  if (!token) throw new Error('Требуется авторизация');

  const params = new URLSearchParams();
  params.set('role', query.role ?? 'student');
  if (query.filter) params.set('filter', query.filter);
  if (query.time) params.set('time', query.time);
  params.set('page', String(query.page ?? 1));
  params.set('per_page', String(query.per_page ?? 50));

  const url = `${endpoints.eventsMy}?${params.toString()}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const msg =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string })?.message ??
          (payload as { error?: string })?.error ??
          `Ошибка загрузки (${res.status})`;
    throw new Error(msg);
  }

  const root = payload as Record<string, unknown>;
  // Handle: array | { items } | { data: [] } | { data: { items: [] } }
  let rawItems: unknown = root.data ?? root.items ?? [];
  if (!Array.isArray(rawItems) && rawItems && typeof rawItems === 'object') {
    const inner = rawItems as Record<string, unknown>;
    rawItems = inner.items ?? inner.data ?? [];
  }
  const list = Array.isArray(rawItems) ? rawItems : [];
  const items = list.map((row) =>
    normalizeMyEventItem(typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : {})
  );

  const pag = (root.pagination ?? root.meta) as Record<string, unknown> | undefined;
  const pagination: MyEventsPagination = {
    page: typeof pag?.page === 'number' ? pag.page : query.page ?? 1,
    per_page: typeof pag?.per_page === 'number' ? pag.per_page : query.per_page ?? 50,
    total: typeof pag?.total === 'number' ? pag.total : items.length,
  };

  return { items, pagination };
}
