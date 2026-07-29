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
