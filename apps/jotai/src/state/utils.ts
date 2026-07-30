import { INSTRUMENTS } from '@smc/domain';
import type { Instrument, InstrumentId } from '@smc/domain';

const INSTRUMENT_BY_ID = new Map(INSTRUMENTS.map((instrument) => [instrument.id, instrument]));

/**
 * Returns the instrument itself rather than a label and a precision separately.
 * The row atom recomputes on every quote for its instrument, so two lookups
 * where one would do is measured work in an implementation whose CPU number
 * this project publishes.
 */
export function instrumentById(id: InstrumentId): Instrument | undefined {
  return INSTRUMENT_BY_ID.get(id);
}

