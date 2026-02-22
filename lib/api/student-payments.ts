/**
 * API для платёжных операций ученика (student).
 *
 * 1. POST /student/payment-methods — привязка карты
 * 2. GET /student/payments — список карт и история оплат
 * 3. POST /student/payments — оплата сессии
 * 4. DELETE /student/payment-methods/{id} — удаление карты
 *
 * Авторизация: JWT, роль student.
 */

import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';

// --- Типы ---

export interface BindCardBody {
  provider: 'yookassa';
  card_number: string;
}

export interface PaymentMethodResponse {
  id: string;
  provider: string;
  card_masked: string;
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
    const msg =
      typeof payload === 'string'
        ? payload
        : payload?.message ?? payload?.error ?? payload?.error_message ?? 'Ошибка запроса';
    throw new Error(msg);
  }

  return payload as T;
}

// --- API ---

/** POST /student/payment-methods — привязать карту */
export async function bindPaymentMethod(body: BindCardBody): Promise<PaymentMethodResponse> {
  const cardNumber = body.card_number.replace(/\s/g, '');
  const payload = { provider: body.provider, card_number: cardNumber };

  const doRequest = async (url: string) =>
    fetch(url, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });

  let res = await doRequest(endpoints.studentPaymentMethods);
  if (!res.ok && (res.status === 404 || res.status === 405)) {
    res = await doRequest(endpoints.studentPaymentMethodsLegacy);
  }
  return handleResponse<PaymentMethodResponse>(res);
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

/** DELETE /student/payment-methods/{id} — удалить карту */
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
