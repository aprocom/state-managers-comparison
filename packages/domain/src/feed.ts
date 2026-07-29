import { mulberry32 } from './random';
import type { Instrument, InstrumentId, Quote } from './types';

export interface FeedOptions {
  instruments: Instrument[];
  seed: number;
  updatesPerSecond: number;
  startPrices: Record<InstrumentId, number>;
}

export interface Feed {
  subscribe(listener: (quote: Quote) => void): () => void;
  start(): void;
  stop(): void;
  /** Advance deterministically without timers. Used by tests and benchmarks. */
  tick(count: number, now: number): void;
}

const BATCHES_PER_SECOND = 20;

export function createFeed(options: FeedOptions): Feed {
  const nextRandom = mulberry32(options.seed);
  const prices = new Map<InstrumentId, number>();
  const sequences = new Map<InstrumentId, number>();

  for (const instrument of options.instruments) {
    prices.set(instrument.id, options.startPrices[instrument.id] ?? 1);
    sequences.set(instrument.id, 0);
  }

  const listeners = new Set<(quote: Quote) => void>();
  let cursor = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  function nextQuote(now: number): Quote {
    const instrument = options.instruments[cursor % options.instruments.length];
    cursor += 1;
    if (instrument === undefined) {
      throw new Error('createFeed requires at least one instrument');
    }

    const previous = prices.get(instrument.id) ?? 1;
    // ±0.1% geometric step keeps the walk positive and visually plausible.
    const price = Math.max(previous * (1 + (nextRandom() - 0.5) * 0.002), 1e-8);
    prices.set(instrument.id, price);

    const seq = (sequences.get(instrument.id) ?? 0) + 1;
    sequences.set(instrument.id, seq);

    return { instrumentId: instrument.id, price, ts: now, seq };
  }

  function emit(count: number, now: number): void {
    for (let n = 0; n < count; n += 1) {
      const quote = nextQuote(now);
      for (const listener of listeners) {
        listener(quote);
      }
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (timer !== null) return;
      // Carry the fractional remainder instead of rounding up to one quote per
      // batch. Rounding made every rate below 20/s actually deliver 20/s, which
      // silently doubled any per-quote benchmark metric.
      const perBatch = options.updatesPerSecond / BATCHES_PER_SECOND;
      let carry = 0;
      timer = setInterval(() => {
        carry += perBatch;
        const count = Math.floor(carry);
        carry -= count;
        if (count > 0) emit(count, Date.now());
      }, 1000 / BATCHES_PER_SECOND);
    },
    stop() {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    },
    tick(count, now) {
      emit(count, now);
    },
  };
}
