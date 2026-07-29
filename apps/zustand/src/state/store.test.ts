import { beforeEach, describe, expect, it } from 'vitest';
import type { Quote } from '@smc/domain';
import { createAppStore } from './store';

function quote(overrides: Partial<Quote> = {}): Quote {
  return { instrumentId: 'BTC-USDT', price: 61000, ts: 1000, seq: 1, ...overrides };
}

describe('app store — quotes', () => {
  let store: ReturnType<typeof createAppStore>;

  beforeEach(() => {
    store = createAppStore({ seed: 1, tradeCount: 20, now: 1_800_000_000_000 });
  });

  it('stores the latest price', () => {
    store.getState().applyQuote(quote({ price: 61000 }));
    expect(store.getState().prices['BTC-USDT']).toBe(61000);
  });

  it('records the direction of the change', () => {
    store.getState().applyQuote(quote({ price: 60000, seq: 1 }));
    store.getState().applyQuote(quote({ price: 61000, seq: 2 }));
    expect(store.getState().priceDirections['BTC-USDT']).toBe('up');
    store.getState().applyQuote(quote({ price: 60500, seq: 3 }));
    expect(store.getState().priceDirections['BTC-USDT']).toBe('down');
  });

  it('drops a stale quote', () => {
    store.getState().applyQuote(quote({ price: 61000, seq: 5 }));
    store.getState().applyQuote(quote({ price: 1, seq: 4 }));
    expect(store.getState().prices['BTC-USDT']).toBe(61000);
  });

  it('leaves unrelated instruments untouched', () => {
    store.getState().applyQuote(quote({ instrumentId: 'ETH-USDT', price: 3100 }));
    const before = store.getState().prices;
    store.getState().applyQuote(quote({ instrumentId: 'BTC-USDT', price: 61000, seq: 1 }));
    expect(store.getState().prices['ETH-USDT']).toBe(before['ETH-USDT']);
  });

  it('opens with seeded positions and trades', () => {
    expect(store.getState().positions.length).toBeGreaterThan(0);
    expect(store.getState().trades).toHaveLength(20);
  });
});
