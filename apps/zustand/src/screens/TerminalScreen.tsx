import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { INSTRUMENTS, START_PRICES, createFeed } from '@smc/domain';
import type { Feed } from '@smc/domain';
import { AccountSummary, AlertList, InstrumentTable, PositionsPanel, TESTID } from '@smc/ui';
import { NOW, appStore, useAppStore } from '../state/store';
import { attachAlertEngine } from '../state/alertEngine';
import {
  selectAccountTotals, selectInstrumentRows, selectPinnedCount, selectPositionRows,
} from '../state/selectors';

export function TerminalScreen() {
  const feedRate = useAppStore((state) => state.feedRate);
  const applyQuote = useAppStore((state) => state.applyQuote);
  const selectedId = useAppStore((state) => state.selectedInstrumentId);
  const selectInstrument = useAppStore((state) => state.selectInstrument);
  const togglePin = useAppStore((state) => state.togglePin);

  // useShallow is Zustand's own answer to "my selector returns a new array
  // every time": the selector still runs, but the component only re-renders
  // when the shallow contents actually differ.
  const instrumentRows = useAppStore(useShallow(selectInstrumentRows));
  const positionRows = useAppStore(useShallow(selectPositionRows));
  const totals = useAppStore(useShallow(selectAccountTotals));
  const pinnedCount = useAppStore(selectPinnedCount);
  const alerts = useAppStore((state) => state.alerts);

  useEffect(
    () => attachAlertEngine(appStore, { now: () => NOW, onFire: () => {} }),
    [],
  );

  const feedRef = useRef<Feed | null>(null);

  // The feed is created once and its rate is mutated in place. Rebuilding it on
  // every rate change restarted its sequence counter while the store kept the
  // last sequence it had seen, so the store's staleness guard silently dropped
  // the next N quotes per instrument.
  useEffect(() => {
    const feed = createFeed({
      instruments: INSTRUMENTS,
      seed: 20260729,
      updatesPerSecond: feedRate,
      startPrices: START_PRICES,
    });
    feedRef.current = feed;
    const unsubscribe = feed.subscribe(applyQuote);
    feed.start();
    return () => {
      feed.stop();
      unsubscribe();
      feedRef.current = null;
    };
  }, [applyQuote]);

  useEffect(() => {
    feedRef.current?.setRate(feedRate);
  }, [feedRate]);

  return (
    <div data-testid={TESTID.screenTerminal} className="terminal">
      <AlertList alerts={alerts} />
      <AccountSummary {...totals} pinnedCount={pinnedCount} />
      <PositionsPanel rows={positionRows} />
      <InstrumentTable
        rows={instrumentRows}
        selectedId={selectedId}
        onSelect={selectInstrument}
        onTogglePin={togglePin}
      />
    </div>
  );
}
