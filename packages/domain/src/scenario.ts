import { createFeed } from './feed';
import { INSTRUMENTS, START_PRICES } from './instruments';
import type { Feed } from './feed';

/**
 * The experiment's facts, in one place.
 *
 * These are not implementation details of any state manager — they define the
 * scenario all five implementations are measured on. They used to be declared
 * once per app, which made five drift surfaces, and the cross-app parity gate
 * does not close all of them. A worked example: the seeded positions carry risk
 * amounts of 23.7, 25.38, 35.99, 49.89, 72.18 and 150, so any per-trade limit
 * between 72.18 and 150 produces an identical alert key set. One app could have
 * used 149 instead of 100 and every gate in this repository would have passed.
 * One source of truth removes the question rather than arguing about how likely
 * it was.
 */
export const NOW = Date.UTC(2026, 6, 29);
export const SEED = 20260729;
export const TRADE_COUNT = 250;

export const DAILY_LOSS_LIMIT = 400;
export const RISK_LIMIT_PER_TRADE = 100;

/** The live quote stream's seed. Separate from `SEED` only because they are
 *  separate facts; they happen to share a value. */
export const FEED_SEED = 20260729;

/**
 * The one live feed every implementation subscribes to. It was previously
 * constructed inline in each of the five terminal screens with the seed spelled
 * out by hand — and unlike the constants above, a divergence here is invisible
 * to the cross-app gate, which deliberately compares nothing downstream of the
 * live stream. That made it the only genuinely ungated way for the five apps to
 * stop being the same experiment.
 */
export function createAppFeed(updatesPerSecond: number): Feed {
  return createFeed({
    instruments: INSTRUMENTS,
    seed: FEED_SEED,
    updatesPerSecond,
    startPrices: START_PRICES,
  });
}
