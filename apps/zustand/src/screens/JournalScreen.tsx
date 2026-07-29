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
