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
  // eslint-disable-next-line no-var
  var __SMC_QUOTES__: number | undefined;
}

export function countQuotes(delivered: number): void {
  globalThis.__SMC_QUOTES__ = (globalThis.__SMC_QUOTES__ ?? 0) + delivered;
}

export function readQuoteCount(): number {
  return globalThis.__SMC_QUOTES__ ?? 0;
}

export function resetQuoteCount(): void {
  globalThis.__SMC_QUOTES__ = 0;
}
