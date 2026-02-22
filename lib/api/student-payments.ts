/**
 * API для платёжных методов студента
 *
 * POST /student/payment-methods — привязка карты
 */

import { endpoints } from '@/constants/env';
import { getAuthToken } from '@/lib/auth';

export interface BindCardBody {
  provider: 'yookassa';
  card_number: string;
}

export interface PaymentMethodResponse {
  id: string;
  provider: string;
  card_masked: string;
}

/** POST /student/payment-methods — привязать карту */
export async function bindPaymentMethod(body: BindCardBody): Promise<PaymentMethodResponse> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Требуется авторизация');
  }

  const cardNumber = body.card_number.replace(/\s/g, '');
  const payload = { provider: body.provider, card_number: cardNumber };

  const request = async (url: string) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : await res.text();
    return { res, data };
  };

  let { res, data } = await request(endpoints.studentPaymentMethods);
  if (!res.ok && (res.status === 404 || res.status === 405)) {
    const retry = await request(endpoints.studentPaymentMethodsLegacy);
    res = retry.res;
    data = retry.data;
  }

  if (!res.ok) {
    const msg = typeof data === 'string' ? data : data?.message ?? 'Не удалось привязать карту';
    throw new Error(msg);
  }

  return data as PaymentMethodResponse;
}
