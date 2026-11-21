import { requireProfile, confirmProfileChanges } from '@/lib/api/profile-response';
/**
 * API-клиент для эндпоинтов ученика (student).
 * Профиль: full_name, email, phone, avatar_url.
 */

import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';
import { handle401 } from '@/lib/api/auth-error';
import { authedFetch } from '@/lib/authed-fetch';

export interface StudentProfile {
  id?: string;
  email?: string;
  full_name?: string;
  fullName?: string;
  phone?: string;
  telegram?: string;
  avatar_url?: string;
  avatarUrl?: string;
}

export interface StudentProfileUpdate {
  full_name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  telegram?: string;
  avatar_url?: string;
  avatarUrl?: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * POST /api/auth/change-password — сменить пароль по старому/новому значению.
 *
 * Бэкенд не реализовал этот эндпоинт (только сброс пароля по ссылке на
 * почту через /api/auth/forgot). При 404 бросаем ошибку с кодом
 * NOT_IMPLEMENTED, чтобы экран мог предложить пользователю запасной вариант
 * (ссылку на почту) вместо того, чтобы молча делать вид, что пароль сменился.
 */
export async function changeStudentPassword(oldPassword: string, newPassword: string): Promise<void> {
  const res = await authedFetch(endpoints.changePassword, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      oldPassword,
      old_password: oldPassword,
      newPassword,
      new_password: newPassword,
    }),
  });
  if (res.status === 404 || res.status === 405) {
    const err = new Error('Смена пароля пока недоступна');
    (err as Error & { code?: string }).code = 'NOT_IMPLEMENTED';
    throw err;
  }
  if (res.status === 401) {
    await handle401(res);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data?.message ?? data?.error ?? `HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : 'Не удалось сменить пароль');
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    await handle401(res);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message ?? data?.error ?? `HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : 'Ошибка запроса');
  }
  return data as T;
}

/** GET /api/student/profile — authoritative profile, never a local-only fallback. */
export async function getStudentProfile(): Promise<StudentProfile> {
  const res = await authedFetch(endpoints.studentProfile, {
    cache: 'no-store', headers: { Accept: 'application/json' },
  });
  return requireProfile<StudentProfile>(await handleResponse<unknown>(res));
}

/** Persist to the server; validation/network errors must remain visible. */
export async function updateStudentProfile(data: StudentProfileUpdate): Promise<StudentProfile> {
  const res = await authedFetch(endpoints.studentProfile, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });
  const saved = requireProfile<StudentProfile>(await handleResponse<unknown>(res));
  confirmProfileChanges(saved, data);
  return saved;
}

/**
 * PUT /api/auth/change-password — сменить пароль, зная старый (для формы
 * "Старый пароль / Новый пароль" в вебе). ВАЖНО: такого эндпоинта пока нет
 * в бэкенде (проверено — есть только email-флоу forgot/reset), поэтому
 * этот вызов сейчас гарантированно вернёт 404.
 * Локальная подмена результата недопустима: изменения должны быть
 * подтверждены сервером.
 */
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const res = await authedFetch(endpoints.changePassword, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPassword, newPassword }),
  });
  await handleResponse<void>(res);
}
