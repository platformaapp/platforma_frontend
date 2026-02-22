export type Slot = {
  id: string;
  date: string;
  day?: string;
  time: string;
};

const DAYS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

function dayFromDate(dateStr: string): string {
  const m = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return '';
  const [, d, month, year] = m;
  const y = year.length === 2 ? 2000 + parseInt(year, 10) : parseInt(year, 10);
  const date = new Date(y, parseInt(month, 10) - 1, parseInt(d, 10));
  return DAYS[date.getDay()] ?? '';
}

let slots: Slot[] = [
  { id: '1', date: '20.07.25', day: 'ВС', time: '20:00' },
  { id: '2', date: '21.07.25', day: 'ПН', time: '20:00' },
  { id: '3', date: '22.07.25', day: 'ВТ', time: '20:00' },
  { id: '4', date: '23.07.25', day: 'СР', time: '18:00' },
  { id: '5', date: '23.07.25', day: 'СР', time: '20:00' },
  { id: '6', date: '24.07.25', day: 'ЧТ', time: '20:00' },
];

let nextId = 7;

export function getSlots(): Slot[] {
  return [...slots];
}

export function setSlots(s: Slot[]) {
  slots = s;
}

export function addSlot(date: string, time: string): Slot {
  const day = dayFromDate(date);
  const id = String(nextId++);
  const slot: Slot = { id, date, day, time };
  slots = [...slots, slot];
  return slot;
}

export function addSlots(items: { date: string; time: string }[]): void {
  items.forEach(({ date, time }) => {
    if (date.trim() && time.trim()) {
      addSlot(date.trim(), time.trim());
    }
  });
}

export function removeSlot(id: string): void {
  slots = slots.filter((s) => s.id !== id);
}

export function removeSlots(ids: string[]): void {
  const set = new Set(ids);
  slots = slots.filter((s) => !set.has(s.id));
}
