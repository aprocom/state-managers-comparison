import { INSTRUMENTS } from '@smc/domain';
import type { InstrumentId } from '@smc/domain';

const LABELS = new Map(INSTRUMENTS.map((i) => [i.id, `${i.base}/${i.quote}`]));
const PRECISIONS = new Map(INSTRUMENTS.map((i) => [i.id, i.pricePrecision]));

export function instrumentLabel(id: InstrumentId): string {
  return LABELS.get(id) ?? id;
}

export function instrumentPrecision(id: InstrumentId): number {
  return PRECISIONS.get(id) ?? 2;
}

