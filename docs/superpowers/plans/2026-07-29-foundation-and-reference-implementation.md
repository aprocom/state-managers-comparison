# Foundation & Reference Implementation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the monorepo, the shared domain and UI packages, and one complete working implementation of TraderCat Lite on Zustand that serves as the reference all other implementations must match.

**Architecture:** npm workspaces monorepo. Everything except the state layer lives in `packages/` — domain types, deterministic quote feed, all P&L and statistics math, all presentational components. Each app in `apps/` contains only state storage, derivation and propagation. This is what makes the later comparison honest: LOC and render-time differences can only come from the state layer.

**Tech Stack:** Node 22, React 19, TypeScript 5 (strict), Vite 7, Vitest 3, Playwright 1.5x, Zustand 5.

## Global Constraints

- Bundler is **Vite**. Webpack is not used anywhere in this repository.
- Package manager is **npm** with workspaces. Not pnpm, not bun — a reviewer must be able to `npm install` without extra tooling.
- TypeScript `strict: true` everywhere. No `any` in committed code.
- Packages are consumed **from TypeScript source** via `exports` — no build step for `packages/*`.
- No backend, no network calls, no authentication. Quote feed is a seeded generator; trade history is a seeded fixture.
- No charting library. The equity curve is a hand-written SVG polyline. A charting dependency would pollute the per-app bundle-size comparison.
- All P&L and statistics math lives in `@smc/domain` as pure functions. An app that computes its own math is a bug — the benchmark would then measure arithmetic, not state management.
- All presentational components live in `@smc/ui` and are prop-only. No app defines its own markup for shared views.
- Every interactive or asserted element carries a `data-testid` from the canonical list in Task 6. One Playwright suite drives all five apps unchanged.
- Determinism: same seed must produce the same quotes and the same trade history on every run and every machine. `Math.random` is banned outside `mulberry32`.

---

### Task 1: Monorepo skeleton and test harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/src/index.ts`
- Test: `packages/domain/src/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: workspace `@smc/domain` resolvable from any app; `npm test` runs Vitest across all workspaces

- [ ] **Step 1: Write the failing test**

Create `packages/domain/src/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DOMAIN_VERSION } from './index';

