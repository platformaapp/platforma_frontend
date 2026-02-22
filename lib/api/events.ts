/**
 * API-клиент для /api/events
 *
 * POST /api/events — создание
 * PATCH /api/events/{id} — изменение (только до начала)
 * GET /api/events/{id} — просмотр
 * POST /api/events/{id}/register — запись на событие
 * DELETE /api/events/{id} — удаление
 */

import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';

// --- Типы ---

export interface EventCreateBody {
  title: string;
  description: string;
  datetime_start: string; // ISO 8601: "2025-06-15T20:00:00Z"
  datetime_end: string;   // ISO 8601: "2025-06-15T21:00:00Z"
  price: number;
  max_participants?: number; // ≥1, по умолчанию 30
}

export interface EventResponse {
  id: string;
  title: string;
  description?: string;
  datetime_start: string;
  datetime_end?: string;
  price: number;
  platform_fee?: number;
  mentor_revenue?: number;
  max_participants: number;
  updated_at?: string;
}

export interface EventDetailResponse {
  id: string;
  title: string;
  mentor: { id: string; name: string };
  datetime_start: string;
  countdown?: string;
  max_participants: number;
  registered_count: number;
  video_room?: { url: string | null };
  status: string;
}

export interface EventPatchBody {
  title?: string;
  description?: string;
  datetime_start?: string;
  price?: number;
  max_participants?: number;
}

// --- Хелперы ---

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Требуется авторизация');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = typeof payload === 'string' ? payload : payload?.error ?? payload?.message ?? 'Ошибка запроса';
    throw new Error(msg);
  }

  return payload as T;
}

// --- API ---

/** POST /api/events — создать событие */
export async function createEvent(body: EventCreateBody): Promise<EventResponse> {
  const payload = {
    ...body,
    max_participants: body.max_participants ?? 30,
  };
  const res = await fetch(endpoints.events, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<EventResponse>(res);
}

/** PATCH /api/events/{id} — изменить событие (только до начала) */
export async function updateEvent(id: string, body: EventPatchBody): Promise<EventResponse> {
  const res = await fetch(`${endpoints.events}/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<EventResponse>(res);
}

/** GET /api/events/{id} — просмотр события */
export async function getEvent(id: string): Promise<EventDetailResponse> {
  const res = await fetch(`${endpoints.events}/${id}`, {
    headers: await authHeaders(),
  });
  return handleResponse<EventDetailResponse>(res);
}

/** POST /api/events/{id}/register — запись на событие */
export async function registerForEvent(id: string): Promise<void> {
  const res = await fetch(`${endpoints.events}/${id}/register`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  await handleResponse(res);
}

/** DELETE /api/events/{id} — удалить событие */
export async function deleteEvent(id: string): Promise<void> {
  const res = await fetch(`${endpoints.events}/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  await handleResponse(res);
}
