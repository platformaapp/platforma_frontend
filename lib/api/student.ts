/**
 * API-клиент для эндпоинтов ученика (student).
 * Профиль: full_name, email, phone, avatar_url.
 */

import { endpoints } from '@/constants/env';
import { getAuthToken, getAuthRole, getRefreshToken, getUserProfile, saveAuthToken } from '@/lib/auth';
import { handle401 } from '@/lib/api/auth-error';

export interface StudentProfile {
  id?: string;
  email?: string;
  full_name?: string;
  fullName?: string;
  phone?: string;
  avatar_url?: string;
  avatarUrl?: string;
}

export interface StudentProfileUpdate {
  full_name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
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
  return handleResponse<StudentProfile>(res);
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
  // Try the real backend endpoint first — works automatically when implemented
  try {
    const res = await fetch(endpoints.studentProfile, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify(data),
    });
    if (res.status !== 404) {
      return handleResponse<StudentProfile>(res);
    }
    // 404 → endpoint not implemented, fall through to local save
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
