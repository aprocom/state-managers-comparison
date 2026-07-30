import { INSTRUMENTS, START_PRICES } from '@smc/domain';
import type { InstrumentRowModel } from '@smc/ui';

export const INDEX_BY_ID = new Map(
  INSTRUMENTS.map((instrument, index) => [instrument.id, index]),
);

export function initialInstrumentRows(): InstrumentRowModel[] {
  return INSTRUMENTS.map((instrument) => ({
    id: instrument.id,
    label: `${instrument.base}/${instrument.quote}`,
    price: START_PRICES[instrument.id] ?? 0,
    precision: instrument.pricePrecision,
    changeDirection: 'flat',
    pinned: false,
  }));
}

/** Stable partition: pinned rows first, each group keeping its original order. */
export function orderPinnedFirst(rows: InstrumentRowModel[]): InstrumentRowModel[] {
  const pinned = rows.filter((row) => row.pinned);
  return pinned.length === 0 ? rows : [...pinned, ...rows.filter((row) => !row.pinned)];
}
