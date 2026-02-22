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

export function dayFromDate(dateStr: string): string {
  const apiDate = dateStr.includes('-') ? dateStr : toApiDate(dateStr);
  if (!apiDate) return '';
  const m = apiDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const [, year, month, day] = m;
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  return DAYS[date.getDay()] ?? '';
}
