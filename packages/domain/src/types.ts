export type InstrumentId = string;

export interface Instrument {
  id: InstrumentId;
  base: string;
  quote: string;
  pricePrecision: number;
}

export type Side = 'long' | 'short';

export interface Quote {
  instrumentId: InstrumentId;
  price: number;
  /** Epoch milliseconds. */
  ts: number;
  /** Monotonic per instrument, starting at 1. Lets consumers drop stale quotes. */
  seq: number;
}

export interface Position {
  id: string;
  instrumentId: InstrumentId;
  side: Side;
  size: number;
  entryPrice: number;
  openedAt: number;
  /** Planned loss at stop, in quote currency. Always positive. */
  riskAmount: number;
}

export interface Trade {
  id: string;
  instrumentId: InstrumentId;
  side: Side;
  size: number;
  entryPrice: number;
  exitPrice: number;
  openedAt: number;
  closedAt: number;
  /** Planned loss at stop, in quote currency. Always positive. */
  riskAmount: number;
  strategy: string;
  note: string;
}

export type PriceDirection = 'up' | 'down' | 'flat';

/**
 * The one definition of what a price move looks like.
 *
 * Zustand and Redux set 'flat' on an equal-price quote; MobX, RxJS and Jotai
 * returned early and left the previous direction in place. Unreachable with a
 * geometric random walk that never repeats a price exactly, and guaranteed on
 * any real feed with a tick size — at which point two implementations would
 * render a different CSS class from the other three and no test would notice.
 */
export function nextDirection(previous: number, next: number): PriceDirection {
  if (next === previous) return 'flat';
  return next > previous ? 'up' : 'down';
}
