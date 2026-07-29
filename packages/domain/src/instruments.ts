import type { Instrument, InstrumentId } from './types';

const BASES = [
  'BTC', 'ETH', 'SOL', 'TON', 'DOGE', 'XRP', 'ADA', 'AVAX', 'LINK', 'DOT',
  'MATIC', 'ATOM', 'LTC', 'BCH', 'NEAR', 'APT', 'ARB', 'OP', 'INJ', 'SUI',
  'FIL', 'ICP', 'HBAR', 'VET', 'ALGO', 'AAVE', 'UNI', 'MKR', 'SAND', 'MANA',
  'AXS', 'GRT', 'FTM', 'RUNE', 'EGLD', 'THETA', 'XLM', 'EOS', 'CHZ', 'ENJ',
  'CRV', 'COMP', 'SNX', 'ZEC', 'DASH', 'KSM', 'GALA', 'LDO', 'PEPE', 'WIF',
];

const SEED_PRICES: Record<string, number> = {
  BTC: 60000, ETH: 3000, SOL: 150, TON: 6, DOGE: 0.15,
};

export const INSTRUMENTS: Instrument[] = BASES.map((base) => ({
  id: `${base}-USDT`,
  base,
  quote: 'USDT',
  pricePrecision: (SEED_PRICES[base] ?? 10) < 1 ? 5 : 2,
}));

export const START_PRICES: Record<InstrumentId, number> = Object.fromEntries(
  BASES.map((base, index) => [
    `${base}-USDT`,
    // Deterministic spread of plausible prices for bases without a seed price.
    SEED_PRICES[base] ?? Number((1 + ((index * 37) % 400) / 3).toFixed(2)),
  ]),
);
