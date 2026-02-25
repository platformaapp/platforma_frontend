/**
 * API для платёжных операций ученика (student).
 *
 * Привязка карт (3D-Secure через YooKassa):
 * - POST api/student/payment-methods/bind — инициализация привязки (тестовый платёж 1₽)
 * - Редирект на 3D-Secure, YooKassa возвращает payment_method_id, карта сохраняется как ACTIVE
 *
 * Оплата сессий:
 * - POST api/student/payments — создание платежа
 * - GET api/student/payments/callback — обработка 3D-Secure колбэка
 *
 * Валидации: макс. 3 карты, нельзя удалить карту с активными платежами.
 */

import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';
import { handle401 } from '@/lib/api/auth-error';

// --- Типы ---

export interface BindCardBody {
  provider: 'yookassa';
  card_number: string;
}

export interface PaymentMethodResponse {
  id?: string;
  provider?: string;
  card_masked?: string;
  /** URL для редиректа на 3D-Secure (YooKassa) */
  redirect_url?: string;
  confirmation_url?: string;
  payment_method_id?: string;
}

export interface Card {
  id: string;
  card_masked: string;
  provider: string;
}

export interface PaymentHistoryItem {
  id: string;
  tutor: string;
  amount: number;
  status: 'success' | 'failed' | 'pending';
  created_at: string;
}

export interface StudentPaymentsResponse {
  cards: Card[];
  history: PaymentHistoryItem[];
}

export interface PaySessionBody {
  session_id: string;
  payment_method_id: string;
}

export interface PaySessionResponse {
  payment_id: string;
  redirect_url?: string;
  status?: 'success' | 'failed' | 'pending';
  error_message?: string;
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
    const msg =
      typeof payload === 'string'
        ? payload
        : payload?.message ?? payload?.error ?? payload?.error_message ?? 'Ошибка запроса';
    throw new Error(msg);
  }

  return payload as T;
}

// --- API ---

const MAX_CARDS = 3;

/**
 * POST api/student/payment-methods/bind — инициализация привязки карты.
 * Создаётся тестовый платёж 1₽, возвращается redirect_url для 3D-Secure.
 * После прохождения 3D-Secure — GET /student/payments/callback обрабатывает колбэк,
 * YooKassa возвращает payment_method_id, карта сохраняется как ACTIVE.
 */
export async function bindPaymentMethod(body: BindCardBody): Promise<PaymentMethodResponse> {
  const cardNumber = body.card_number.replace(/\s/g, '');
  const payload = { provider: body.provider, card_number: cardNumber };

  const url = endpoints.studentPaymentMethodsBind;
  const res = await fetch(url, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok && (res.status === 404 || res.status === 405)) {
    const legacyRes = await fetch(`${endpoints.studentPaymentMethodsLegacy}/bind`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    if (legacyRes.status === 500) throw new Error('Ошибка при привязке карты, попробуйте позже');
    return handleResponse<PaymentMethodResponse>(legacyRes);
  }

  if (res.status === 500) throw new Error('Ошибка при привязке карты, попробуйте позже');
  const data = await handleResponse<PaymentMethodResponse & { confirmation_url?: string }>(res);
  return {
    id: data.id,
    provider: data.provider,
    card_masked: data.card_masked,
    redirect_url: data.redirect_url ?? data.confirmation_url,
    payment_method_id: data.payment_method_id,
  };
}

/** Максимум карт на пользователя */
export { MAX_CARDS };

/**
 * GET /student/payments/callback — обработка 3D-Secure колбэка.
 * Вызывается после редиректа с YooKassa (или клиентом с query-параметрами).
 * Завершает привязку карты, сохраняет payment_method_id, карта → ACTIVE.
 */
export async function getStudentPaymentsCallback(params?: {
  payment_id?: string;
  success?: string;
  [key: string]: string | undefined;
}): Promise<{ success?: boolean; card_masked?: string; message?: string }> {
  const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
  const url = qs ? `${endpoints.studentPaymentsCallback}?${qs}` : endpoints.studentPaymentsCallback;
  const res = await fetch(url, { headers: await authHeaders() });
  return handleResponse(res);
}

/** GET /student/payments — список карт и история оплат */
export async function getStudentPayments(): Promise<StudentPaymentsResponse> {
  let res = await fetch(endpoints.studentPayments, { headers: await authHeaders() });
  if (!res.ok && (res.status === 404 || res.status === 405)) {
    res = await fetch(endpoints.studentPayments.replace('/api/student/', '/student/'), {
      headers: await authHeaders(),
    });
  }

  const data = await handleResponse<{ cards?: Card[]; history?: PaymentHistoryItem[] }>(res);
  return {
    cards: data.cards ?? [],
    history: data.history ?? [],
  };
}

/** POST /student/payments — оплата сессии */
export async function paySession(body: PaySessionBody): Promise<PaySessionResponse> {
  const res = await fetch(endpoints.studentPayments, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });

  const data = await handleResponse<PaySessionResponse>(res);
  return {
    payment_id: data.payment_id,
    redirect_url: data.redirect_url,
    status: data.status,
    error_message: data.error_message,
  };
}

/** DELETE /student/payment-methods/{id} — удалить карту по id */
export async function deletePaymentMethod(id: string): Promise<void> {
  let res = await fetch(`${endpoints.studentPaymentMethods}/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok && (res.status === 404 || res.status === 405)) {
    res = await fetch(`${endpoints.studentPaymentMethodsLegacy}/${id}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
  }
  await handleResponse(res);
}

/** DELETE /payments/method — отвязать текущую карту */
export async function deleteCurrentPaymentMethod(): Promise<void> {
  const res = await fetch(endpoints.paymentsMethod, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  await handleResponse<{ message?: string }>(res);
}
