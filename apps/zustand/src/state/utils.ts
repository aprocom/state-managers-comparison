import { INSTRUMENTS } from '@smc/domain';
import type { InstrumentId } from '@smc/domain';
import type { InstrumentRowModel } from '@smc/ui';

const LABELS = new Map(INSTRUMENTS.map((i) => [i.id, `${i.base}/${i.quote}`]));
const PRECISIONS = new Map(INSTRUMENTS.map((i) => [i.id, i.pricePrecision]));

export function instrumentLabel(id: InstrumentId): string {
  return LABELS.get(id) ?? id;
}

export function instrumentPrecision(id: InstrumentId): number {
  return PRECISIONS.get(id) ?? 2;
}

/**
 * What Zustand does and does not give you, stated precisely — an earlier
 * version of this file hand-rolled a memoiser and then billed Zustand for the
 * lines, which measured the author rather than the library.
 *
 * Zustand ships `useShallow` (zustand/react/shallow). It solves reference
 * stability at the subscription: the selector re-runs on every store change,
 * but the component only re-renders when the shallow contents differ.
 *
 * What Zustand genuinely does not ship is a derivation cache. `useShallow`
 * compares *after* computing, so an expensive derivation still runs on every
 * store change. This memoiser is the honest cost of that gap, and it is
 * counted against Zustand rather than hidden.
 */
export function memoizeOne<A extends readonly unknown[], R>(
  compute: (...args: A) => R,
): (...args: A) => R {
  let lastArgs: A | null = null;
  let lastResult: R;
  return (...args: A): R => {
    if (
      lastArgs !== null
      && lastArgs.length === args.length
      && lastArgs.every((value, index) => Object.is(value, args[index]))
    ) {
      return lastResult;
    }
    lastArgs = args;
    lastResult = compute(...args);
    return lastResult;
  };
}

/** Stable partition: pinned rows first, each group keeping its original order. */
export function orderPinnedFirst(rows: InstrumentRowModel[]): InstrumentRowModel[] {
  const pinned = rows.filter((row) => row.pinned);
  return pinned.length === 0 ? rows : [...pinned, ...rows.filter((row) => !row.pinned)];
}

