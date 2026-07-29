import { useDispatch, useSelector } from 'react-redux';
import { INSTRUMENTS, STRATEGIES } from '@smc/domain';
import { EquityChart, FilterBar, JournalTable, StatsPanel, TESTID } from '@smc/ui';
import { filterSet, tradeEdited } from '../state/slice';
import type { AppDispatch, RootState } from '../state/slice';
import { selectEquityCurve, selectJournalRows, selectJournalStats } from '../state/selectors';

const INSTRUMENT_IDS = INSTRUMENTS.map((instrument) => instrument.id);

export function JournalScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const filter = useSelector((state: RootState) => state.app.filter);
  const rows = useSelector(selectJournalRows);
  const stats = useSelector(selectJournalStats);
  const curve = useSelector(selectEquityCurve);

  return (
    <div data-testid={TESTID.screenJournal} className="journal">
      <FilterBar
        filter={filter}
        strategies={STRATEGIES}
        instrumentIds={INSTRUMENT_IDS}
        onChange={(next) => dispatch(filterSet(next))}
      />
      <StatsPanel {...stats} />
      <EquityChart points={curve} />
      <JournalTable
        rows={rows}
        strategies={STRATEGIES}
        onEdit={(id, patch) => dispatch(tradeEdited({ id, patch }))}
      />
    </div>
  );
}
