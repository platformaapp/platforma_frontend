const DAYS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

/** API YYYY-MM-DD → display DD.MM.YY */
export function toDisplayDate(apiDate: string): string {
  const m = apiDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return apiDate;
  const [, year, month, day] = m;
  const yy = year.slice(-2);
  return `${day}.${month}.${yy}`;
}

/** Display DD.MM.YY or DD.MM.YYYY → API YYYY-MM-DD */
export function toApiDate(displayDate: string): string | null {
  const m = displayDate.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return null;
  const [, d, month, year] = m;
  const y = year.length === 2 ? 2000 + parseInt(year, 10) : parseInt(year, 10);
  const dd = d.padStart(2, '0');
  const mm = month.padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/** Только цифры DDMMYY или DDMMYYYY → API YYYY-MM-DD */
export function digitsToApiDate(digits: string): string | null {
  const d = digits.replace(/\D/g, '');
  if (d.length === 6) {
    const dd = d.slice(0, 2);
    const mm = d.slice(2, 4);
    const yy = d.slice(4, 6);
    return toApiDate(`${dd}.${mm}.${yy}`);
  }
  if (d.length === 8) {
    const dd = d.slice(0, 2);
    const mm = d.slice(2, 4);
    const yyyy = d.slice(4, 8);
    return toApiDate(`${dd}.${mm}.${yyyy}`);
  }
  return null;
}

/** Только цифры HHMM или "HH:mm" → "HH:mm" */
export function digitsToTime(digits: string): string | null {
  const withColon = digits.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (withColon) {
    const h = parseInt(withColon[1], 10);
    const m = parseInt(withColon[2], 10);
    if (h <= 23 && m <= 59) return `${String(h).padStart(2, '0')}:${withColon[2]}`;
    return null;
  }
  let t = digits.replace(/\D/g, '');
  if (t.length === 3) t = '0' + t;
  if (t.length < 4) return null;
  const hh = t.slice(0, 2);
  const mm = t.slice(2, 4);
  const h = parseInt(hh, 10);
  const m = parseInt(mm, 10);
  if (h <= 23 && m <= 59) return `${hh}:${mm}`;
  return null;
}

/** Форматирует ввод при наборе: 200725 → 20.07.25 */
export function formatDateInput(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 6) return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 8)}`;
}

/** Форматирует ввод при наборе: 2000 → 20:00 */
export function formatTimeInput(value: string): string {
  const t = value.replace(/\D/g, '').slice(0, 4);
  if (t.length <= 2) return t;
  return `${t.slice(0, 2)}:${t.slice(2)}`;
}

/** Валидация даты ДД.ММ.ГГ или ДД.ММ.ГГГГ. Возвращает null или сообщение об ошибке. */
export function validateDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Введите дату';
  const apiDate = toApiDate(trimmed) ?? digitsToApiDate(trimmed.replace(/\D/g, ''));
  if (!apiDate) return 'Неверный формат даты. Используйте ДД.ММ.ГГ (например 20.07.25)';
  const [y, m, d] = apiDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return 'Некорректная дата';
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) return 'Дата не может быть в прошлом';
  return null;
}

/** Валидация времени ЧЧ:ММ. Возвращает null или сообщение об ошибке. */
export function validateTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Введите время';
  const time = digitsToTime(trimmed);
  if (!time) return 'Неверный формат времени. Используйте ЧЧ:ММ (например 20:00)';
  return null;
}

export function dayFromDate(dateStr: string): string {
  const apiDate = dateStr.includes('-') ? dateStr : toApiDate(dateStr);
  if (!apiDate) return '';
  const m = apiDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const [, year, month, day] = m;
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  return DAYS[date.getDay()] ?? '';
}
