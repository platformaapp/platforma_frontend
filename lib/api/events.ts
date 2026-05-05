/**
 * API-клиент для /api/events
 *
 * POST /api/events — создание
 * PATCH /api/events/{id} — изменение (только до начала)
 * GET /api/events/{id} — просмотр
 * POST /api/events/{id}/register — запись на событие
 * DELETE /api/events/{id} — удаление
 */

import { Platform } from 'react-native';

import { API_BASE, endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';
import { AuthError, handle401 } from '@/lib/api/auth-error';
export { AuthError };

// --- Типы ---

export interface EventCreateBody {
  title: string;
  description: string;
  datetime_start: string; // ISO 8601: "2025-03-01T10:00:00.000Z"
  datetime_end: string;   // ISO 8601: "2025-03-01T11:00:00.000Z"
  price: number;
  max_participants?: number; // ≥1, по умолчанию 30
  type?: 'standalone';
  coverUrl?: string;
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
  coverUrl?: string;
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
    if (res.status === 401) await handle401(res, payload);
    const msg = typeof payload === 'string' ? payload : payload?.error ?? payload?.message ?? 'Ошибка запроса';
    if (res.status === 504) throw new Error('Сервер не отвечает. Попробуйте позже.');
    throw new Error(msg);
  }

  return payload as T;
}

// --- API ---

/**
 * POST /api/uploads/image — загрузить обложку события.
 * Возвращает абсолютный URL загруженного файла.
 */
export async function uploadEventImage(uri: string): Promise<string> {
  const token = await getAuthToken();
  if (!token) throw new Error('Требуется авторизация');

  const formData = new FormData();
  const filename = `cover_${Date.now()}.jpg`;

  if (Platform.OS === 'web') {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    formData.append('file', blob, filename);
  } else {
    formData.append('file', { uri, name: filename, type: 'image/jpeg' } as any);
  }

  const res = await fetch(endpoints.uploadImage, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    if (res.status === 413) throw new Error('Файл слишком большой. Выберите фото меньшего размера.');
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message ?? `Ошибка загрузки обложки (${res.status})`);
  }

  const data = await res.json();
  if (!data?.url) throw new Error('Сервер не вернул URL изображения');
  const url = data.url as string;
  return url.startsWith('http') ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** POST /api/events — создать событие */
export async function createEvent(body: EventCreateBody): Promise<EventResponse> {
  const payload = {
    ...body,
    max_participants: body.max_participants ?? 30,
    type: body.type ?? 'standalone',
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
