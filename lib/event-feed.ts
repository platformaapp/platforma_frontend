/**
 * Нормализация ответов GET /api/events/feed и карточки события:
 * бэкенд может отдавать isRegistered, is_registered, registrationStatus и оборачивать в { data }.
 */

export function unwrapApiData<T extends Record<string, unknown>>(json: unknown): T | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Record<string, unknown>;
  const inner = j.data ?? j.event;
  if (inner && typeof inner === 'object') {
    const o = inner as Record<string, unknown>;
    if (o.event && typeof o.event === 'object') return o.event as T;
    return inner as T;
  }
  return null;
}

export function parseFeedItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const o = data as Record<string, unknown>;
  if (Array.isArray(o.items)) return o.items;
  if (Array.isArray(o.data)) return o.data;
  const nested = o.data;
  if (nested && typeof nested === 'object' && Array.isArray((nested as Record<string, unknown>).items)) {
    return (nested as { items: unknown[] }).items;
  }
  return [];
}

/** Пользователь записан на мероприятие — учитываем разные имена полей из API */
export function isRegisteredOnEventItem(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const r = item as Record<string, unknown>;

  const direct =
    r.isRegistered ??
    r.is_registered ??
    r.registered ??
    r.userRegistered ??
    r.user_registered;
  if (typeof direct === 'boolean') return direct;
  if (typeof direct === 'number') return direct === 1;
  if (typeof direct === 'string') {
    const s = direct.toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'registered';
  }

  const status = r.registrationStatus ?? r.registration_status ?? r.user_event_status;
  if (typeof status === 'string') {
    const s = status.toLowerCase();
    return ['registered', 'confirmed', 'active', 'paid', 'completed', 'success'].includes(s);
  }

  // Check current_user_participation / currentUserParticipation
  const cup = r.currentUserParticipation ?? r.current_user_participation;
  if (cup && typeof cup === 'object') {
    const cupObj = cup as Record<string, unknown>;
    const cupStatus = (cupObj.status as string | undefined)?.toLowerCase();
    if (cupStatus && ['registered', 'confirmed', 'active', 'paid', 'attended', 'completed'].includes(cupStatus)) {
      return true;
    }
    const payStatus = (cupObj.paymentStatus ?? cupObj.payment_status) as string | undefined;
    if (payStatus?.toLowerCase() === 'paid') return true;
  }

  const nested = r.userEvent ?? r.user_event;
  if (nested && typeof nested === 'object') {
    return isRegisteredOnEventItem(nested);
  }

  return false;
}
