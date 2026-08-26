/**
 * API-клиент для эндпоинтов ученика (student).
 * Профиль: full_name, email, phone, avatar_url.
 */

import { endpoints } from '@/constants/env';
import { getAuthToken, getAuthRole, getRefreshToken, getUserProfile, saveAuthToken } from '@/lib/auth';
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

/** GET /api/student/profile — получить данные профиля ученика */
export async function getStudentProfile(): Promise<StudentProfile> {
  const res = await fetch(endpoints.studentProfile, {
    headers: await authHeaders(),
  });
  const raw = await handleResponse<any>(res);
  // Unwrap { data: {...} } or { user: {...} } envelope if present
  const profile =
    (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) ? raw.data
    : (raw?.user && typeof raw.user === 'object') ? raw.user
    : raw;
  return profile as StudentProfile;
}

/**
 * PUT /api/student/profile — обновить личные данные.
 *
 * Backend не реализовал этот эндпоинт (возвращает 404).
 * При 404 сохраняем изменения локально в SecureStore/localStorage,
 * чтобы они отображались в приложении сразу.
 * Когда бэкенд добавит эндпоинт — данные будут отправляться туда.
 */
export async function updateStudentProfile(data: StudentProfileUpdate): Promise<StudentProfile> {
  // Only send avatarUrl if it's a valid HTTP(S) URL — strips empty, relative, file:// values
  const serverData: StudentProfileUpdate = { ...data };
  const rawAvatar = serverData.avatarUrl ?? serverData.avatar_url ?? '';
  if (!rawAvatar || (!rawAvatar.startsWith('https://') && !rawAvatar.startsWith('http://'))) {
    delete serverData.avatarUrl;
    delete serverData.avatar_url;
  }

  try {
    // authedFetch refreshes token and retries on 401 — prevents logout during profile save
    const res = await authedFetch(endpoints.studentProfile, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(serverData),
    });
    // Fall through to local save on 404 (not implemented) or 400 (validation error from bad field)
    if (res.status !== 404 && res.status !== 400) {
      return handleResponse<StudentProfile>(res);
    }
  } catch {
    // network error → fall through to local save
  }

  // Save locally so profile changes persist and are visible in the app
  const token = await getAuthToken();
  const role = await getAuthRole();
  const refreshToken = await getRefreshToken();
  const existing = await getUserProfile();

  const updated = {
    ...existing,
    ...(data.fullName   !== undefined ? { full_name:   data.fullName }   : {}),
    ...(data.full_name  !== undefined ? { full_name:   data.full_name }  : {}),
    ...(data.email      !== undefined ? { email:       data.email }      : {}),
    ...(data.phone      !== undefined ? { phone:       data.phone }      : {}),
    ...(data.telegram   !== undefined ? { telegram:    data.telegram }   : {}),
    ...(data.avatarUrl  !== undefined ? { avatar_url:  data.avatarUrl }  : {}),
    ...(data.avatar_url !== undefined ? { avatar_url:  data.avatar_url } : {}),
  };

  if (token) {
    await saveAuthToken(
      token,
      role ?? undefined,
      refreshToken ?? undefined,
      updated as Parameters<typeof saveAuthToken>[3],
    );
  }

  return updated as StudentProfile;
}

/**
 * PUT /api/auth/change-password — сменить пароль, зная старый (для формы
 * "Старый пароль / Новый пароль" в вебе). ВАЖНО: такого эндпоинта пока нет
 * в бэкенде (проверено — есть только email-флоу forgot/reset), поэтому
 * этот вызов сейчас гарантированно вернёт 404. В отличие от
 * updateStudentProfile здесь НЕТ локального фолбэка: подделать смену
 * пароля на клиенте нельзя — реальный пароль для входа не поменяется,
 * и это ввело бы пользователя в заблуждение.
 */
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const res = await authedFetch(endpoints.changePassword, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPassword, newPassword }),
  });
  await handleResponse<void>(res);
}
