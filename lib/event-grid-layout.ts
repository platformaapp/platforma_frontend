/** Shared card sizes for /events and mentor event/article sections. */
export const EVENT_GRID = {
  featuredColumns: '649fr 84fr 716fr',
  tripleColumns: '403fr 75fr 365fr 266fr 340fr',
  pairBColumns: '481fr 165fr 611fr 193fr',
  // Move the empty final column into the gap, keeping both card widths.
  pairBAlignedColumns: '481fr 358fr 611fr',
  secondCardWidth: '72.8%' as const,
  secondCardHeight: 248,
};
export const EVENT_FEATURED_ASPECTS: [number, number] = [649 / 360, 521 / 294];
export const EVENT_TRIPLE_ASPECTS: [number, number, number] = [403 / 285, 365 / 211, 340 / 232];
