/**
 * API-клиент для эндпоинтов наставника (tutor).
 * Все запросы требуют JWT и роль role = tutor.
 *
 * Сущности: User (tutor), Slot, Event, Payment
 *
 * Бизнес-логика:
 * - Слот не создаётся в прошлом
 * - Слоты одного наставника не пересекаются по времени
 * - При удалении слота с бронью → status = cancelled или запрет
 * - При бронировании студентом → status = booked
 */

import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';
import { handle401 } from '@/lib/api/auth-error';

// --- Типы ---

export interface TutorProfile {
  id?: string;
  email?: string;
  fullName?: string;
  full_name?: string;
  avatarUrl?: string;
  avatar_url?: string;
  bio?: string;
  shortBio?: string;
  short_bio?: string;
  phone?: string;
  hourlyRate?: number;
  hourly_rate?: number;
  pricePerHour?: number;
  groupMeetings?: string;
  group_meetings?: string;
  role?: 'tutor';
  created_at?: string;
  updated_at?: string;
}

export interface TutorProfileUpdate {
  fullName?: string;
  full_name?: string;
  avatarUrl?: string;
  avatar_url?: string;
  bio?: string;
  shortBio?: string;
  short_bio?: string;
  email?: string;
  phone?: string;
  hourlyRate?: number;
  hourly_rate?: number;
  pricePerHour?: number;
  groupMeetings?: string;
  group_meetings?: string;
}

/** free (или available) | booked | cancelled */
export type SlotStatus = 'free' | 'available' | 'booked' | 'cancelled';

export interface Slot {
  id: string;
  tutor_id?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: SlotStatus;
  created_at?: string;
  updated_at?: string;
}

export interface SlotCreate {
  date: string;
  time: string;
}

export interface SlotUpdate {
  date?: string;
  time?: string;
  status?: SlotStatus;
}

/** planned | done | cancelled */
export type EventStatus = 'planned' | 'done' | 'cancelled';

export interface Event {
  id: string;
  slot_id: string;
  student_id?: string;
  status: EventStatus;
  notes?: string;
}

export interface EventCreate {
  slot_id?: string;
  date?: string;
  time?: string;
  title?: string;
}

/** Полный payload для создания события из формы new-event */
export interface EventCreateFull {
  title: string;
  description: string;
  date: string;
  time: string;
  price: number;
  max_participants: number;
  cover_image?: string;
}

export interface EventUpdate {
  status?: EventStatus;
}

/** pending | success | failed */
export type PaymentStatus = 'pending' | 'success' | 'failed';

export interface Payment {
  id: string;
  tutor_id?: string;
  amount: number;
  currency?: string;
  status: PaymentStatus;
  created_at?: string;
}

export interface PaymentsSummary {
  total_income: number;
  month_income?: number;
  balance?: number;
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
    if (res.status === 403) {
      const msg =
        typeof payload === 'string'
          ? payload
          : payload?.message ?? payload?.error ?? 'Доступ запрещён. Переключитесь на роль Наставник.';
      throw new Error(msg);
    }
    const msg =
      typeof payload === 'string'
        ? payload
        : payload?.message ?? payload?.error ?? (Array.isArray(payload?.errors) ? payload.errors.join(', ') : 'Ошибка запроса');
    throw new Error(msg);
  }

  return payload as T;
}

// --- Профиль наставника ---

/** GET /tutor/profile — получить данные профиля */
export async function getTutorProfile(): Promise<TutorProfile> {
  const res = await fetch(endpoints.tutorProfile, {
    headers: await authHeaders(),
  });
  return handleResponse<TutorProfile>(res);
}

/** PUT /tutor/profile — обновить личные данные (full_name, bio, avatar_url) */
export async function updateTutorProfile(data: TutorProfileUpdate): Promise<TutorProfile> {
  const res = await fetch(endpoints.tutorProfile, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<TutorProfile>(res);
}

// --- Слоты для записи ---

/** GET /tutor/slots — список слотов (фильтр: date, status) */
export async function getTutorSlots(params?: {
  date?: string; // YYYY-MM-DD
  status?: SlotStatus | string;
}): Promise<Slot[]> {
  const search = new URLSearchParams();
  if (params?.date) search.set('date', params.date);
  if (params?.status) search.set('status', params.status);
  const qs = search.toString();
  const url = qs ? `${endpoints.tutorSlots}?${qs}` : endpoints.tutorSlots;

  const res = await fetch(url, {
    headers: await authHeaders(),
  });
  const data = await handleResponse<Slot[] | { slots?: Slot[] }>(res);
  return Array.isArray(data) ? data : (data.slots ?? []);
}

/** POST /tutor/slots — добавить слот (date, time) */
export async function createTutorSlot(slot: SlotCreate): Promise<Slot> {
  const res = await fetch(endpoints.tutorSlots, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(slot),
  });
  return handleResponse<Slot>(res);
}

/** PUT /tutor/slots/{id} — редактировать слот */
export async function updateTutorSlot(id: string, data: SlotUpdate): Promise<Slot> {
  const res = await fetch(`${endpoints.tutorSlots}/${id}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<Slot>(res);
}

/** DELETE /tutor/slots/{id} — удалить слот */
export async function deleteTutorSlot(id: string): Promise<void> {
  const res = await fetch(`${endpoints.tutorSlots}/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  await handleResponse(res);
}

/** DELETE /tutor/slots — массовое удаление (slotIds) */
export async function deleteTutorSlots(slotIds: string[]): Promise<void> {
  const res = await fetch(endpoints.tutorSlots, {
    method: 'DELETE',
    headers: await authHeaders(),
    body: JSON.stringify({ slotIds }),
  });
  await handleResponse(res);
}

// --- События/занятия ---

/** GET /tutor/events — список событий (привязанных к слотам) */
export async function getTutorEvents(): Promise<Event[]> {
  const res = await fetch(endpoints.tutorEvents, {
    headers: await authHeaders(),
  });
  const data = await handleResponse<Event[] | { events?: Event[] }>(res);
  return Array.isArray(data) ? data : (data.events ?? []);
}

/** POST /tutor/events — создать событие (если добавляем сразу занятие) */
export async function createTutorEvent(event: EventCreate): Promise<Event> {
  const res = await fetch(endpoints.tutorEvents, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(event),
  });
  return handleResponse<Event>(res);
}

/** POST /tutor/events — создать событие с полными данными (Название, Описание, Дата, Время, Стоимость, Участники, Обложка) */
export async function createTutorEventFull(event: EventCreateFull): Promise<Event> {
  const res = await fetch(endpoints.tutorEvents, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(event),
  });
  return handleResponse<Event>(res);
}

/** PUT /tutor/events/{id} — обновить статус урока */
export async function updateTutorEvent(id: string, data: EventUpdate): Promise<Event> {
  const res = await fetch(`${endpoints.tutorEvents}/${id}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<Event>(res);
}

// --- Платежи ---

/** GET /tutor/payments — список платежей (сумма, дата, статус) */
export async function getTutorPayments(): Promise<Payment[]> {
  const res = await fetch(endpoints.tutorPayments, {
    headers: await authHeaders(),
  });
  const data = await handleResponse<Payment[] | { payments?: Payment[] }>(res);
  return Array.isArray(data) ? data : (data.payments ?? []);
}

/** GET /tutor/payments/summary — статистика (общий доход, за месяц) */
export async function getTutorPaymentsSummary(): Promise<PaymentsSummary> {
  const res = await fetch(endpoints.tutorPaymentsSummary, {
    headers: await authHeaders(),
  });
  return handleResponse<PaymentsSummary>(res);
}
