import { useEffect } from 'react';
import { INSTRUMENTS, START_PRICES, createFeed } from '@smc/domain';
import { AccountSummary, AlertList, InstrumentTable, PositionsPanel, TESTID } from '@smc/ui';
import { appStore, useAppStore } from '../state/store';
import { attachAlertEngine } from '../state/alertEngine';
import { selectAccountTotals, selectInstrumentRows, selectPositionRows } from '../state/selectors';

export function TerminalScreen() {
  const feedRate = useAppStore((state) => state.feedRate);
  const applyQuote = useAppStore((state) => state.applyQuote);
  const selectedId = useAppStore((state) => state.selectedInstrumentId);
  const selectInstrument = useAppStore((state) => state.selectInstrument);

  const instrumentRows = useAppStore(selectInstrumentRows);
  const positionRows = useAppStore(selectPositionRows);
  const totals = useAppStore(selectAccountTotals);
  const alerts = useAppStore((state) => state.alerts);

  useEffect(
    () => attachAlertEngine(appStore, { now: () => Date.now(), onFire: () => {} }),
    [],
  );

  useEffect(() => {
    const feed = createFeed({
      instruments: INSTRUMENTS,
      seed: 20260729,
      updatesPerSecond: feedRate,
      startPrices: START_PRICES,
    });
    const unsubscribe = feed.subscribe(applyQuote);
    feed.start();
    return () => {
      feed.stop();
      unsubscribe();
    };
  }, [feedRate, applyQuote]);

  return (
    <div data-testid={TESTID.screenTerminal} className="terminal">
      <AlertList alerts={alerts} />
      <AccountSummary {...totals} />
      <PositionsPanel rows={positionRows} />
      <InstrumentTable rows={instrumentRows} selectedId={selectedId} onSelect={selectInstrument} />
    </div>
  );
}
