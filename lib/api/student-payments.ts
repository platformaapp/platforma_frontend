/**
 * API для платёжных операций ученика (student).
 *
 * Привязка карт (3D-Secure через YooKassa):
 * - POST api/student/payment-methods/bind — body {} или { provider: "yookassa" }
 * - Ответ: { success, data: { confirmationUrl, attachmentId } }
 * - Редирект на confirmationUrl → пользователь вводит карту на YooKassa
 * - Webhook → бэк обновляет карту в БД, YooKassa редиректит на return_url
 *
 * Важно: return_url при создании платежа должен указывать на существующий эндпоинт,
 * например GET /api/student/payment-methods/callback. GET /api/student/payments → 404.
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
 * orderId извлекается из confirmationUrl (param ?orderId=...) для последующего подтверждения.
 */
export async function bindPaymentMethod(body?: { provider?: string }): Promise<{ confirmationUrl: string; attachmentId?: string; orderId?: string }> {
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

  // Extract orderId from confirmationUrl query string (e.g. ?orderId=3142803d-...)
  let orderId: string | undefined;
  try {
    orderId = new URL(data.data.confirmationUrl).searchParams.get('orderId') ?? undefined;
  } catch {
    // ignore URL parse errors
  }

  return {
    confirmationUrl: data.data.confirmationUrl,
    attachmentId: data.data.attachmentId,
    orderId,
  };
}

/**
 * GET api/student/payments/callback — подтверждение привязки карты после возврата из YooKassa.
 * Бэкенд ожидает параметр paymentId (=orderId из confirmationUrl).
 * LOG: "Processing payment callback for: undefined" означал что параметр назывался неверно.
 */
export async function confirmCardBinding(orderId?: string, attachmentId?: string): Promise<void> {
  const params = new URLSearchParams();
  // Backend reads @Query('payment_id') — snake_case, NOT camelCase paymentId.
  // LOG evidence: "Processing payment callback for: undefined" even with ?paymentId=X
  if (orderId) params.set('payment_id', orderId);
  if (attachmentId) params.set('attachment_id', attachmentId);
  const qs = params.toString();
  const url = `${endpoints.studentPaymentsCallback}${qs ? '?' + qs : ''}`;

  try {
    const res = await fetch(url, { headers: await authHeaders() });
    if (res.status === 401) await handle401(res, null);
    // 500 means the backend can't confirm yet (payment may still be processing) — not fatal
  } catch (e) {
    // Re-throw AuthErrors so the caller can redirect to login
    if ((e as { name?: string })?.name === 'AuthError') throw e;
    // All other errors are ignored — we fall back to polling
  }
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

/** GET — список карт и история. Карты: GET /api/student/payment-methods. GET /payments не существует (404). */
export async function getStudentPayments(): Promise<StudentPaymentsResponse> {
  const methods = await getPaymentMethods();
  const cards = methods.map(toCard);
  return { cards, history: [] };
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
