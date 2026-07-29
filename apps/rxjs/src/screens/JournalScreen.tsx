import { INSTRUMENTS, STRATEGIES } from '@smc/domain';
import { EquityChart, FilterBar, JournalTable, StatsPanel, TESTID } from '@smc/ui';
import { appStore } from '../state/store';
import { useBehavior } from '../state/useBehavior';

const INSTRUMENT_IDS = INSTRUMENTS.map((instrument) => instrument.id);

// Hoisted, not inline — see the note in the MobX screen. Same bug, same fix.
const handleEdit = (id: string, patch: { strategy?: string; note?: string }) => {
  appStore.editTrade(id, patch);
};

export function JournalScreen() {
  const filter = useBehavior(appStore.filter$);
  const rows = useBehavior(appStore.journalRows$);
  const stats = useBehavior(appStore.journalStats$);
  const curve = useBehavior(appStore.equityCurve$);

  return (
    <div data-testid={TESTID.screenJournal} className="journal">
      <FilterBar
        filter={filter}
        strategies={STRATEGIES}
        instrumentIds={INSTRUMENT_IDS}
        onChange={(next) => appStore.setFilter(next)}
      />
      <StatsPanel {...stats} />
      <EquityChart points={curve} />
      <JournalTable
        rows={rows}
        strategies={STRATEGIES}
        onEdit={handleEdit}
      />
    </div>
  );
}
