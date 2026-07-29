import { observer } from 'mobx-react-lite';
import { INSTRUMENTS, STRATEGIES } from '@smc/domain';
import { EquityChart, FilterBar, JournalTable, StatsPanel, TESTID } from '@smc/ui';
import { appStore } from '../state/store';

const INSTRUMENT_IDS = INSTRUMENTS.map((instrument) => instrument.id);

export const JournalScreen = observer(function JournalScreen() {
  return (
    <div data-testid={TESTID.screenJournal} className="journal">
      <FilterBar
        filter={appStore.filter}
        strategies={STRATEGIES}
        instrumentIds={INSTRUMENT_IDS}
        onChange={(next) => appStore.setFilter(next)}
      />
      <StatsPanel {...appStore.journalStats} />
      <EquityChart points={appStore.equityCurve} />
      <JournalTable
        rows={appStore.journalRows}
        strategies={STRATEGIES}
        onEdit={(id, patch) => appStore.editTrade(id, patch)}
      />
    </div>
  );
});
