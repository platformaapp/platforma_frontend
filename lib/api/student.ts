/**
 * API-клиент для эндпоинтов ученика (student).
 * Профиль: full_name, email, phone, avatar_url.
 */

import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';
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

/** PUT /api/student/profile — обновить личные данные (full_name, email, phone, avatar_url) */
export async function updateStudentProfile(data: StudentProfileUpdate): Promise<StudentProfile> {
  const res = await fetch(endpoints.studentProfile, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<StudentProfile>(res);
}
