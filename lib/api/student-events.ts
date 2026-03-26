/**
 * GET /api/events/my — мероприятия и session_based, на которые записан студент.
 * Обязательно: role=student
 */

import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';

export type MyEventsFilter = 'all' | 'events' | 'personal';
export type MyEventsTime = 'all' | 'upcoming' | 'past';

export interface MyEventsQuery {
  role?: 'student';
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
  const start = (raw.start_at ?? raw.startAt) as string | undefined;
  return {
    id: String(raw.id ?? ''),
    title: (raw.title as string) ?? '',
    type: raw.type as string | undefined,
    teacher: raw.teacher,
    student: raw.student,
    start_at: start,
    startAt: start,
    price: typeof raw.price === 'number' ? raw.price : undefined,
    time_left: (raw.time_left ?? raw.timeLeft) as string | undefined,
    status: raw.status as string | undefined,
    coverUrl: (raw.coverUrl ?? raw.cover_url) as string | null | undefined,
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
  const rawItems = root.data ?? root.items ?? [];
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
