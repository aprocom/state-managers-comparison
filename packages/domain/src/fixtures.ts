import { INSTRUMENTS, START_PRICES } from './instruments';
import { mulberry32 } from './random';
import type { Side, Trade } from './types';

export const STRATEGIES = ['breakout', 'mean-reversion', 'trend', 'scalp', 'news'];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deterministic closed-trade history ending at `endTs`, spread over the
 * preceding 120 days. Roughly 60% winners, matching the landing page's
 * stated win rate closely enough to look real without being tuned to it.
 */
export function createTradeHistory(seed: number, count: number, endTs: number): Trade[] {
  const nextRandom = mulberry32(seed);
  const trades: Trade[] = [];

  for (let index = 0; index < count; index += 1) {
    const instrument = INSTRUMENTS[Math.floor(nextRandom() * INSTRUMENTS.length)];
    if (instrument === undefined) throw new Error('INSTRUMENTS must not be empty');

    const entryPrice = (START_PRICES[instrument.id] ?? 100) * (0.8 + nextRandom() * 0.4);
    const side: Side = nextRandom() < 0.6 ? 'long' : 'short';
    const isWinner = nextRandom() < 0.6;

    // Winners run further than losers — that is what makes profit factor > 1.
    const movePercent = isWinner ? 0.01 + nextRandom() * 0.05 : -(0.005 + nextRandom() * 0.025);
    const signedMove = side === 'long' ? movePercent : -movePercent;
    const exitPrice = entryPrice * (1 + signedMove);

    const closedAt = endTs - Math.floor(nextRandom() * 120 * DAY_MS);
    const holdingMs = Math.floor((5 + nextRandom() * 600) * 60 * 1000);
    const size = Number(((100 + nextRandom() * 900) / entryPrice).toFixed(6));

    trades.push({
      id: `trade-${index}`,
      instrumentId: instrument.id,
      side,
      size,
      entryPrice: Number(entryPrice.toFixed(instrument.pricePrecision)),
      exitPrice: Number(exitPrice.toFixed(instrument.pricePrecision)),
      openedAt: closedAt - holdingMs,
      closedAt,
      riskAmount: Number((10 + nextRandom() * 90).toFixed(2)),
      strategy: STRATEGIES[Math.floor(nextRandom() * STRATEGIES.length)] ?? 'breakout',
      note: '',
    });
  }

  return trades.sort((a, b) => a.closedAt - b.closedAt);
}