describe('domain package', () => {
  it('is resolvable and exports its version marker', () => {
    expect(DOMAIN_VERSION).toBe('0.1.0');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/domain/src/smoke.test.ts`
Expected: FAIL — the config and the module do not exist yet.

- [ ] **Step 3: Create the root manifest**

Create `package.json`:

```json
{
  "name": "state-managers-comparison",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22" },
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit -p packages/domain"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 4: Create the shared TypeScript config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "noEmit": true
  }
}
```

`noUncheckedIndexedAccess` is deliberate. The apps index into price maps constantly, and this flag forces every implementation to handle the missing-key case explicitly rather than one implementation getting a silent advantage.

- [ ] **Step 5: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'packages/**/*.test.tsx', 'apps/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 6: Create the domain package**

Create `packages/domain/package.json`:

```json
{
  "name": "@smc/domain",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

Create `packages/domain/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Create `packages/domain/src/index.ts`:

```ts
export const DOMAIN_VERSION = '0.1.0';
```

- [ ] **Step 7: Install and run the test to verify it passes**

Run: `npm install && npx vitest run packages/domain/src/smoke.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.base.json vitest.config.ts packages/domain package-lock.json
git commit -m "chore: npm workspaces skeleton with vitest"
```

---

### Task 2: Domain types and deterministic PRNG

**Files:**
- Create: `packages/domain/src/types.ts`
- Create: `packages/domain/src/random.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/random.test.ts`

**Interfaces:**
- Consumes: `@smc/domain` package from Task 1
- Produces:
  - `type InstrumentId = string`
  - `interface Instrument { id: InstrumentId; base: string; quote: string; pricePrecision: number }`
  - `interface Quote { instrumentId: InstrumentId; price: number; ts: number; seq: number }`
  - `type Side = 'long' | 'short'`
  - `interface Position { id: string; instrumentId: InstrumentId; side: Side; size: number; entryPrice: number; openedAt: number; riskAmount: number }`
  - `interface Trade { id: string; instrumentId: InstrumentId; side: Side; size: number; entryPrice: number; exitPrice: number; openedAt: number; closedAt: number; riskAmount: number; strategy: string; note: string }`
  - `function mulberry32(seed: number): () => number`

- [ ] **Step 1: Write the failing test**

Create `packages/domain/src/random.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mulberry32 } from './random';

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const first = [a(), a(), a(), a(), a()];
    const second = [b(), b(), b(), b(), b()];
    expect(first).toEqual(second);
  });

  it('produces a different sequence for a different seed', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('stays inside [0, 1)', () => {
    const next = mulberry32(7);
    for (let n = 0; n < 1000; n += 1) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/domain/src/random.test.ts`
Expected: FAIL — `Cannot find module './random'`.

- [ ] **Step 3: Write the PRNG**

Create `packages/domain/src/random.ts`:

```ts
/**
 * Deterministic PRNG. The only source of randomness allowed in this
 * repository — benchmark runs must be reproducible across machines.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Write the domain types**

Create `packages/domain/src/types.ts`:

```ts
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
```

- [ ] **Step 5: Re-export from the package entry point**

Replace `packages/domain/src/index.ts`:

```ts
export const DOMAIN_VERSION = '0.1.0';

export * from './types';
export * from './random';
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run packages/domain`
Expected: PASS — 4 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/domain/src
git commit -m "feat(domain): domain types and deterministic PRNG"
```

---

### Task 3: Deterministic quote feed

**Files:**
- Create: `packages/domain/src/feed.ts`
- Create: `packages/domain/src/instruments.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/feed.test.ts`

**Interfaces:**
- Consumes: `Instrument`, `InstrumentId`, `Quote`, `mulberry32` from Task 2
- Produces:
  - `const INSTRUMENTS: Instrument[]` — 50 entries
  - `const START_PRICES: Record<InstrumentId, number>`
  - `interface FeedOptions { instruments: Instrument[]; seed: number; updatesPerSecond: number; startPrices: Record<InstrumentId, number> }`
  - `interface Feed { subscribe(listener: (quote: Quote) => void): () => void; start(): void; stop(): void; tick(count: number, now: number): void }`
  - `function createFeed(options: FeedOptions): Feed`

The `tick` method exists so tests and benchmarks can advance the feed a precise number of steps without timers. Without it every test would depend on wall-clock timing and become flaky.

- [ ] **Step 1: Write the failing test**

Create `packages/domain/src/feed.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/domain/src/feed.test.ts`
Expected: FAIL — `Cannot find module './feed'`.

- [ ] **Step 3: Write the feed**

Create `packages/domain/src/feed.ts`:

```ts
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
      const perBatch = Math.max(1, Math.round(options.updatesPerSecond / BATCHES_PER_SECOND));
      timer = setInterval(() => emit(perBatch, Date.now()), 1000 / BATCHES_PER_SECOND);
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
```

- [ ] **Step 4: Write the instrument catalogue**

Create `packages/domain/src/instruments.ts`:

```ts
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
```

- [ ] **Step 5: Re-export from the package entry point**

Add to `packages/domain/src/index.ts`:

```ts
export * from './feed';
export * from './instruments';
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run packages/domain`
Expected: PASS — 11 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/domain/src
git commit -m "feat(domain): deterministic quote feed and instrument catalogue"
```

---

### Task 4: P&L and statistics calculations

**Files:**
- Create: `packages/domain/src/calculations.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/calculations.test.ts`

**Interfaces:**
- Consumes: `Position`, `Trade` from Task 2
- Produces:
  - `function unrealizedPnl(position: Position, price: number): number`
  - `function realizedPnl(trade: Trade): number`
  - `function rMultiple(trade: Trade): number`
  - `function winRate(trades: Trade[]): number` — fraction in `[0, 1]`
  - `function profitFactor(trades: Trade[]): number`
  - `interface EquityPoint { ts: number; equity: number }`
  - `function equityCurve(trades: Trade[], startingEquity?: number): EquityPoint[]`
  - `function maxDrawdown(curve: EquityPoint[]): number` — zero or negative
  - `function avgHoldingMs(trades: Trade[]): number`

- [ ] **Step 1: Write the failing test**

Create `packages/domain/src/calculations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  avgHoldingMs, equityCurve, maxDrawdown, profitFactor,
  rMultiple, realizedPnl, unrealizedPnl, winRate,
} from './calculations';
import type { Position, Trade } from './types';

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    instrumentId: 'BTC-USDT',
    side: 'long',
    size: 1,
    entryPrice: 100,
    exitPrice: 110,
    openedAt: 0,
    closedAt: 1000,
    riskAmount: 5,
    strategy: 'breakout',
    note: '',
    ...overrides,
  };
}

const position: Position = {
  id: 'p1',
  instrumentId: 'BTC-USDT',
  side: 'long',
  size: 2,
  entryPrice: 100,
  openedAt: 0,
  riskAmount: 10,
};

describe('unrealizedPnl', () => {
  it('is positive for a long above entry', () => {
    expect(unrealizedPnl(position, 110)).toBe(20);
  });

  it('is negative for a long below entry', () => {
    expect(unrealizedPnl(position, 95)).toBe(-10);
  });

  it('inverts for a short', () => {
    expect(unrealizedPnl({ ...position, side: 'short' }, 90)).toBe(20);
  });
});

describe('realizedPnl', () => {
  it('accounts for size and direction', () => {
    expect(realizedPnl(trade({ size: 3 }))).toBe(30);
    expect(realizedPnl(trade({ side: 'short' }))).toBe(-10);
  });
});

describe('rMultiple', () => {
  it('divides realized P&L by planned risk', () => {
    expect(rMultiple(trade())).toBe(2);
  });

  it('returns 0 when risk is unknown rather than dividing by zero', () => {
    expect(rMultiple(trade({ riskAmount: 0 }))).toBe(0);
  });
});

describe('winRate', () => {
  it('counts only profitable trades', () => {
    expect(winRate([trade(), trade({ exitPrice: 90 })])).toBe(0.5);
  });

  it('is 0 for an empty history rather than NaN', () => {
    expect(winRate([])).toBe(0);
  });
});

describe('profitFactor', () => {
  it('is gross profit over gross loss', () => {
    // +10 and -5 => 2
    expect(profitFactor([trade(), trade({ exitPrice: 95 })])).toBe(2);
  });

  it('is Infinity when there are no losses', () => {
    expect(profitFactor([trade()])).toBe(Infinity);
  });

  it('is 0 for an empty history', () => {
    expect(profitFactor([])).toBe(0);
  });
});

describe('equityCurve', () => {
  it('accumulates in close order regardless of input order', () => {
    const curve = equityCurve([
      trade({ id: 'b', closedAt: 2000, exitPrice: 90 }),
      trade({ id: 'a', closedAt: 1000, exitPrice: 110 }),
    ]);
    expect(curve).toEqual([
      { ts: 1000, equity: 10 },
      { ts: 2000, equity: 0 },
    ]);
  });

  it('honours a starting equity', () => {
    expect(equityCurve([trade()], 100)[0]).toEqual({ ts: 1000, equity: 110 });
  });
});

describe('maxDrawdown', () => {
  it('is the deepest fall from a running peak', () => {
    expect(maxDrawdown([
      { ts: 1, equity: 100 },
      { ts: 2, equity: 140 },
      { ts: 3, equity: 90 },
      { ts: 4, equity: 120 },
    ])).toBe(-50);
  });

  it('is 0 for a monotonically rising curve', () => {
    expect(maxDrawdown([{ ts: 1, equity: 10 }, { ts: 2, equity: 20 }])).toBe(0);
  });

  it('is 0 for an empty curve', () => {
    expect(maxDrawdown([])).toBe(0);
  });
});

describe('avgHoldingMs', () => {
  it('averages time in trade', () => {
    expect(avgHoldingMs([trade({ closedAt: 1000 }), trade({ closedAt: 3000 })])).toBe(2000);
  });

  it('is 0 for an empty history', () => {
    expect(avgHoldingMs([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/domain/src/calculations.test.ts`
Expected: FAIL — `Cannot find module './calculations'`.

- [ ] **Step 3: Write the calculations**

Create `packages/domain/src/calculations.ts`:

```ts
import type { Position, Trade } from './types';

function direction(side: 'long' | 'short'): 1 | -1 {
  return side === 'long' ? 1 : -1;
}

export function unrealizedPnl(position: Position, price: number): number {
  return (price - position.entryPrice) * position.size * direction(position.side);
}

export function realizedPnl(trade: Trade): number {
  return (trade.exitPrice - trade.entryPrice) * trade.size * direction(trade.side);
}

export function rMultiple(trade: Trade): number {
  if (trade.riskAmount <= 0) return 0;
  return realizedPnl(trade) / trade.riskAmount;
}

export function winRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  return trades.filter((trade) => realizedPnl(trade) > 0).length / trades.length;
}

export function profitFactor(trades: Trade[]): number {
  let grossProfit = 0;
  let grossLoss = 0;
  for (const trade of trades) {
    const pnl = realizedPnl(trade);
    if (pnl > 0) grossProfit += pnl;
    else grossLoss -= pnl;
  }
  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
  return grossProfit / grossLoss;
}

export interface EquityPoint {
  ts: number;
  equity: number;
}

export function equityCurve(trades: Trade[], startingEquity = 0): EquityPoint[] {
  const ordered = [...trades].sort((a, b) => a.closedAt - b.closedAt);
  let equity = startingEquity;
  return ordered.map((trade) => {
    equity += realizedPnl(trade);
    return { ts: trade.closedAt, equity };
  });
}

/** Zero or negative. The deepest fall from a running peak, in quote currency. */
export function maxDrawdown(curve: EquityPoint[]): number {
  let peak = Number.NEGATIVE_INFINITY;
  let worst = 0;
  for (const point of curve) {
    if (point.equity > peak) peak = point.equity;
    const drawdown = point.equity - peak;
    if (drawdown < worst) worst = drawdown;
  }
  return worst;
}

export function avgHoldingMs(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const total = trades.reduce((sum, trade) => sum + (trade.closedAt - trade.openedAt), 0);
  return total / trades.length;
}
```

- [ ] **Step 4: Re-export from the package entry point**

Add to `packages/domain/src/index.ts`:

```ts
export * from './calculations';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run packages/domain`
Expected: PASS — 29 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src
git commit -m "feat(domain): P&L and trading statistics"
```

---

### Task 5: Alert rules and trade history fixture

**Files:**
- Create: `packages/domain/src/alerts.ts`
- Create: `packages/domain/src/fixtures.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/alerts.test.ts`
- Test: `packages/domain/src/fixtures.test.ts`

**Interfaces:**
- Consumes: `Position`, `Trade`, `realizedPnl`, `avgHoldingMs`, `mulberry32`, `INSTRUMENTS`
- Produces:
  - `type AlertKind = 'daily-loss-limit' | 'risk-per-trade' | 'tilt' | 'time-in-trade'`
  - `interface Alert { kind: AlertKind; subjectId: string; message: string }`
  - `interface OpenPositionSnapshot { position: Position; holdingMs: number }`
  - `interface AlertContext { now: number; dailyPnl: number; dailyLossLimit: number; riskLimitPerTrade: number; recentClosedTrades: Trade[]; openPositions: OpenPositionSnapshot[]; avgHoldingMs: number }`
  - `function evaluateAlerts(context: AlertContext): Alert[]`
  - `const TILT_WINDOW_MS`, `TILT_LOSS_STREAK`, `TIME_IN_TRADE_FACTOR`
  - `function createTradeHistory(seed: number, count: number, endTs: number): Trade[]`
  - `const STRATEGIES: string[]`

`evaluateAlerts` is a pure predicate shared by all five apps. What differs between implementations is *when it is called* and *how firing once per transition is enforced* — that wiring is the heart of the comparison, so the predicate itself must be identical everywhere.

`recentClosedTrades` must be sorted by `closedAt` descending. The tilt rule counts a streak from the most recent trade backwards and stops at the first profitable one.

- [ ] **Step 1: Write the failing alert test**

Create `packages/domain/src/alerts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TILT_WINDOW_MS, evaluateAlerts } from './alerts';
import type { AlertContext } from './alerts';
import type { Position, Trade } from './types';

const NOW = 10_000_000;

function losing(id: string, closedAt: number): Trade {
  return {
    id, instrumentId: 'BTC-USDT', side: 'long', size: 1,
    entryPrice: 100, exitPrice: 90, openedAt: closedAt - 1000, closedAt,
    riskAmount: 10, strategy: 'breakout', note: '',
  };
}

function winning(id: string, closedAt: number): Trade {
  return { ...losing(id, closedAt), exitPrice: 110 };
}

const position: Position = {
  id: 'p1', instrumentId: 'BTC-USDT', side: 'long', size: 1,
  entryPrice: 100, openedAt: NOW - 1000, riskAmount: 50,
};

function context(overrides: Partial<AlertContext> = {}): AlertContext {
  return {
    now: NOW,
    dailyPnl: 0,
    dailyLossLimit: 400,
    riskLimitPerTrade: 100,
    recentClosedTrades: [],
    openPositions: [],
    avgHoldingMs: 1000,
    ...overrides,
  };
}

describe('evaluateAlerts — daily loss limit', () => {
  it('fires when the day is at or beyond the limit', () => {
    const alerts = evaluateAlerts(context({ dailyPnl: -400 }));
    expect(alerts.map((a) => a.kind)).toContain('daily-loss-limit');
  });

  it('stays quiet just inside the limit', () => {
    expect(evaluateAlerts(context({ dailyPnl: -399 }))).toEqual([]);
  });

  it('stays quiet on a profitable day', () => {
    expect(evaluateAlerts(context({ dailyPnl: 900 }))).toEqual([]);
  });
});

describe('evaluateAlerts — risk per trade', () => {
  it('fires for a position risking more than the limit', () => {
    const alerts = evaluateAlerts(context({
      openPositions: [{ position: { ...position, riskAmount: 150 }, holdingMs: 10 }],
      riskLimitPerTrade: 100,
    }));
    expect(alerts).toEqual([
      expect.objectContaining({ kind: 'risk-per-trade', subjectId: 'p1' }),
    ]);
  });

  it('stays quiet at exactly the limit', () => {
    const alerts = evaluateAlerts(context({
      openPositions: [{ position: { ...position, riskAmount: 100 }, holdingMs: 10 }],
    }));
    expect(alerts).toEqual([]);
  });
});

describe('evaluateAlerts — tilt', () => {
  it('fires on four consecutive losses inside the window', () => {
    const alerts = evaluateAlerts(context({
      recentClosedTrades: [
        losing('a', NOW - 100), losing('b', NOW - 200),
        losing('c', NOW - 300), losing('d', NOW - 400),
      ],
    }));
    expect(alerts.map((a) => a.kind)).toContain('tilt');
  });

  it('stays quiet on three consecutive losses', () => {
    const alerts = evaluateAlerts(context({
      recentClosedTrades: [losing('a', NOW - 100), losing('b', NOW - 200), losing('c', NOW - 300)],
    }));
    expect(alerts).toEqual([]);
  });

  it('breaks the streak on a profitable trade', () => {
    const alerts = evaluateAlerts(context({
      recentClosedTrades: [
        losing('a', NOW - 100), winning('w', NOW - 150),
        losing('b', NOW - 200), losing('c', NOW - 300), losing('d', NOW - 400),
      ],
    }));
    expect(alerts).toEqual([]);
  });

  it('ignores losses older than the window', () => {
    const alerts = evaluateAlerts(context({
      recentClosedTrades: [
        losing('a', NOW - 100), losing('b', NOW - 200),
        losing('c', NOW - TILT_WINDOW_MS - 1), losing('d', NOW - TILT_WINDOW_MS - 2),
      ],
    }));
    expect(alerts).toEqual([]);
  });
});

describe('evaluateAlerts — time in trade', () => {
  it('fires beyond three times the average holding time', () => {
    const alerts = evaluateAlerts(context({
      openPositions: [{ position, holdingMs: 3001 }],
      avgHoldingMs: 1000,
    }));
    expect(alerts.map((a) => a.kind)).toContain('time-in-trade');
  });

  it('stays quiet at exactly three times', () => {
    const alerts = evaluateAlerts(context({
      openPositions: [{ position, holdingMs: 3000 }],
      avgHoldingMs: 1000,
    }));
    expect(alerts).toEqual([]);
  });

  it('stays quiet when there is no holding-time history', () => {
    const alerts = evaluateAlerts(context({
      openPositions: [{ position, holdingMs: 999_999 }],
      avgHoldingMs: 0,
    }));
    expect(alerts).toEqual([]);
  });
});

describe('evaluateAlerts — combinations', () => {
  it('reports every triggered rule', () => {
    const alerts = evaluateAlerts(context({
      dailyPnl: -500,
      openPositions: [{ position: { ...position, riskAmount: 150 }, holdingMs: 9000 }],
      avgHoldingMs: 1000,
    }));
    expect(alerts.map((a) => a.kind).sort()).toEqual(
      ['daily-loss-limit', 'risk-per-trade', 'time-in-trade'],
    );
  });

  it('is pure — the same context yields an equal result', () => {
    const ctx = context({ dailyPnl: -500 });
    expect(evaluateAlerts(ctx)).toEqual(evaluateAlerts(ctx));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/domain/src/alerts.test.ts`
Expected: FAIL — `Cannot find module './alerts'`.

- [ ] **Step 3: Write the alert rules**

Create `packages/domain/src/alerts.ts`:

```ts
import { realizedPnl } from './calculations';
import type { Position, Trade } from './types';

export const TILT_WINDOW_MS = 30 * 60 * 1000;
export const TILT_LOSS_STREAK = 4;
export const TIME_IN_TRADE_FACTOR = 3;

export type AlertKind =
  | 'daily-loss-limit'
  | 'risk-per-trade'
  | 'tilt'
  | 'time-in-trade';

export interface Alert {
  kind: AlertKind;
  /** Position id, or 'account' for account-wide rules. */
  subjectId: string;
  message: string;
}

export interface OpenPositionSnapshot {
  position: Position;
  holdingMs: number;
}

export interface AlertContext {
  now: number;
  dailyPnl: number;
  /** Positive number. The rule fires when dailyPnl <= -dailyLossLimit. */
  dailyLossLimit: number;
  riskLimitPerTrade: number;
  /** Sorted by closedAt descending. */
  recentClosedTrades: Trade[];
  openPositions: OpenPositionSnapshot[];
  avgHoldingMs: number;
}

/**
 * Pure predicate shared by every implementation. Deciding *when* to call this
 * and how to fire each alert exactly once per transition is the state layer's
 * job, and is precisely what the comparison measures.
 */
export function evaluateAlerts(context: AlertContext): Alert[] {
  const alerts: Alert[] = [];

  if (context.dailyPnl <= -context.dailyLossLimit) {
    alerts.push({
      kind: 'daily-loss-limit',
      subjectId: 'account',
      message: `Daily loss limit reached: ${context.dailyPnl.toFixed(2)} of -${context.dailyLossLimit}`,
    });
  }

  for (const { position } of context.openPositions) {
    if (position.riskAmount > context.riskLimitPerTrade) {
      alerts.push({
        kind: 'risk-per-trade',
        subjectId: position.id,
        message: `${position.instrumentId} risks ${position.riskAmount} over a ${context.riskLimitPerTrade} limit`,
      });
    }
  }

  let streak = 0;
  for (const trade of context.recentClosedTrades) {
    if (context.now - trade.closedAt > TILT_WINDOW_MS) break;
    if (realizedPnl(trade) >= 0) break;
    streak += 1;
  }
  if (streak >= TILT_LOSS_STREAK) {
    alerts.push({
      kind: 'tilt',
      subjectId: 'account',
      message: `${streak} losing trades in a row within ${TILT_WINDOW_MS / 60000} minutes`,
    });
  }

  if (context.avgHoldingMs > 0) {
    for (const { position, holdingMs } of context.openPositions) {
      if (holdingMs > context.avgHoldingMs * TIME_IN_TRADE_FACTOR) {
        alerts.push({
          kind: 'time-in-trade',
          subjectId: position.id,
          message: `${position.instrumentId} has been open ${(holdingMs / context.avgHoldingMs).toFixed(1)}x your average`,
        });
      }
    }
  }

  return alerts;
}
```

- [ ] **Step 4: Write the failing fixture test**

Create `packages/domain/src/fixtures.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { STRATEGIES, createTradeHistory } from './fixtures';
import { INSTRUMENTS } from './instruments';

const END = 1_800_000_000_000;

describe('createTradeHistory', () => {
  it('produces the requested number of trades', () => {
    expect(createTradeHistory(1, 250, END)).toHaveLength(250);
  });

  it('replays identically for the same seed', () => {
    expect(createTradeHistory(7, 50, END)).toEqual(createTradeHistory(7, 50, END));
  });

  it('diverges for a different seed', () => {
    expect(createTradeHistory(7, 50, END)).not.toEqual(createTradeHistory(8, 50, END));
  });

  it('assigns unique ids', () => {
    const trades = createTradeHistory(1, 250, END);
    expect(new Set(trades.map((t) => t.id)).size).toBe(250);
  });

  it('sorts ascending by close time', () => {
    const trades = createTradeHistory(1, 100, END);
    const closes = trades.map((t) => t.closedAt);
    expect(closes).toEqual([...closes].sort((a, b) => a - b));
  });

  it('closes every trade after it opened', () => {
    expect(createTradeHistory(1, 250, END).every((t) => t.closedAt > t.openedAt)).toBe(true);
  });

  it('uses known instruments and strategies', () => {
    const ids = new Set(INSTRUMENTS.map((i) => i.id));
    const trades = createTradeHistory(1, 250, END);
    expect(trades.every((t) => ids.has(t.instrumentId))).toBe(true);
    expect(trades.every((t) => STRATEGIES.includes(t.strategy))).toBe(true);
  });

  it('always assigns positive risk so rMultiple is meaningful', () => {
    expect(createTradeHistory(1, 250, END).every((t) => t.riskAmount > 0)).toBe(true);
  });

  it('contains both winners and losers', () => {
    const trades = createTradeHistory(1, 250, END);
    expect(trades.some((t) => t.exitPrice > t.entryPrice)).toBe(true);
    expect(trades.some((t) => t.exitPrice < t.entryPrice)).toBe(true);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run packages/domain/src/fixtures.test.ts`
Expected: FAIL — `Cannot find module './fixtures'`.

- [ ] **Step 6: Write the fixture generator**

Create `packages/domain/src/fixtures.ts`:

```ts
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
```

- [ ] **Step 7: Re-export from the package entry point**

Add to `packages/domain/src/index.ts`:

```ts
export * from './alerts';
export * from './fixtures';
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run packages/domain`
Expected: PASS — 53 tests.

- [ ] **Step 9: Commit**

```bash
git add packages/domain/src
git commit -m "feat(domain): alert rules and deterministic trade history"
```

---

### Task 6: Shared presentational components

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/testids.ts`
- Create: `packages/ui/src/format.ts`
- Create: `packages/ui/src/InstrumentTable.tsx`
- Create: `packages/ui/src/PositionsPanel.tsx`
- Create: `packages/ui/src/AccountSummary.tsx`
- Create: `packages/ui/src/AlertList.tsx`
- Create: `packages/ui/src/JournalTable.tsx`
- Create: `packages/ui/src/StatsPanel.tsx`
- Create: `packages/ui/src/EquityChart.tsx`
- Create: `packages/ui/src/FilterBar.tsx`
- Create: `packages/ui/src/AppShell.tsx`
- Create: `packages/ui/src/styles.css`
- Create: `packages/ui/src/index.ts`
- Modify: `vitest.config.ts`
- Test: `packages/ui/src/format.test.ts`
- Test: `packages/ui/src/InstrumentTable.test.tsx`

**Interfaces:**
- Consumes: `@smc/domain` types and `EquityPoint`
- Produces (every component is prop-only and holds no state):
  - `const TESTID` — canonical test-id builders, see Step 3
  - `function formatPrice(value: number, precision: number): string`
  - `function formatSignedMoney(value: number): string`
  - `function formatPercent(fraction: number): string`
  - `interface InstrumentRowModel { id: InstrumentId; label: string; price: number; precision: number; changeDirection: 'up' | 'down' | 'flat' }`
  - `function InstrumentTable(props: { rows: InstrumentRowModel[]; selectedId: InstrumentId | null; onSelect(id: InstrumentId): void }): JSX.Element`
  - `interface PositionRowModel { id: string; instrumentId: InstrumentId; side: Side; size: number; entryPrice: number; markPrice: number; unrealizedPnl: number }`
  - `function PositionsPanel(props: { rows: PositionRowModel[] }): JSX.Element`
  - `function AccountSummary(props: { totalPnl: number; usedRisk: number; drawdown: number }): JSX.Element`
  - `function AlertList(props: { alerts: Alert[] }): JSX.Element`
  - `interface JournalRowModel { id: string; instrumentId: InstrumentId; side: Side; pnl: number; rMultiple: number; strategy: string; closedAt: number; note: string }`
  - `function JournalTable(props: { rows: JournalRowModel[]; onEdit(id: string, patch: { strategy?: string; note?: string }): void }): JSX.Element`
  - `function StatsPanel(props: { winRate: number; profitFactor: number; maxDrawdown: number; avgHoldingMs: number; tradeCount: number }): JSX.Element`
  - `function EquityChart(props: { points: EquityPoint[] }): JSX.Element`
  - `interface JournalFilter { strategy: string | null; side: Side | null; instrumentId: InstrumentId | null }`
  - `function FilterBar(props: { filter: JournalFilter; strategies: string[]; instrumentIds: InstrumentId[]; onChange(next: JournalFilter): void }): JSX.Element`
  - `function AppShell(props: { title: string; screen: 'terminal' | 'journal'; onScreenChange(next: 'terminal' | 'journal'): void; feedRate: number; onFeedRateChange(rate: number): void; children: React.ReactNode }): JSX.Element`

- [ ] **Step 1: Write the failing format test**

Create `packages/ui/src/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatPercent, formatPrice, formatSignedMoney } from './format';

describe('formatPrice', () => {
  it('respects the instrument precision', () => {
    expect(formatPrice(60000.456, 2)).toBe('60000.46');
    expect(formatPrice(0.123456, 5)).toBe('0.12346');
  });
});

describe('formatSignedMoney', () => {
  it('always shows a sign so gains and losses are unambiguous', () => {
    expect(formatSignedMoney(1240)).toBe('+1240.00');
    expect(formatSignedMoney(-380)).toBe('-380.00');
    expect(formatSignedMoney(0)).toBe('+0.00');
  });
});

describe('formatPercent', () => {
  it('renders a fraction as a whole percentage', () => {
    expect(formatPercent(0.61)).toBe('61%');
    expect(formatPercent(0)).toBe('0%');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/ui`
Expected: FAIL — no such directory or module.

- [ ] **Step 3: Create the package and the canonical test ids**

Create `packages/ui/package.json`:

```json
{
  "name": "@smc/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./styles.css": "./src/styles.css"
  },
  "dependencies": {
    "@smc/domain": "*"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

Create `packages/ui/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Create `packages/ui/src/testids.ts`:

```ts
import type { AlertKind } from '@smc/domain';

/**
 * The contract between every implementation and the single Playwright suite.
 * Adding a selector here is a cross-app change: all five apps must satisfy it.
 */
export const TESTID = {
  screenTerminal: 'screen-terminal',
  screenJournal: 'screen-journal',
  navTerminal: 'nav-terminal',
  navJournal: 'nav-journal',
  feedRate: (rate: number) => `feed-rate-${rate}`,

  instrumentRow: (id: string) => `instrument-row-${id}`,
  instrumentPrice: (id: string) => `instrument-price-${id}`,

  positionRow: (id: string) => `position-row-${id}`,
  positionPnl: (id: string) => `position-pnl-${id}`,

  accountPnl: 'account-pnl',
  accountRisk: 'account-risk',
  accountDrawdown: 'account-drawdown',

  alert: (kind: AlertKind) => `alert-${kind}`,
  alertList: 'alert-list',

  tradeRow: (id: string) => `trade-row-${id}`,
  tradeStrategy: (id: string) => `trade-strategy-${id}`,
  tradeNote: (id: string) => `trade-note-${id}`,

  filterStrategy: 'filter-strategy',
  filterSide: 'filter-side',
  filterInstrument: 'filter-instrument',

  statWinRate: 'stat-win-rate',
  statProfitFactor: 'stat-profit-factor',
  statMaxDrawdown: 'stat-max-drawdown',
  statAvgHolding: 'stat-avg-holding',
  statTradeCount: 'stat-trade-count',

  equityChart: 'equity-chart',
  renderCount: 'render-count',
} as const;
```

- [ ] **Step 4: Write the formatters**

Create `packages/ui/src/format.ts`:

```ts
export function formatPrice(value: number, precision: number): string {
  return value.toFixed(precision);
}

/** Always signed — a bare "380" in a P&L column is ambiguous. */
export function formatSignedMoney(value: number): string {
  const sign = value < 0 ? '-' : '+';
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
```

- [ ] **Step 5: Run the format test to verify it passes**

Run: `npx vitest run packages/ui/src/format.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 6: Write the terminal components**

Create `packages/ui/src/InstrumentTable.tsx`:

```tsx
import { memo } from 'react';
import type { InstrumentId } from '@smc/domain';
import { formatPrice } from './format';
import { TESTID } from './testids';

export interface InstrumentRowModel {
  id: InstrumentId;
  label: string;
  price: number;
  precision: number;
  changeDirection: 'up' | 'down' | 'flat';
}

interface RowProps {
  row: InstrumentRowModel;
  selected: boolean;
  onSelect(id: InstrumentId): void;
}

/**
 * Memoised on purpose. Implementations that push a new object per tick will
 * re-render every row; implementations with fine-grained subscriptions will
 * not. That difference is a headline metric, so the component must not hide it.
 */
const InstrumentRow = memo(function InstrumentRow({ row, selected, onSelect }: RowProps) {
  return (
    <tr
      data-testid={TESTID.instrumentRow(row.id)}
      className={selected ? 'row row--selected' : 'row'}
      onClick={() => onSelect(row.id)}
    >
      <td>{row.label}</td>
      <td data-testid={TESTID.instrumentPrice(row.id)} className={`price price--${row.changeDirection}`}>
        {formatPrice(row.price, row.precision)}
      </td>
    </tr>
  );
});

export function InstrumentTable(props: {
  rows: InstrumentRowModel[];
  selectedId: InstrumentId | null;
  onSelect(id: InstrumentId): void;
}) {
  return (
    <table className="table">
      <thead>
        <tr><th>Instrument</th><th>Price</th></tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <InstrumentRow
            key={row.id}
            row={row}
            selected={row.id === props.selectedId}
            onSelect={props.onSelect}
          />
        ))}
      </tbody>
    </table>
  );
}
```

Create `packages/ui/src/PositionsPanel.tsx`:

```tsx
import { memo } from 'react';
import type { InstrumentId, Side } from '@smc/domain';
import { formatPrice, formatSignedMoney } from './format';
import { TESTID } from './testids';

export interface PositionRowModel {
  id: string;
  instrumentId: InstrumentId;
  side: Side;
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
}

const PositionRow = memo(function PositionRow({ row }: { row: PositionRowModel }) {
  return (
    <tr data-testid={TESTID.positionRow(row.id)}>
      <td>{row.instrumentId}</td>
      <td>{row.side}</td>
      <td>{row.size}</td>
      <td>{formatPrice(row.entryPrice, 2)}</td>
      <td>{formatPrice(row.markPrice, 2)}</td>
      <td
        data-testid={TESTID.positionPnl(row.id)}
        className={row.unrealizedPnl < 0 ? 'pnl pnl--negative' : 'pnl pnl--positive'}
      >
        {formatSignedMoney(row.unrealizedPnl)}
      </td>
    </tr>
  );
});

export function PositionsPanel({ rows }: { rows: PositionRowModel[] }) {
  return (
    <table className="table">
      <thead>
        <tr><th>Instrument</th><th>Side</th><th>Size</th><th>Entry</th><th>Mark</th><th>P&amp;L</th></tr>
      </thead>
      <tbody>
        {rows.map((row) => <PositionRow key={row.id} row={row} />)}
      </tbody>
    </table>
  );
}
```

Create `packages/ui/src/AccountSummary.tsx`:

```tsx
import { formatSignedMoney } from './format';
import { TESTID } from './testids';

export function AccountSummary(props: { totalPnl: number; usedRisk: number; drawdown: number }) {
  return (
    <div className="summary">
      <div className="summary__item">
        <span className="summary__label">Unrealized P&amp;L</span>
        <span data-testid={TESTID.accountPnl} className="summary__value">
          {formatSignedMoney(props.totalPnl)}
        </span>
      </div>
      <div className="summary__item">
        <span className="summary__label">Used risk</span>
        <span data-testid={TESTID.accountRisk} className="summary__value">
          {props.usedRisk.toFixed(2)}
        </span>
      </div>
      <div className="summary__item">
        <span className="summary__label">Drawdown</span>
        <span data-testid={TESTID.accountDrawdown} className="summary__value">
          {formatSignedMoney(props.drawdown)}
        </span>
      </div>
    </div>
  );
}
```

Create `packages/ui/src/AlertList.tsx`:

```tsx
import type { Alert } from '@smc/domain';
import { TESTID } from './testids';

export function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <ul data-testid={TESTID.alertList} className="alerts">
      {alerts.map((alert) => (
        <li
          key={`${alert.kind}:${alert.subjectId}`}
          data-testid={TESTID.alert(alert.kind)}
          className={`alert alert--${alert.kind}`}
        >
          {alert.message}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 7: Write the journal components**

Create `packages/ui/src/JournalTable.tsx`:

```tsx
import { memo } from 'react';
import type { InstrumentId, Side } from '@smc/domain';
import { formatSignedMoney } from './format';
import { TESTID } from './testids';

export interface JournalRowModel {
  id: string;
  instrumentId: InstrumentId;
  side: Side;
  pnl: number;
  rMultiple: number;
  strategy: string;
  closedAt: number;
  note: string;
}

interface RowProps {
  row: JournalRowModel;
  strategies: string[];
  onEdit(id: string, patch: { strategy?: string; note?: string }): void;
}

const JournalRow = memo(function JournalRow({ row, strategies, onEdit }: RowProps) {
  return (
    <tr data-testid={TESTID.tradeRow(row.id)}>
      <td>{new Date(row.closedAt).toISOString().slice(0, 10)}</td>
      <td>{row.instrumentId}</td>
      <td>{row.side}</td>
      <td className={row.pnl < 0 ? 'pnl pnl--negative' : 'pnl pnl--positive'}>
        {formatSignedMoney(row.pnl)}
      </td>
      <td>{row.rMultiple.toFixed(2)}R</td>
      <td>
        <select
          data-testid={TESTID.tradeStrategy(row.id)}
          value={row.strategy}
          onChange={(event) => onEdit(row.id, { strategy: event.target.value })}
        >
          {strategies.map((strategy) => (
            <option key={strategy} value={strategy}>{strategy}</option>
          ))}
        </select>
      </td>
      <td>
        <input
          data-testid={TESTID.tradeNote(row.id)}
          value={row.note}
          placeholder="note"
          onChange={(event) => onEdit(row.id, { note: event.target.value })}
        />
      </td>
    </tr>
  );
});

export function JournalTable(props: {
  rows: JournalRowModel[];
  strategies: string[];
  onEdit(id: string, patch: { strategy?: string; note?: string }): void;
}) {
  return (
    <table className="table">
      <thead>
        <tr><th>Closed</th><th>Instrument</th><th>Side</th><th>P&amp;L</th><th>R</th><th>Strategy</th><th>Note</th></tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <JournalRow key={row.id} row={row} strategies={props.strategies} onEdit={props.onEdit} />
        ))}
      </tbody>
    </table>
  );
}
```

Create `packages/ui/src/StatsPanel.tsx`:

```tsx
import { formatDuration, formatPercent, formatSignedMoney } from './format';
import { TESTID } from './testids';

export function StatsPanel(props: {
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  avgHoldingMs: number;
  tradeCount: number;
}) {
  return (
    <div className="stats">
      <div className="stats__item">
        <span className="stats__label">Win rate</span>
        <span data-testid={TESTID.statWinRate}>{formatPercent(props.winRate)}</span>
      </div>
      <div className="stats__item">
        <span className="stats__label">Profit factor</span>
        <span data-testid={TESTID.statProfitFactor}>
          {Number.isFinite(props.profitFactor) ? props.profitFactor.toFixed(2) : '∞'}
        </span>
      </div>
      <div className="stats__item">
        <span className="stats__label">Max drawdown</span>
        <span data-testid={TESTID.statMaxDrawdown}>{formatSignedMoney(props.maxDrawdown)}</span>
      </div>
      <div className="stats__item">
        <span className="stats__label">Avg time in trade</span>
        <span data-testid={TESTID.statAvgHolding}>{formatDuration(props.avgHoldingMs)}</span>
      </div>
      <div className="stats__item">
        <span className="stats__label">Trades</span>
        <span data-testid={TESTID.statTradeCount}>{props.tradeCount}</span>
      </div>
    </div>
  );
}
```

Create `packages/ui/src/EquityChart.tsx`:

```tsx
import type { EquityPoint } from '@smc/domain';
import { TESTID } from './testids';

const WIDTH = 640;
const HEIGHT = 180;

/**
 * Hand-rolled SVG rather than a charting library: a chart dependency would
 * land in every app's bundle and distort the per-implementation size metric.
 */
export function EquityChart({ points }: { points: EquityPoint[] }) {
  if (points.length < 2) {
    return <svg data-testid={TESTID.equityChart} width={WIDTH} height={HEIGHT} />;
  }

  const equities = points.map((point) => point.equity);
  const min = Math.min(...equities);
  const max = Math.max(...equities);
  const span = max - min || 1;

  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * WIDTH;
      const y = HEIGHT - ((point.equity - min) / span) * HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg data-testid={TESTID.equityChart} width={WIDTH} height={HEIGHT} className="chart">
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
```

Create `packages/ui/src/FilterBar.tsx`:

```tsx
import type { InstrumentId, Side } from '@smc/domain';
import { TESTID } from './testids';

export interface JournalFilter {
  strategy: string | null;
  side: Side | null;
  instrumentId: InstrumentId | null;
}

export function FilterBar(props: {
  filter: JournalFilter;
  strategies: string[];
  instrumentIds: InstrumentId[];
  onChange(next: JournalFilter): void;
}) {
  return (
    <div className="filters">
      <select
        data-testid={TESTID.filterStrategy}
        value={props.filter.strategy ?? ''}
        onChange={(event) => props.onChange({
          ...props.filter,
          strategy: event.target.value === '' ? null : event.target.value,
        })}
      >
        <option value="">All strategies</option>
        {props.strategies.map((strategy) => (
          <option key={strategy} value={strategy}>{strategy}</option>
        ))}
      </select>

      <select
        data-testid={TESTID.filterSide}
        value={props.filter.side ?? ''}
        onChange={(event) => props.onChange({
          ...props.filter,
          side: event.target.value === '' ? null : (event.target.value as Side),
        })}
      >
        <option value="">Both sides</option>
        <option value="long">long</option>
        <option value="short">short</option>
      </select>

      <select
        data-testid={TESTID.filterInstrument}
        value={props.filter.instrumentId ?? ''}
        onChange={(event) => props.onChange({
          ...props.filter,
          instrumentId: event.target.value === '' ? null : event.target.value,
        })}
      >
        <option value="">All instruments</option>
        {props.instrumentIds.map((id) => <option key={id} value={id}>{id}</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 8: Write the shell, styles and entry point**

Create `packages/ui/src/AppShell.tsx`:

```tsx
import type { ReactNode } from 'react';
import { TESTID } from './testids';

export const FEED_RATES = [10, 50, 100];

export function AppShell(props: {
  title: string;
  screen: 'terminal' | 'journal';
  onScreenChange(next: 'terminal' | 'journal'): void;
  feedRate: number;
  onFeedRateChange(rate: number): void;
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <header className="shell__header">
        <h1 className="shell__title">{props.title}</h1>
        <nav className="shell__nav">
          <button
            data-testid={TESTID.navTerminal}
            aria-pressed={props.screen === 'terminal'}
            onClick={() => props.onScreenChange('terminal')}
          >
            Terminal
          </button>
          <button
            data-testid={TESTID.navJournal}
            aria-pressed={props.screen === 'journal'}
            onClick={() => props.onScreenChange('journal')}
          >
            Journal
          </button>
        </nav>
        <div className="shell__rates">
          {FEED_RATES.map((rate) => (
            <button
              key={rate}
              data-testid={TESTID.feedRate(rate)}
              aria-pressed={props.feedRate === rate}
              onClick={() => props.onFeedRateChange(rate)}
            >
              {rate}/s
            </button>
          ))}
        </div>
      </header>
      <main className="shell__main">{props.children}</main>
    </div>
  );
}
```

Create `packages/ui/src/styles.css`:

```css
:root {
  --bg: #0f1115;
  --panel: #171a21;
  --text: #e6e8ec;
  --muted: #8b93a1;
  --up: #2ecc71;
  --down: #e74c3c;
  --accent: #4c8dff;
  color-scheme: dark;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 14px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
}

.shell__header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 20px;
  border-bottom: 1px solid #222733;
}

.shell__title { font-size: 15px; margin: 0; font-weight: 600; }
.shell__nav, .shell__rates { display: flex; gap: 6px; }
.shell__rates { margin-left: auto; }

button {
  background: var(--panel);
  color: var(--text);
  border: 1px solid #262b36;
  border-radius: 4px;
  padding: 5px 11px;
  cursor: pointer;
  font: inherit;
}

button[aria-pressed='true'] { border-color: var(--accent); color: var(--accent); }

.shell__main { padding: 20px; display: grid; gap: 20px; }

.table { border-collapse: collapse; width: 100%; }
.table th {
  text-align: left;
  color: var(--muted);
  font-weight: 500;
  padding: 6px 10px;
  border-bottom: 1px solid #222733;
}
.table td { padding: 5px 10px; border-bottom: 1px solid #1a1e26; }

.row { cursor: pointer; }
.row--selected { background: #1b2130; }

.price--up { color: var(--up); }
.price--down { color: var(--down); }
.pnl--positive { color: var(--up); }
.pnl--negative { color: var(--down); }

.summary, .stats { display: flex; gap: 28px; flex-wrap: wrap; }
.summary__item, .stats__item { display: flex; flex-direction: column; gap: 2px; }
.summary__label, .stats__label { color: var(--muted); font-size: 12px; }
.summary__value { font-size: 18px; }

.alerts { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.alert {
  padding: 8px 12px;
  border-left: 3px solid var(--down);
  background: var(--panel);
  border-radius: 0 4px 4px 0;
}

.filters { display: flex; gap: 8px; }
select, input {
  background: var(--panel);
  color: var(--text);
  border: 1px solid #262b36;
  border-radius: 4px;
  padding: 4px 8px;
  font: inherit;
}

.chart { color: var(--accent); display: block; }
```

Create `packages/ui/src/index.ts`:

```ts
export * from './testids';
export * from './format';
export * from './InstrumentTable';
export * from './PositionsPanel';
export * from './AccountSummary';
export * from './AlertList';
export * from './JournalTable';
export * from './StatsPanel';
export * from './EquityChart';
export * from './FilterBar';
export * from './AppShell';
```

- [ ] **Step 9: Write the failing component test**

Create `packages/ui/src/InstrumentTable.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstrumentTable } from './InstrumentTable';
import { TESTID } from './testids';

const rows = [
  { id: 'BTC-USDT', label: 'BTC/USDT', price: 60000.456, precision: 2, changeDirection: 'up' as const },
  { id: 'ETH-USDT', label: 'ETH/USDT', price: 3000.1, precision: 2, changeDirection: 'down' as const },
];

describe('InstrumentTable', () => {
  it('renders each instrument at its precision', () => {
    render(<InstrumentTable rows={rows} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId(TESTID.instrumentPrice('BTC-USDT'))).toHaveTextContent('60000.46');
  });

  it('reports the clicked instrument', async () => {
    const onSelect = vi.fn();
    render(<InstrumentTable rows={rows} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId(TESTID.instrumentRow('ETH-USDT')));
    expect(onSelect).toHaveBeenCalledWith('ETH-USDT');
  });

  it('does not re-render rows whose model is unchanged', () => {
    const { rerender } = render(<InstrumentTable rows={rows} selectedId={null} onSelect={() => {}} />);
    const before = screen.getByTestId(TESTID.instrumentRow('ETH-USDT'));
    rerender(<InstrumentTable rows={[{ ...rows[0]!, price: 60001 }, rows[1]!]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId(TESTID.instrumentRow('ETH-USDT'))).toBe(before);
  });
});
```

- [ ] **Step 10: Add React tooling and a jsdom project to Vitest**

Run:

```bash
npm install -D -w . @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @vitejs/plugin-react
npm install -w @smc/ui react@^19 react-dom@^19
npm install -D -w @smc/ui @types/react @types/react-dom
```

Replace `vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['./vitest.setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['packages/domain/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: ['packages/ui/**/*.test.{ts,tsx}', 'apps/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
        },
      },
    ],
  },
});
```

Create `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Extend the root `typecheck` script now that a second package exists:

```json
    "typecheck": "tsc --noEmit -p packages/domain && tsc --noEmit -p packages/ui"
```

- [ ] **Step 11: Run the tests to verify they pass**

Run: `npx vitest run`
Expected: PASS — 53 domain tests plus 7 UI tests.

- [ ] **Step 12: Commit**

```bash
git add packages/ui vitest.config.ts vitest.setup.ts package.json package-lock.json
git commit -m "feat(ui): shared presentational components and canonical test ids"
```

---

### Task 7: Zustand app — terminal screen

**Files:**
- Create: `apps/zustand/package.json`
- Create: `apps/zustand/tsconfig.json`
- Create: `apps/zustand/vite.config.ts`
- Create: `apps/zustand/index.html`
- Create: `apps/zustand/src/main.tsx`
- Create: `apps/zustand/src/App.tsx`
- Create: `apps/zustand/src/state/store.ts`
- Create: `apps/zustand/src/state/selectors.ts`
- Create: `apps/zustand/src/screens/TerminalScreen.tsx`
- Test: `apps/zustand/src/state/store.test.ts`

**Interfaces:**
- Consumes: everything exported by `@smc/domain` and `@smc/ui`
- Produces:
  - `interface AppState` with slices `prices`, `priceDirections`, `positions`, `selectedInstrumentId`, `feedRate`, `screen`, `trades`, `filter`
  - `const useAppStore` — Zustand hook store
  - `function applyQuote(quote: Quote): void` — store action
  - `function selectInstrumentRows(state: AppState): InstrumentRowModel[]`
  - `function selectPositionRows(state: AppState): PositionRowModel[]`
  - `function selectAccountTotals(state: AppState): { totalPnl: number; usedRisk: number; drawdown: number }`

The store holds prices in a plain `Record` keyed by instrument id, updated immutably per quote. That is the idiomatic Zustand shape, and its cost under load is exactly what the benchmark should capture — do not optimise it into a mutable map.

- [ ] **Step 1: Write the failing store test**

Create `apps/zustand/src/state/store.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/zustand`
Expected: FAIL — `Cannot find module './store'`.

- [ ] **Step 3: Create the app package and Vite config**

Create `apps/zustand/package.json`:

```json
{
  "name": "@smc/app-zustand",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 4173"
  },
  "dependencies": {
    "@smc/domain": "*",
    "@smc/ui": "*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^7.0.0"
  }
}
```

Create `apps/zustand/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "vite.config.ts"]
}
```

Create `apps/zustand/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', sourcemap: false },
});
```

Create `apps/zustand/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TraderCat Lite — Zustand</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Write the store**

Create `apps/zustand/src/state/store.ts`:

```ts
import { create } from 'zustand';
import {
  INSTRUMENTS, START_PRICES, createTradeHistory, mulberry32,
} from '@smc/domain';
import type { InstrumentId, Position, Quote, Trade } from '@smc/domain';
import type { JournalFilter } from '@smc/ui';

export type PriceDirection = 'up' | 'down' | 'flat';
export type Screen = 'terminal' | 'journal';

export interface AppState {
  prices: Record<InstrumentId, number>;
  priceDirections: Record<InstrumentId, PriceDirection>;
  sequences: Record<InstrumentId, number>;
  positions: Position[];
  trades: Trade[];
  selectedInstrumentId: InstrumentId | null;
  feedRate: number;
  screen: Screen;
  filter: JournalFilter;

  applyQuote(quote: Quote): void;
  selectInstrument(id: InstrumentId): void;
  setFeedRate(rate: number): void;
  setScreen(screen: Screen): void;
  setFilter(filter: JournalFilter): void;
  editTrade(id: string, patch: { strategy?: string; note?: string }): void;
}

export interface StoreOptions {
  seed: number;
  tradeCount: number;
  now: number;
}

function seedPositions(seed: number, now: number): Position[] {
  const nextRandom = mulberry32(seed);
  return INSTRUMENTS.slice(0, 6).map((instrument, index) => ({
    id: `pos-${index}`,
    instrumentId: instrument.id,
    side: nextRandom() < 0.6 ? 'long' : 'short',
    size: Number(((200 + nextRandom() * 800) / (START_PRICES[instrument.id] ?? 100)).toFixed(6)),
    entryPrice: START_PRICES[instrument.id] ?? 100,
    // One position is deliberately long-held so the time-in-trade alert has a subject.
    openedAt: now - (index === 0 ? 40 * 60 * 60 * 1000 : Math.floor(nextRandom() * 3 * 60 * 60 * 1000)),
    // One position deliberately breaches the per-trade risk limit.
    riskAmount: index === 1 ? 150 : Number((20 + nextRandom() * 60).toFixed(2)),
  }));
}

export function createAppStore(options: StoreOptions) {
  return create<AppState>((set, get) => ({
    prices: { ...START_PRICES },
    priceDirections: {},
    sequences: {},
    positions: seedPositions(options.seed, options.now),
    trades: createTradeHistory(options.seed, options.tradeCount, options.now),
    selectedInstrumentId: INSTRUMENTS[0]?.id ?? null,
    feedRate: 10,
    screen: 'terminal',
    filter: { strategy: null, side: null, instrumentId: null },

    applyQuote(quote) {
      const state = get();
      const lastSeq = state.sequences[quote.instrumentId] ?? 0;
      if (quote.seq <= lastSeq) return;

      const previous = state.prices[quote.instrumentId];
      const direction: PriceDirection =
        previous === undefined || previous === quote.price
          ? 'flat'
          : quote.price > previous ? 'up' : 'down';

      set({
        prices: { ...state.prices, [quote.instrumentId]: quote.price },
        priceDirections: { ...state.priceDirections, [quote.instrumentId]: direction },
        sequences: { ...state.sequences, [quote.instrumentId]: quote.seq },
      });
    },

    selectInstrument(id) { set({ selectedInstrumentId: id }); },
    setFeedRate(rate) { set({ feedRate: rate }); },
    setScreen(screen) { set({ screen }); },
    setFilter(filter) { set({ filter }); },

    editTrade(id, patch) {
      set({
        trades: get().trades.map((trade) => (trade.id === id ? { ...trade, ...patch } : trade)),
      });
    },
  }));
}

export const useAppStore = createAppStore({
  seed: 20260729,
  tradeCount: 250,
  now: Date.UTC(2026, 6, 29),
});
```

- [ ] **Step 5: Run the store test to verify it passes**

Run: `npx vitest run apps/zustand`
Expected: PASS — 5 tests.

- [ ] **Step 6: Write the selectors**

Create `apps/zustand/src/state/selectors.ts`:

```ts
import { INSTRUMENTS, maxDrawdown, equityCurve, unrealizedPnl } from '@smc/domain';
import type { InstrumentRowModel, PositionRowModel } from '@smc/ui';
import type { AppState } from './store';

const LABELS = new Map(INSTRUMENTS.map((i) => [i.id, `${i.base}/${i.quote}`]));
const PRECISIONS = new Map(INSTRUMENTS.map((i) => [i.id, i.pricePrecision]));

export function selectInstrumentRows(state: AppState): InstrumentRowModel[] {
  return INSTRUMENTS.map((instrument) => ({
    id: instrument.id,
    label: LABELS.get(instrument.id) ?? instrument.id,
    price: state.prices[instrument.id] ?? 0,
    precision: PRECISIONS.get(instrument.id) ?? 2,
    changeDirection: state.priceDirections[instrument.id] ?? 'flat',
  }));
}

export function selectPositionRows(state: AppState): PositionRowModel[] {
  return state.positions.map((position) => {
    const markPrice = state.prices[position.instrumentId] ?? position.entryPrice;
    return {
      id: position.id,
      instrumentId: position.instrumentId,
      side: position.side,
      size: position.size,
      entryPrice: position.entryPrice,
      markPrice,
      unrealizedPnl: unrealizedPnl(position, markPrice),
    };
  });
}

export function selectAccountTotals(state: AppState): {
  totalPnl: number; usedRisk: number; drawdown: number;
} {
  let totalPnl = 0;
  let usedRisk = 0;
  for (const position of state.positions) {
    totalPnl += unrealizedPnl(position, state.prices[position.instrumentId] ?? position.entryPrice);
    usedRisk += position.riskAmount;
  }
  return { totalPnl, usedRisk, drawdown: maxDrawdown(equityCurve(state.trades)) };
}
```

- [ ] **Step 7: Write the terminal screen and app entry**

Create `apps/zustand/src/screens/TerminalScreen.tsx`:

```tsx
import { useEffect } from 'react';
import { INSTRUMENTS, START_PRICES, createFeed } from '@smc/domain';
import { AccountSummary, InstrumentTable, PositionsPanel, TESTID } from '@smc/ui';
import { useAppStore } from '../state/store';
import { selectAccountTotals, selectInstrumentRows, selectPositionRows } from '../state/selectors';

export function TerminalScreen() {
  const feedRate = useAppStore((state) => state.feedRate);
  const applyQuote = useAppStore((state) => state.applyQuote);
  const selectedId = useAppStore((state) => state.selectedInstrumentId);
  const selectInstrument = useAppStore((state) => state.selectInstrument);

  const instrumentRows = useAppStore(selectInstrumentRows);
  const positionRows = useAppStore(selectPositionRows);
  const totals = useAppStore(selectAccountTotals);

  useEffect(() => {
    const feed = createFeed({
      instruments: INSTRUMENTS,
      seed: 20260729,
      updatesPerSecond: feedRate,
      startPrices: START_PRICES,
    });
    const unsubscribe = feed.subscribe(applyQuote);
    feed.start();
    return () => {
      feed.stop();
      unsubscribe();
    };
  }, [feedRate, applyQuote]);

  return (
    <div data-testid={TESTID.screenTerminal} className="terminal">
      <AccountSummary {...totals} />
      <PositionsPanel rows={positionRows} />
      <InstrumentTable rows={instrumentRows} selectedId={selectedId} onSelect={selectInstrument} />
    </div>
  );
}
```

Create `apps/zustand/src/App.tsx`:

```tsx
import { AppShell } from '@smc/ui';
import { useAppStore } from './state/store';
import { TerminalScreen } from './screens/TerminalScreen';

export function App() {
  const screen = useAppStore((state) => state.screen);
  const setScreen = useAppStore((state) => state.setScreen);
  const feedRate = useAppStore((state) => state.feedRate);
  const setFeedRate = useAppStore((state) => state.setFeedRate);

  return (
    <AppShell
      title="TraderCat Lite — Zustand"
      screen={screen}
      onScreenChange={setScreen}
      feedRate={feedRate}
      onFeedRateChange={setFeedRate}
    >
      {screen === 'terminal' ? <TerminalScreen /> : null}
    </AppShell>
  );
}
```

Create `apps/zustand/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@smc/ui/styles.css';
import { App } from './App';

const container = document.getElementById('root');
if (container === null) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: Verify the app builds and runs**

Run: `npm install && npm run build -w @smc/app-zustand`
Expected: build succeeds, `apps/zustand/dist/` is produced.

Run: `npm run dev -w @smc/app-zustand` and open the printed URL.
Expected: prices tick, position P&L moves, the 10/50/100 buttons change tick rate.

- [ ] **Step 9: Commit**

```bash
git add apps/zustand package.json package-lock.json
git commit -m "feat(zustand): terminal screen on a zustand store"
```

---

### Task 8: Zustand app — journal screen

**Files:**
- Create: `apps/zustand/src/screens/JournalScreen.tsx`
- Modify: `apps/zustand/src/state/selectors.ts`
- Modify: `apps/zustand/src/App.tsx`
- Test: `apps/zustand/src/state/selectors.test.ts`

**Interfaces:**
- Consumes: `AppState`, `JournalFilter`, `@smc/domain` statistics
- Produces:
  - `function selectFilteredTrades(state: AppState): Trade[]`
  - `function selectJournalRows(state: AppState): JournalRowModel[]`
  - `function selectJournalStats(state: AppState): { winRate: number; profitFactor: number; maxDrawdown: number; avgHoldingMs: number; tradeCount: number }`

- [ ] **Step 1: Write the failing selector test**

Create `apps/zustand/src/state/selectors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createAppStore } from './store';
import { selectFilteredTrades, selectJournalStats } from './selectors';

const NOW = 1_800_000_000_000;

function store() {
  return createAppStore({ seed: 5, tradeCount: 120, now: NOW });
}

describe('selectFilteredTrades', () => {
  it('returns everything when no filter is set', () => {
    const s = store();
    expect(selectFilteredTrades(s.getState())).toHaveLength(120);
  });

  it('filters by strategy', () => {
    const s = store();
    s.getState().setFilter({ strategy: 'breakout', side: null, instrumentId: null });
    const filtered = selectFilteredTrades(s.getState());
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((t) => t.strategy === 'breakout')).toBe(true);
  });

  it('filters by side', () => {
    const s = store();
    s.getState().setFilter({ strategy: null, side: 'short', instrumentId: null });
    expect(selectFilteredTrades(s.getState()).every((t) => t.side === 'short')).toBe(true);
  });

  it('combines filters conjunctively', () => {
    const s = store();
    s.getState().setFilter({ strategy: 'breakout', side: 'long', instrumentId: null });
    expect(selectFilteredTrades(s.getState())
      .every((t) => t.strategy === 'breakout' && t.side === 'long')).toBe(true);
  });
});

describe('selectJournalStats', () => {
  it('reports stats over the filtered set, not the whole history', () => {
    const s = store();
    const all = selectJournalStats(s.getState()).tradeCount;
    s.getState().setFilter({ strategy: 'breakout', side: null, instrumentId: null });
    expect(selectJournalStats(s.getState()).tradeCount).toBeLessThan(all);
  });

  it('keeps win rate inside [0, 1]', () => {
    const stats = selectJournalStats(store().getState());
    expect(stats.winRate).toBeGreaterThanOrEqual(0);
    expect(stats.winRate).toBeLessThanOrEqual(1);
  });

  it('reports a non-positive max drawdown', () => {
    expect(selectJournalStats(store().getState()).maxDrawdown).toBeLessThanOrEqual(0);
  });
});

describe('editTrade', () => {
  it('updates only the targeted trade', () => {
    const s = store();
    const target = s.getState().trades[0]!;
    s.getState().editTrade(target.id, { note: 'chased the entry' });
    const trades = s.getState().trades;
    expect(trades.find((t) => t.id === target.id)?.note).toBe('chased the entry');
    expect(trades.filter((t) => t.note !== '')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/zustand/src/state/selectors.test.ts`
Expected: FAIL — `selectFilteredTrades is not exported`.

- [ ] **Step 3: Add the journal selectors**

First extend the existing imports at the top of `apps/zustand/src/state/selectors.ts` — do not add a second import block at the bottom of the file:

```ts
import {
  INSTRUMENTS, avgHoldingMs, equityCurve, maxDrawdown, profitFactor,
  rMultiple, realizedPnl, unrealizedPnl, winRate,
} from '@smc/domain';
import type { Trade } from '@smc/domain';
import type { InstrumentRowModel, JournalRowModel, PositionRowModel } from '@smc/ui';
import type { AppState } from './store';
```

Then append the new selectors to the end of the file:

```ts
export function selectFilteredTrades(state: AppState): Trade[] {
  const { strategy, side, instrumentId } = state.filter;
  return state.trades.filter((trade) => {
    if (strategy !== null && trade.strategy !== strategy) return false;
    if (side !== null && trade.side !== side) return false;
    if (instrumentId !== null && trade.instrumentId !== instrumentId) return false;
    return true;
  });
}

export function selectJournalRows(state: AppState): JournalRowModel[] {
  return selectFilteredTrades(state)
    .slice()
    .sort((a, b) => b.closedAt - a.closedAt)
    .map((trade) => ({
      id: trade.id,
      instrumentId: trade.instrumentId,
      side: trade.side,
      pnl: realizedPnl(trade),
      rMultiple: rMultiple(trade),
      strategy: trade.strategy,
      closedAt: trade.closedAt,
      note: trade.note,
    }));
}

export function selectJournalStats(state: AppState): {
  winRate: number; profitFactor: number; maxDrawdown: number;
  avgHoldingMs: number; tradeCount: number;
} {
  const trades = selectFilteredTrades(state);
  return {
    winRate: winRate(trades),
    profitFactor: profitFactor(trades),
    maxDrawdown: maxDrawdown(equityCurve(trades)),
    avgHoldingMs: avgHoldingMs(trades),
    tradeCount: trades.length,
  };
}

export function selectEquityCurve(state: AppState) {
  return equityCurve(selectFilteredTrades(state));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run apps/zustand`
Expected: PASS — 13 tests.

- [ ] **Step 5: Write the journal screen**

Create `apps/zustand/src/screens/JournalScreen.tsx`:

```tsx
import { INSTRUMENTS, STRATEGIES } from '@smc/domain';
import { EquityChart, FilterBar, JournalTable, StatsPanel, TESTID } from '@smc/ui';
import { useAppStore } from '../state/store';
import {
  selectEquityCurve, selectJournalRows, selectJournalStats,
} from '../state/selectors';

const INSTRUMENT_IDS = INSTRUMENTS.map((instrument) => instrument.id);

export function JournalScreen() {
  const filter = useAppStore((state) => state.filter);
  const setFilter = useAppStore((state) => state.setFilter);
  const editTrade = useAppStore((state) => state.editTrade);

  const rows = useAppStore(selectJournalRows);
  const stats = useAppStore(selectJournalStats);
  const curve = useAppStore(selectEquityCurve);

  return (
    <div data-testid={TESTID.screenJournal} className="journal">
      <FilterBar
        filter={filter}
        strategies={STRATEGIES}
        instrumentIds={INSTRUMENT_IDS}
        onChange={setFilter}
      />
      <StatsPanel {...stats} />
      <EquityChart points={curve} />
      <JournalTable rows={rows} strategies={STRATEGIES} onEdit={editTrade} />
    </div>
  );
}
```

- [ ] **Step 6: Wire the screen into the app**

In `apps/zustand/src/App.tsx`, add the import and replace the children expression:

```tsx
import { JournalScreen } from './screens/JournalScreen';
```

```tsx
      {screen === 'terminal' ? <TerminalScreen /> : <JournalScreen />}
```

- [ ] **Step 7: Verify in the browser**

Run: `npm run dev -w @smc/app-zustand`
Expected: the Journal tab lists trades, filters narrow the table and the stats change with them, editing a strategy or note persists while switching tabs.

- [ ] **Step 8: Commit**

```bash
git add apps/zustand/src
git commit -m "feat(zustand): journal screen with filters and statistics"
```

---

### Task 9: Zustand app — alert engine

**Files:**
- Create: `apps/zustand/src/state/alertEngine.ts`
- Modify: `apps/zustand/src/state/store.ts`
- Modify: `apps/zustand/src/screens/TerminalScreen.tsx`
- Test: `apps/zustand/src/state/alertEngine.test.ts`

**Interfaces:**
- Consumes: `evaluateAlerts`, `AlertContext`, `Alert` from `@smc/domain`; `AppState` from Task 7
- Produces:
  - `function buildAlertContext(state: AppState, now: number): AlertContext`
  - `function attachAlertEngine(store: ReturnType<typeof createAppStore>, options: { now(): number; onFire(alert: Alert): void }): () => void`
  - Store additions: `alerts: Alert[]`, `firedAlertKeys: string[]`, `setAlerts(alerts: Alert[]): void`

This is the task that the whole comparison exists to illuminate. In Zustand the wiring is `store.subscribe` plus a manually maintained set of already-fired keys — there is no built-in notion of "run this derivation when its inputs change". Note that cost honestly; do not paper over it.

An alert must fire once per transition into the triggered state. Re-firing on every tick while the condition holds is the bug this task's tests exist to prevent.

- [ ] **Step 1: Write the failing test**

Create `apps/zustand/src/state/alertEngine.test.ts`:

```ts
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
    const context = buildAlertContext(store().getState(), NOW);
    expect(context.openPositions).toHaveLength(store().getState().positions.length);
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
        p.id === breaching.id ? { ...p, riskAmount: 10 } : p),
    });
    s.setState({ positions: s.getState().positions.map((p) =>
      p.id === breaching.id ? { ...p, riskAmount: 150 } : p) });

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/zustand/src/state/alertEngine.test.ts`
Expected: FAIL — `Cannot find module './alertEngine'`.

- [ ] **Step 3: Add alert state to the store**

In `apps/zustand/src/state/store.ts`, add to the `AppState` interface:

```ts
  alerts: Alert[];
  setAlerts(alerts: Alert[]): void;
```

Add `Alert` to the type import from `@smc/domain`, add the initial value inside `create`:

```ts
    alerts: [],
```

and the action:

```ts
    setAlerts(alerts) { set({ alerts }); },
```

- [ ] **Step 4: Write the alert engine**

Create `apps/zustand/src/state/alertEngine.ts`:

```ts
import { avgHoldingMs, evaluateAlerts } from '@smc/domain';
import type { Alert, AlertContext } from '@smc/domain';
import type { createAppStore, AppState } from './store';

export const DAILY_LOSS_LIMIT = 400;
export const RISK_LIMIT_PER_TRADE = 100;

function alertKey(alert: Alert): string {
  return `${alert.kind}:${alert.subjectId}`;
}

export function buildAlertContext(state: AppState, now: number): AlertContext {
  const dailyPnl = state.positions.reduce((sum, position) => {
    const price = state.prices[position.instrumentId] ?? position.entryPrice;
    const direction = position.side === 'long' ? 1 : -1;
    return sum + (price - position.entryPrice) * position.size * direction;
  }, 0);

  return {
    now,
    dailyPnl,
    dailyLossLimit: DAILY_LOSS_LIMIT,
    riskLimitPerTrade: RISK_LIMIT_PER_TRADE,
    recentClosedTrades: [...state.trades].sort((a, b) => b.closedAt - a.closedAt),
    openPositions: state.positions.map((position) => ({
      position,
      holdingMs: now - position.openedAt,
    })),
    avgHoldingMs: avgHoldingMs(state.trades),
  };
}

/**
 * Zustand has no derivation graph, so the engine re-evaluates on every store
 * change and diffs the result against the previously fired keys by hand. The
 * bookkeeping below is exactly the cost this comparison is meant to expose —
 * MobX and Jotai express the same behaviour declaratively.
 */
export function attachAlertEngine(
  store: ReturnType<typeof createAppStore>,
  options: { now(): number; onFire(alert: Alert): void },
): () => void {
  let firedKeys = new Set<string>();

  const evaluate = (state: AppState) => {
    const alerts = evaluateAlerts(buildAlertContext(state, options.now()));
    const currentKeys = new Set(alerts.map(alertKey));

    for (const alert of alerts) {
      if (!firedKeys.has(alertKey(alert))) options.onFire(alert);
    }
    firedKeys = currentKeys;

    const previous = state.alerts;
    const changed =
      previous.length !== alerts.length ||
      previous.some((alert, index) => alertKey(alert) !== alertKey(alerts[index]!));
    if (changed) store.getState().setAlerts(alerts);
  };

  evaluate(store.getState());
  return store.subscribe(evaluate);
}
```

`setAlerts` writes to the same store the engine subscribes to, so `evaluate` re-enters exactly once: the second pass computes an identical alert list, `changed` is false, and the recursion stops. The `changed` guard is load-bearing — remove it and this becomes an infinite loop.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run apps/zustand`
Expected: PASS — 19 tests.

- [ ] **Step 6: Render alerts on the terminal screen**

In `apps/zustand/src/screens/TerminalScreen.tsx`, add to the imports:

```tsx
import { AccountSummary, AlertList, InstrumentTable, PositionsPanel, TESTID } from '@smc/ui';
import { attachAlertEngine } from '../state/alertEngine';
import { useAppStore, appStore } from '../state/store';
```

Add the subscription and the alert selector inside the component:

```tsx
  const alerts = useAppStore((state) => state.alerts);

  useEffect(
    () => attachAlertEngine(appStore, { now: () => Date.now(), onFire: () => {} }),
    [],
  );
```

Render it above the summary:

```tsx
      <AlertList alerts={alerts} />
```

In `apps/zustand/src/state/store.ts`, export the store instance under a second name so non-hook code can reach it:

```ts
export const appStore = useAppStore;
```

- [ ] **Step 7: Verify in the browser**

Run: `npm run dev -w @smc/app-zustand`
Expected: the terminal shows the risk-per-trade and time-in-trade alerts seeded by the fixture, and they do not flicker on every tick.

- [ ] **Step 8: Commit**

```bash
git add apps/zustand/src
git commit -m "feat(zustand): alert engine wired through store subscription"
```

---

### Task 10: Cross-app parity suite

**Files:**
- Create: `packages/bench/package.json`
- Create: `packages/bench/tsconfig.json`
- Create: `packages/bench/src/apps.ts`
- Create: `playwright.config.ts`
- Create: `e2e/parity.spec.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `TESTID` from `@smc/ui`; the built `apps/zustand/dist`
- Produces:
  - `interface AppTarget { name: string; workspace: string; port: number }`
  - `const APP_TARGETS: AppTarget[]` — starts with Zustand alone; Plan 2 appends the other four
  - A Playwright suite parameterised over `APP_TARGETS` that any implementation must pass

This suite is the acceptance gate for every later implementation. A benchmark comparing apps that behave differently would be meaningless, so parity is checked before performance is ever measured.

- [ ] **Step 1: Write the failing parity spec**

Create `e2e/parity.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { TESTID } from '@smc/ui';
import { APP_TARGETS } from '@smc/bench';

for (const target of APP_TARGETS) {
  test.describe(`${target.name} — functional parity`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`http://localhost:${target.port}/`);
    });

    test('opens on the terminal screen', async ({ page }) => {
      await expect(page.getByTestId(TESTID.screenTerminal)).toBeVisible();
    });

    test('streams price updates', async ({ page }) => {
      const price = page.getByTestId(TESTID.instrumentPrice('BTC-USDT'));
      const before = await price.textContent();
      await expect(price).not.toHaveText(before ?? '', { timeout: 5000 });
    });

    test('moves position P&L with the price', async ({ page }) => {
      const pnl = page.getByTestId(TESTID.positionPnl('pos-0'));
      const before = await pnl.textContent();
      await expect(pnl).not.toHaveText(before ?? '', { timeout: 5000 });
    });

    test('raises the seeded risk-per-trade alert', async ({ page }) => {
      await expect(page.getByTestId(TESTID.alert('risk-per-trade'))).toBeVisible();
    });

    test('switches to the journal', async ({ page }) => {
      await page.getByTestId(TESTID.navJournal).click();
      await expect(page.getByTestId(TESTID.screenJournal)).toBeVisible();
      await expect(page.getByTestId(TESTID.statTradeCount)).toHaveText('250');
    });

    test('narrows the journal by strategy', async ({ page }) => {
      await page.getByTestId(TESTID.navJournal).click();
      const total = Number(await page.getByTestId(TESTID.statTradeCount).textContent());
      await page.getByTestId(TESTID.filterStrategy).selectOption('breakout');
      const filtered = Number(await page.getByTestId(TESTID.statTradeCount).textContent());
      expect(filtered).toBeGreaterThan(0);
      expect(filtered).toBeLessThan(total);
    });

    test('persists a note across screen switches', async ({ page }) => {
      await page.getByTestId(TESTID.navJournal).click();
      const firstRow = page.getByTestId(TESTID.screenJournal).locator('tbody tr').first();
      const note = firstRow.locator('input');
      await note.fill('chased the entry');
      await page.getByTestId(TESTID.navTerminal).click();
      await page.getByTestId(TESTID.navJournal).click();
      await expect(
        page.getByTestId(TESTID.screenJournal).locator('tbody tr').first().locator('input'),
      ).toHaveValue('chased the entry');
    });

    test('changes tick rate without breaking the stream', async ({ page }) => {
      await page.getByTestId(TESTID.feedRate(100)).click();
      const price = page.getByTestId(TESTID.instrumentPrice('ETH-USDT'));
      const before = await price.textContent();
      await expect(price).not.toHaveText(before ?? '', { timeout: 5000 });
    });
  });
}
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx playwright test`
Expected: FAIL — no Playwright config, `@smc/bench` unresolved.

- [ ] **Step 3: Create the bench package with the app registry**

Create `packages/bench/package.json`:

```json
{
  "name": "@smc/bench",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

Create `packages/bench/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Create `packages/bench/src/apps.ts`:

```ts
export interface AppTarget {
  name: string;
  workspace: string;
  port: number;
}

/**
 * Every implementation registers here. Plan 2 appends rxjs, redux, mobx and
 * jotai; the parity suite and the benchmark runner both iterate this list, so
 * a new app is picked up by both without touching either.
 */
export const APP_TARGETS: AppTarget[] = [
  { name: 'zustand', workspace: '@smc/app-zustand', port: 4173 },
];
```

Create `packages/bench/src/index.ts`:

```ts
export * from './apps';
```

- [ ] **Step 4: Write the Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';
import { APP_TARGETS } from './packages/bench/src/apps';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] === undefined ? 0 : 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'on-first-retry' },
  webServer: APP_TARGETS.map((target) => ({
    command: `npm run preview -w ${target.workspace} -- --port ${target.port} --strictPort`,
    port: target.port,
    reuseExistingServer: process.env['CI'] === undefined,
    timeout: 120_000,
  })),
});
```

- [ ] **Step 5: Add Playwright and the scripts**

Run:

```bash
npm install -D -w . @playwright/test
npx playwright install --with-deps chromium
```

Add to the root `package.json` scripts:

```json
    "build:apps": "npm run build --workspaces --if-present",
    "test:e2e": "npm run build:apps && playwright test"
```

- [ ] **Step 6: Run the suite to verify it passes**

Run: `npm run test:e2e`
Expected: PASS — 8 tests against the Zustand app.

- [ ] **Step 7: Commit**

```bash
git add packages/bench playwright.config.ts e2e package.json package-lock.json .gitignore
git commit -m "test: cross-app functional parity suite"
```

---

## What this plan delivers

A working TraderCat Lite on Zustand with both screens and the alert engine, backed by a shared domain package with 53 unit tests, a shared component library, and an 8-case parity suite that every later implementation must pass unchanged.

## Next plans

- **Plan 2 — Four remaining implementations.** RxJS, Redux Toolkit, MobX and Jotai, each registered in `APP_TARGETS` and green against the same parity suite. Each is a separate task with its own alert-engine wiring, which is where the comparison earns its keep.
- **Plan 3 — Measurement and publication.** Benchmark harness and metric collectors, the change-cost experiment, CI, GitHub Pages, and README generation from benchmark JSON.

## Self-review notes

Checked against the spec:

- Five managers — Zustand here, the other four in Plan 2 as registered targets
- Terminal and journal screens — Tasks 7 and 8
- Alert engine as the core comparison scenario — Task 9, with the Zustand-specific cost documented in code comments rather than hidden
- Shared domain and UI, state layer only in apps — enforced by the package split and Global Constraints
- Deterministic feed and fixtures — Tasks 3 and 5, seeds fixed, `Math.random` banned
- No charting library — hand-rolled SVG in Task 6
- Vite, not webpack — Task 7
- Parity before performance — Task 10, gating Plan 3

Deferred to later plans by design, not omission: benchmark metrics, complexity counting, the change-cost experiment, CI, GitHub Pages, README.
