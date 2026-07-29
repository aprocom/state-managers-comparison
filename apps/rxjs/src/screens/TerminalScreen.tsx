import { useEffect, useRef } from 'react';
import { INSTRUMENTS, START_PRICES, createFeed } from '@smc/domain';
import type { Feed } from '@smc/domain';
import { AccountSummary, AlertList, InstrumentTable, PositionsPanel, TESTID } from '@smc/ui';
import type { InstrumentId } from '@smc/domain';
import { appStore } from '../state/store';
import { useBehavior } from '../state/useBehavior';

// Hoisted so the prop identity is stable across renders. An inline arrow here
// changes on every render and defeats React.memo on all fifty rows, which
// would make this implementation look far slower than it is.
const selectInstrument = (id: InstrumentId) => appStore.selectInstrument(id);
const togglePin = (id: InstrumentId) => appStore.togglePin(id);

export function TerminalScreen() {
  const feedRate = useBehavior(appStore.feedRate$);
  const instrumentRows = useBehavior(appStore.instrumentRows$);
  const positionRows = useBehavior(appStore.positionRows$);
  const totals = useBehavior(appStore.accountTotals$);
  const alerts = useBehavior(appStore.alerts$);
  const selectedId = useBehavior(appStore.selectedInstrumentId$);
  const pinnedCount = useBehavior(appStore.pinnedCount$);

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
    const unsubscribe = feed.subscribe((quote) => appStore.applyQuote(quote));
    feed.start();
    return () => {
      feed.stop();
      unsubscribe();
      feedRef.current = null;
    };
  }, []);

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
