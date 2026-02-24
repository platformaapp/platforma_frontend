import { clearAuth } from '@/lib/auth';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Обработка 401: очистить auth и выбросить AuthError для редиректа на /login */
export async function handle401(res: Response, payload?: unknown): Promise<never> {
  await clearAuth();
  const msg =
    payload !== undefined
      ? (typeof payload === 'string' ? payload : (payload as any)?.message ?? (payload as any)?.error ?? 'Требуется авторизация')
      : 'Требуется авторизация';
  throw new AuthError(msg);
}
