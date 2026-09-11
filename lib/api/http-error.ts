/**
 * Человекочитаемое сообщение по HTTP-статусу — на случай, когда ответ пришёл
 * не от бэкенда, а от прокси/веб-сервера перед ним (например, служебная
 * страница nginx "502 Bad Gateway"), и в теле нет осмысленного JSON-сообщения.
 */
export function friendlyHttpErrorMessage(status: number): string {
  if (status === 502 || status === 503 || status === 504) return 'Сервер временно недоступен. Попробуйте позже.';
  if (status === 401) return 'Требуется повторный вход в аккаунт.';
  if (status === 403) return 'Доступ запрещён.';
  if (status === 404) return 'Не найдено.';
  if (status >= 500) return 'Ошибка на сервере. Попробуйте позже.';
  if (status >= 400) return `Ошибка запроса (${status})`;
  return `Неизвестная ошибка (${status})`;
}

/** true, если текст похож на HTML-страницу (служебная страница прокси), а не на сообщение об ошибке от бэкенда. */
export function looksLikeHtml(text: string): boolean {
  return /^\s*<(!doctype|html)/i.test(text);
}
