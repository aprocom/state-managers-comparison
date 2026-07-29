import { useEffect } from 'react';
import { INSTRUMENTS, START_PRICES, createFeed } from '@smc/domain';
import { AccountSummary, AlertList, InstrumentTable, PositionsPanel, TESTID } from '@smc/ui';
import { appStore } from '../state/store';
import { useBehavior } from '../state/useBehavior';

export function TerminalScreen() {
  const feedRate = useBehavior(appStore.feedRate$);
  const instrumentRows = useBehavior(appStore.instrumentRows$);
  const positionRows = useBehavior(appStore.positionRows$);
  const totals = useBehavior(appStore.accountTotals$);
  const alerts = useBehavior(appStore.alerts$);
  const selectedId = useBehavior(appStore.selectedInstrumentId$);

  useEffect(() => {
    const feed = createFeed({
      instruments: INSTRUMENTS,
      seed: 20260729,
      updatesPerSecond: feedRate,
      startPrices: START_PRICES,
    });
    const unsubscribe = feed.subscribe((quote) => appStore.applyQuote(quote));
    feed.start();
    return () => {
      feed.stop();
      unsubscribe();
    };
  }, [feedRate]);

  return (
    <div data-testid={TESTID.screenTerminal} className="terminal">
      <AlertList alerts={alerts} />
      <AccountSummary {...totals} />
      <PositionsPanel rows={positionRows} />
      <InstrumentTable
        rows={instrumentRows}
        selectedId={selectedId}
        onSelect={(id) => appStore.selectInstrument(id)}
      />
    </div>
  );
}
