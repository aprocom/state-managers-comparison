import type { InstrumentId, JournalFilter, Side } from '@smc/domain';
import { TESTID } from './testids';

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
