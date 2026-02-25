/**
 * API для платёжных операций ученика (student).
 *
 * Привязка карт (3D-Secure через YooKassa):
 * - POST api/student/payment-methods/bind — body {} или { provider: "yookassa" }
 * - Ответ: { success, data: { confirmationUrl, attachmentId } }
 * - Редирект на confirmationUrl → пользователь вводит карту на YooKassa
 * - Webhook → бэк обновляет карту в БД, YooKassa редиректит на /payment-methods/callback
 * - Callback: опрос GET payment-methods до появления новой карты (webhook может задержаться)
 *
 * GET api/student/payment-methods — список карт: { success, data: { paymentMethods, total } }
 */

import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';
import { handle401 } from '@/lib/api/auth-error';

// --- Типы ---

export interface BindCardResponse {
  success: boolean;
  data?: {
    confirmationUrl: string;
    attachmentId?: string;
  };
}

export interface PaymentMethod {
  id: string;
  cardMasked: string;
  cardType?: string;
  expiryMonth?: string;
  expiryYear?: string;
  isDefault: boolean;
  createdAt?: string;
}

export interface PaymentMethodsResponse {
  success: boolean;
  data?: {
    paymentMethods: PaymentMethod[];
    total?: number;
  };
}

/** Карта в унифицированном формате (поддержка legacy) */
export interface Card {
  id: string;
  card_masked?: string;
  cardMasked?: string;
  provider?: string;
  cardType?: string;
  isDefault?: boolean;
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
 * Body: {} или { provider: "yookassa" }. Пользователь вводит карту на странице YooKassa.
 * Ответ: { success, data: { confirmationUrl, attachmentId } }.
 */
export async function bindPaymentMethod(body?: { provider?: string }): Promise<{ confirmationUrl: string; attachmentId?: string }> {
  const payload = body ?? { provider: 'yookassa' };

  const res = await fetch(endpoints.studentPaymentMethodsBind, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });

  if (res.status === 500) throw new Error('Ошибка при привязке карты, попробуйте позже');
  const data = await handleResponse<BindCardResponse>(res);

  if (!data.success || !data.data?.confirmationUrl) {
    throw new Error((data as { message?: string }).message ?? 'Не удалось получить ссылку для привязки');
  }
  return {
    confirmationUrl: data.data.confirmationUrl,
    attachmentId: data.data.attachmentId,
  };
}

/** Максимум карт на пользователя */
export { MAX_CARDS };

/** GET api/student/payment-methods — список карт */
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const res = await fetch(endpoints.studentPaymentMethods, { headers: await authHeaders() });
  const data = await handleResponse<PaymentMethodsResponse & { cards?: Array<{ id: string; card_masked?: string; provider?: string }> }>(res);
  const methods = data.data?.paymentMethods;
  if (methods?.length) return methods;
  const legacy = data.cards;
  if (legacy?.length) {
    return legacy.map((c) => ({
      id: c.id,
      cardMasked: (c as { card_masked?: string }).card_masked ?? (c as { cardMasked?: string }).cardMasked ?? '****',
      isDefault: false,
    }));
  }
  return [];
}

/** Унифицированный список карт (поддержка legacy card_masked) */
function toCard(pm: PaymentMethod): Card {
  return {
    id: pm.id,
    card_masked: pm.cardMasked,
    cardMasked: pm.cardMasked,
    cardType: pm.cardType,
    isDefault: pm.isDefault,
  };
}

/** GET — список карт и история оплат (для совместимости) */
export async function getStudentPayments(): Promise<StudentPaymentsResponse> {
  const cards: Card[] = [];
  try {
    const methods = await getPaymentMethods();
    cards.push(...methods.map(toCard));
  } catch {
    // fallback: GET /student/payments
    const res = await fetch(endpoints.studentPayments, { headers: await authHeaders() });
    const data = await handleResponse<{ cards?: Card[]; history?: PaymentHistoryItem[] }>(res);
    if (data.cards?.length) cards.push(...data.cards);
  }

  let history: PaymentHistoryItem[] = [];
  try {
    const res = await fetch(endpoints.studentPayments, { headers: await authHeaders() });
    const data = await handleResponse<{ cards?: Card[]; history?: PaymentHistoryItem[] }>(res);
    history = data.history ?? [];
  } catch {
    // ignore
  }

  return { cards, history };
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

/** DELETE /api/student/payment-methods/{id} — удалить карту по id */
export async function deletePaymentMethod(id: string): Promise<void> {
  const res = await fetch(`${endpoints.studentPaymentMethods}/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  await handleResponse(res);
}

/** PATCH /api/student/payment-methods/{id}/default — установить карту по умолчанию */
export async function setDefaultPaymentMethod(id: string): Promise<void> {
  const res = await fetch(`${endpoints.studentPaymentMethods}/${id}/default`, {
    method: 'PATCH',
    headers: await authHeaders(),
  });
  await handleResponse(res);
}

/** DELETE /payments/method — отвязать текущую карту (legacy) */
export async function deleteCurrentPaymentMethod(): Promise<void> {
  const res = await fetch(endpoints.paymentsMethod, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  await handleResponse<{ message?: string }>(res);
}
