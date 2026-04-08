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
import { isRegisteredOnEventItem, parseFeedItems } from '@/lib/event-feed';

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
  tutor?: string;           // tutor / counterparty display
  title?: string;           // event title or session label
  subtitle?: string;        // e.g. kind label + date
  amount: number;
  status: 'success' | 'failed' | 'pending';
  created_at: string;
  type?: 'event' | 'session';
  /** Из GET /student/payments: session | event */
  kind?: 'session' | 'event';
  eventId?: string;
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

/** Бэкенд: одна активная карта; при новой привязке сначала DELETE текущей */
const MAX_CARDS = 1;

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

function mapApiPaymentStatus(raw: unknown): 'success' | 'failed' | 'pending' {
  const s = typeof raw === 'string' ? raw.toLowerCase() : '';
  if (['success', 'succeeded', 'paid', 'completed', 'complete'].includes(s)) return 'success';
  if (['failed', 'error', 'cancelled', 'canceled'].includes(s)) return 'failed';
  return 'pending';
}

function mapPaymentRow(raw: Record<string, unknown>): PaymentHistoryItem {
  const kind = (raw.kind as string)?.toLowerCase();
  const isEvent = kind === 'event';
  const eventId =
    (raw.eventId as string) ??
    (raw.event_id as string) ??
    (isEvent ? String(raw.id ?? '') : undefined);

  const tutorName =
    (raw.tutorName as string) ??
    (raw.tutor_name as string) ??
    (raw.counterpartyName as string) ??
    (raw.counterparty_name as string) ??
    '';

  let title =
    (raw.eventTitle as string) ??
    (raw.event_title as string) ??
    (raw.title as string);
  if (!title && isEvent) title = String(raw.description ?? '');
  if (!title) title = kind === 'session' ? 'Сессия с наставником' : 'Платёж';

  const amount =
    typeof raw.amount === 'number'
      ? raw.amount
      : typeof raw.sum === 'number'
        ? raw.sum
        : typeof raw.total === 'number'
          ? raw.total
          : 0;

  const created =
    (raw.created_at as string) ??
    (raw.createdAt as string) ??
    (raw.date as string) ??
    new Date().toISOString();

  const subtitleParts: string[] = [];
  if (kind === 'event') subtitleParts.push('Мероприятие');
  else if (kind === 'session') subtitleParts.push('Сессия');
  const statusRaw = raw.status ?? raw.payment_status;
  return {
    id: String(raw.id ?? ''),
    title,
    tutor: tutorName || undefined,
    subtitle: subtitleParts.length ? subtitleParts.join(' · ') : undefined,
    amount,
    status: mapApiPaymentStatus(statusRaw),
    created_at: created,
    type: isEvent ? 'event' : 'session',
    kind: kind === 'event' ? 'event' : kind === 'session' ? 'session' : undefined,
    eventId,
  };
}

/**
 * GET /api/student/payments?page=&limit= — история оплат (сессии + мероприятия).
 * ok: true если ответ успешный и тело разобрано (даже при пустом списке).
 */
export async function fetchStudentPaymentHistory(
  page = 1,
  limit = 50
): Promise<{ items: PaymentHistoryItem[]; ok: boolean }> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));

  const url = `${endpoints.studentPayments}?${params.toString()}`;

  const res = await fetch(url, {
    headers: await authHeaders(),
  });

  if (res.status === 404) {
    return { items: [], ok: false };
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    if (res.status === 401) await handle401(res, payload);
    return { items: [], ok: false };
  }

  const root = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>;
  const rawList = root.data ?? root.items ?? root.payments ?? [];
  const rows = Array.isArray(rawList) ? rawList : [];
  const items = rows.map((row) =>
    mapPaymentRow(typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : {})
  );
  return { items, ok: true };
}

/**
 * Fallback: история из feed, если GET /student/payments недоступен.
 */
async function historyFromFeed(headers: HeadersInit): Promise<PaymentHistoryItem[]> {
  try {
    const feedRes = await fetch(endpoints.eventsFeed, { headers });
    if (!feedRes.ok) return [];
    const data = await feedRes.json();
    const items = parseFeedItems(data) as Array<Record<string, any>>;
    return items
      .filter((e) => isRegisteredOnEventItem(e))
      .map((e) => {
        const start = e.datetimeStart ?? e.datetime_start;
        const d = start ? new Date(start as string) : null;
        const dateStr = d
          ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          : '';
        const paid = e.isPaid ?? e.is_paid ?? e.paid;
        const mentor = e.mentor as { name?: string } | undefined;
        return {
          id: String(e.id),
          title: (e.title as string) ?? '',
          subtitle: dateStr ? `Мероприятие ${dateStr}` : undefined,
          tutor: mentor?.name,
          amount: typeof e.price === 'number' ? e.price : 0,
          status: (paid ? 'success' : 'pending') as 'success' | 'failed' | 'pending',
          created_at: (start as string) ?? new Date().toISOString(),
          type: 'event' as const,
          kind: 'event' as const,
          eventId: String(e.id),
        };
      });
  } catch (err) {
    // ignore — return empty history
    return [];
  }
}

/**
 * GET — список карт + история платежей.
 * Карты: GET /api/student/payment-methods.
 * История: GET /api/student/payments; если эндпоинт недоступен — fallback на feed.
 */
export async function getStudentPayments(): Promise<StudentPaymentsResponse> {
  const headers = await authHeaders();
  const methods = await getPaymentMethods();
  const cards = methods.map(toCard);

  let history: PaymentHistoryItem[] = [];
  try {
    const { items, ok } = await fetchStudentPaymentHistory(1, 50);
    history = ok ? items : await historyFromFeed(headers);
  } catch {
    history = await historyFromFeed(headers);
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
