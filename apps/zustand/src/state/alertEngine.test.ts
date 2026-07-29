import { describe, expect, it, vi } from 'vitest';
import type { Alert } from '@smc/domain';
import { createAppStore } from './store';
import { attachAlertEngine, buildAlertContext } from './alertEngine';

const NOW = Date.UTC(2026, 6, 29);

function store() {
  return createAppStore({ seed: 11, tradeCount: 60, now: NOW });
}

describe('buildAlertContext', () => {
  it('sorts recent closed trades newest first', () => {
    const context = buildAlertContext(store().getState(), NOW);
    const closes = context.recentClosedTrades.map((t) => t.closedAt);
    expect(closes).toEqual([...closes].sort((a, b) => b - a));
  });

  it('derives holding time for every open position', () => {
    const state = store().getState();
    const context = buildAlertContext(state, NOW);
    expect(context.openPositions).toHaveLength(state.positions.length);
    expect(context.openPositions.every((p) => p.holdingMs > 0)).toBe(true);
  });
});

describe('attachAlertEngine', () => {
  it('fires the risk-per-trade alert seeded into the fixture', () => {
    const s = store();
    const onFire = vi.fn<(alert: Alert) => void>();
    const detach = attachAlertEngine(s, { now: () => NOW, onFire });

    s.getState().applyQuote({ instrumentId: 'BTC-USDT', price: 61000, ts: NOW, seq: 1 });

    expect(onFire.mock.calls.map(([alert]) => alert.kind)).toContain('risk-per-trade');
    detach();
  });

  it('fires each alert once, not once per quote', () => {
    const s = store();
    const onFire = vi.fn<(alert: Alert) => void>();
    const detach = attachAlertEngine(s, { now: () => NOW, onFire });

    for (let seq = 1; seq <= 50; seq += 1) {
      s.getState().applyQuote({ instrumentId: 'BTC-USDT', price: 61000 + seq, ts: NOW, seq });
    }

    const riskCalls = onFire.mock.calls.filter(([alert]) => alert.kind === 'risk-per-trade');
    expect(riskCalls).toHaveLength(1);
    detach();
  });

  it('publishes the current alerts onto the store', () => {
    const s = store();
    const detach = attachAlertEngine(s, { now: () => NOW, onFire: () => {} });
    s.getState().applyQuote({ instrumentId: 'BTC-USDT', price: 61000, ts: NOW, seq: 1 });
    expect(s.getState().alerts.length).toBeGreaterThan(0);
    detach();
  });

  it('re-fires after the condition clears and returns', () => {
    const s = store();
    const onFire = vi.fn<(alert: Alert) => void>();
    const detach = attachAlertEngine(s, { now: () => NOW, onFire });
    const breaching = s.getState().positions.find((p) => p.riskAmount > 100)!;

    s.getState().applyQuote({ instrumentId: 'BTC-USDT', price: 61000, ts: NOW, seq: 1 });
    const afterFirst = onFire.mock.calls.filter(([a]) => a.kind === 'risk-per-trade').length;

    // Clear the condition, then restore it.
    s.setState({
      positions: s.getState().positions.map((p) =>
        (p.id === breaching.id ? { ...p, riskAmount: 10 } : p)),
    });
    s.setState({
      positions: s.getState().positions.map((p) =>
        (p.id === breaching.id ? { ...p, riskAmount: 150 } : p)),
    });

    const afterCycle = onFire.mock.calls.filter(([a]) => a.kind === 'risk-per-trade').length;
    expect(afterFirst).toBe(1);
    expect(afterCycle).toBe(2);
    detach();
  });

  it('stops evaluating once detached', () => {
    const s = store();
    const onFire = vi.fn<(alert: Alert) => void>();
    const detach = attachAlertEngine(s, { now: () => NOW, onFire });
    detach();
    onFire.mockClear();
    s.getState().applyQuote({ instrumentId: 'BTC-USDT', price: 61000, ts: NOW, seq: 1 });
    expect(onFire).not.toHaveBeenCalled();
  });
});
