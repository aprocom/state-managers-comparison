/**
 * Counts quotes the feed has actually delivered.
 *
 * The benchmark used to divide row renders by `configuredRate * elapsedSeconds`
 * — a denominator nothing ever verified. Any timer drift, throttled tab or GC
 * pause made the nominal denominator too large and the shortfall was attributed
 * to whichever implementation happened to be running. One sample already showed
 * 1.008 renders per quote, a value the metric's own ceiling proves impossible.
 * Counting the numerator and the denominator in the same place removes the
 * assumption.
 */
declare global {
  var __SMC_QUOTES__: number | undefined;
  var __SMC_QUOTES_BY_INSTRUMENT__: Record<string, number> | undefined;
}

/**
 * Per-instrument as well as total. The position-render metric divides by "the
 * quotes that could have moved a position row", and the first version of the
 * harness computed that as `total * 6/50` — an assumed denominator, in the same
 * benchmark whose README criticises assumed denominators. It visibly broke: a
 * soak that delivered 505 quotes reported 1.07 position renders per quote,
 * above the optimum of 1.00, purely because 505 is not a multiple of 50.
 */
export function countQuote(instrumentId: string): void {
  globalThis.__SMC_QUOTES__ = (globalThis.__SMC_QUOTES__ ?? 0) + 1;
  const byInstrument = globalThis.__SMC_QUOTES_BY_INSTRUMENT__ ?? {};
  byInstrument[instrumentId] = (byInstrument[instrumentId] ?? 0) + 1;
  globalThis.__SMC_QUOTES_BY_INSTRUMENT__ = byInstrument;
}

export function readQuoteCount(): number {
  return globalThis.__SMC_QUOTES__ ?? 0;
}

export function readQuoteCountFor(instrumentIds: readonly string[]): number {
  const byInstrument = globalThis.__SMC_QUOTES_BY_INSTRUMENT__ ?? {};
  return instrumentIds.reduce((sum, id) => sum + (byInstrument[id] ?? 0), 0);
}

export function resetQuoteCount(): void {
  globalThis.__SMC_QUOTES__ = 0;
  globalThis.__SMC_QUOTES_BY_INSTRUMENT__ = {};
}
