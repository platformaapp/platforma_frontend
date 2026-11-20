/** A sliding window of at most five page numbers, including the active page. */
export function paginationPages(page: number, totalPages: number): number[] {
  const count = Math.min(5, Math.max(0, totalPages));
  const start = Math.max(1, Math.min(page - 2, totalPages - count + 1));
  return Array.from({ length: count }, (_, i) => start + i);
}
