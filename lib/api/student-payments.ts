/**
 * API для платёжных операций ученика (student).
 *
 * Привязка карт (3D-Secure через YooKassa):
 * - POST /api/student/payment-methods/bind — body {} или { provider: "yookassa" }
 * - Ответ: { success, data: { confirmationUrl, attachmentId, yookassaPaymentId } }
 * - Сохранить yookassaPaymentId в localStorage (pendingCardBindingPaymentId), редирект на confirmationUrl
 * - После return_url: GET /api/student/payments/callback?payment_id=<yookassaPaymentId> (JWT)
 *
 * payment_id в callback — это yookassaPaymentId, не внутренний attachmentId.
 *
 * GET /api/student/payment-methods — список карт: { success, data: { paymentMethods, total } }
 */

/** Ключ localStorage для id платежа YooKassa до возврата с checkout */
export const PENDING_CARD_BINDING_PAYMENT_ID_KEY = 'pendingCardBindingPaymentId';

/** Сколько карт было до привязки — для fallback «Проверить статус» на веб-callback */
export const PENDING_CARD_BINDING_INITIAL_COUNT_KEY = 'pendingCardBindingInitialCount';

import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';
import { handle401 } from '@/lib/api/auth-error';

// --- Типы ---

export interface BindCardResponse {
  success: boolean;
  data?: {
    confirmationUrl: string;
    attachmentId?: string;
    /** Id платежа в YooKassa — его передают в GET .../payments/callback?payment_id= */
    yookassaPaymentId?: string;
  };
}

export interface PaymentCallbackResult {
  status?: string;
  message?: string;
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
  tutor?: string;           // tutor name (for slot bookings)
  title?: string;           // event title (for events)
  subtitle?: string;        // e.g. "Мероприятие 13.06.25 18:00" or "Сессия 13.06.25 20:00"
  amount: number;
  status: 'success' | 'failed' | 'pending';
  created_at: string;
  type?: 'event' | 'session';
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
 * POST /api/student/payment-methods/bind — инициализация привязки карты.
 * Body: {} или { provider: "yookassa" }. Пользователь вводит карту на странице YooKassa.
 * Ответ: { success, data: { confirmationUrl, attachmentId, yookassaPaymentId } }.
 */
export async function bindPaymentMethod(body?: { provider?: string }): Promise<{
  confirmationUrl: string;
  attachmentId?: string;
  yookassaPaymentId?: string;
  orderId?: string;
}> {
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

  // Fallback: orderId из URL checkout (если бэкенд не прислал yookassaPaymentId)
  let orderId: string | undefined;
  try {
    orderId = new URL(data.data.confirmationUrl).searchParams.get('orderId') ?? undefined;
  } catch {
    // ignore URL parse errors
  }

  const yookassaPaymentId = data.data.yookassaPaymentId ?? orderId;

  return {
    confirmationUrl: data.data.confirmationUrl,
    attachmentId: data.data.attachmentId,
    yookassaPaymentId,
    orderId,
  };
}

/**
 * GET /api/student/payments/callback — синхронная проверка статуса привязки после возврата из YooKassa.
 * Query: payment_id = yookassaPaymentId (не attachmentId).
 */
export async function fetchPaymentBindingCallback(yookassaPaymentId: string): Promise<PaymentCallbackResult> {
  const params = new URLSearchParams();
  params.set('payment_id', yookassaPaymentId);
  const url = `${endpoints.studentPaymentsCallback}?${params.toString()}`;

  const res = await fetch(url, { headers: await authHeaders() });
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json() : await res.text();

  if (res.status === 401) await handle401(res, payload);

  if (!res.ok) {
    const msg =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string })?.message ?? 'Ошибка при подтверждении привязки';
    throw new Error(msg);
  }

  return (typeof payload === 'object' && payload !== null ? payload : {}) as PaymentCallbackResult;
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

/**
 * GET — список карт + история платежей.
 * Карты: GET /api/student/payment-methods (работает).
 * История: GET /api/events/feed (isRegistered=true) — временный источник
 * пока бэкенд не добавит /api/student/payments (сейчас 404).
 */
export async function getStudentPayments(): Promise<StudentPaymentsResponse> {
  const headers = await authHeaders();
  const methods = await getPaymentMethods();
  const cards = methods.map(toCard);

  // Build payment history from registered events (static import, no dynamic)
  let history: PaymentHistoryItem[] = [];
  try {
    const feedRes = await fetch(endpoints.eventsFeed, { headers });
    if (feedRes.ok) {
      const data = await feedRes.json();
      const items: Array<Record<string, any>> = Array.isArray(data)
        ? data
        : (data?.items ?? []);
      history = items
        .filter((e) => e.isRegistered)
        .map((e) => {
          const d = e.datetimeStart ? new Date(e.datetimeStart) : null;
          const dateStr = d
            ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
            : '';
          return {
            id: e.id,
            title: e.title ?? '',
            subtitle: dateStr ? `Мероприятие ${dateStr}` : undefined,
            tutor: e.mentor?.name,
            amount: typeof e.price === 'number' ? e.price : 0,
            status: (e.isPaid ? 'success' : 'pending') as 'success' | 'failed' | 'pending',
            created_at: e.datetimeStart ?? new Date().toISOString(),
            type: 'event' as const,
          };
        });
    }
  } catch { /* ignore */ }

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
