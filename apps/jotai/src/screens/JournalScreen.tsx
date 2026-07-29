import { useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { INSTRUMENTS, STRATEGIES } from '@smc/domain';
import { EquityChart, FilterBar, JournalTable, StatsPanel, TESTID } from '@smc/ui';
import {
  editTradeAtom, equityCurveAtom, filterAtom, journalRowsAtom, journalStatsAtom,
} from '../state/atoms';

const INSTRUMENT_IDS = INSTRUMENTS.map((instrument) => instrument.id);

export function JournalScreen() {
  const [filter, setFilter] = useAtom(filterAtom);
  const rows = useAtomValue(journalRowsAtom);
  const stats = useAtomValue(journalStatsAtom);
  const curve = useAtomValue(equityCurveAtom);
  const editTrade = useSetAtom(editTradeAtom);
  // Stable identity: JournalTable forwards this to a memoised JournalRow.
  const handleEdit = useCallback(
    (id: string, patch: { strategy?: string; note?: string }) => { editTrade(id, patch); },
    [editTrade],
  );

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
      <JournalTable
        rows={rows}
        strategies={STRATEGIES}
        onEdit={handleEdit}
      />
    </div>
  );
}
