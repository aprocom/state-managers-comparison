import { describe, expect, it } from 'vitest';
import { createFeed } from './feed';
import type { Instrument, Quote } from './types';

const instruments: Instrument[] = [
  { id: 'BTC-USDT', base: 'BTC', quote: 'USDT', pricePrecision: 1 },
  { id: 'ETH-USDT', base: 'ETH', quote: 'USDT', pricePrecision: 2 },
];
const startPrices = { 'BTC-USDT': 60000, 'ETH-USDT': 3000 };

function collect(seed: number, count: number): Quote[] {
  const feed = createFeed({ instruments, seed, updatesPerSecond: 10, startPrices });
  const received: Quote[] = [];
  feed.subscribe((quote) => received.push(quote));
  feed.tick(count, 1_000);
  return received;
}

describe('createFeed', () => {
  it('emits exactly the requested number of quotes', () => {
    expect(collect(1, 10)).toHaveLength(10);
  });

  it('replays identically for the same seed', () => {
    expect(collect(99, 20)).toEqual(collect(99, 20));
  });

  it('diverges for a different seed', () => {
    expect(collect(1, 20)).not.toEqual(collect(2, 20));
  });

  it('round-robins across instruments', () => {
    const received = collect(5, 4);
    expect(received.map((q) => q.instrumentId)).toEqual([
      'BTC-USDT', 'ETH-USDT', 'BTC-USDT', 'ETH-USDT',
    ]);
  });

  it('increments seq per instrument', () => {
    const received = collect(5, 4);
    expect(received.filter((q) => q.instrumentId === 'BTC-USDT').map((q) => q.seq)).toEqual([1, 2]);
  });

  it('keeps prices positive across a long run', () => {
    const received = collect(3, 5000);
    expect(received.every((q) => q.price > 0)).toBe(true);
  });

  it('stops delivering to an unsubscribed listener', () => {
    const feed = createFeed({ instruments, seed: 1, updatesPerSecond: 10, startPrices });
    const received: Quote[] = [];
    const unsubscribe = feed.subscribe((quote) => received.push(quote));
    feed.tick(2, 1_000);
    unsubscribe();
    feed.tick(2, 2_000);
    expect(received).toHaveLength(2);
  });
});

describe('createFeed — rate accuracy', () => {
  it('delivers the configured rate for values below the batch frequency', async () => {
    const feed = createFeed({ instruments, seed: 1, updatesPerSecond: 10, startPrices });
    let received = 0;
    feed.subscribe(() => { received += 1; });
    feed.start();
    await new Promise((resolve) => { setTimeout(resolve, 1000); });
    feed.stop();
    // 10/s over ~1s, allowing for timer jitter. Before the fractional carry
    // this returned ~20 because each batch was rounded up to one quote.
    expect(received).toBeGreaterThanOrEqual(7);
    expect(received).toBeLessThanOrEqual(13);
  });
});
