import { useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { INSTRUMENTS, START_PRICES, createFeed } from '@smc/domain';
import type { Feed } from '@smc/domain';
import type { Alert } from '@smc/domain';
import { AccountSummary, AlertList, InstrumentTable, PositionsPanel, TESTID } from '@smc/ui';
import {
  accountTotalsAtom, alertsAtom, applyQuoteAtom, feedRateAtom, instrumentRowsAtom,
  pinnedCountAtom, positionRowsAtom, selectedInstrumentIdAtom, togglePinAtom,
} from '../state/atoms';
import { appStore, attachAlertEngine } from '../state/store';

export function TerminalScreen() {
  const feedRate = useAtomValue(feedRateAtom);
  const instrumentRows = useAtomValue(instrumentRowsAtom);
  const positionRows = useAtomValue(positionRowsAtom);
  const totals = useAtomValue(accountTotalsAtom);
  const selectedId = useAtomValue(selectedInstrumentIdAtom);
  const setSelected = useSetAtom(selectedInstrumentIdAtom);
  const applyQuote = useSetAtom(applyQuoteAtom);
  const togglePin = useSetAtom(togglePinAtom);
  const pinnedCount = useAtomValue(pinnedCountAtom);

  const [firedAlerts, setFiredAlerts] = useState<Alert[]>(() => appStore.get(alertsAtom));

  useEffect(
    () => attachAlertEngine(appStore, () => { setFiredAlerts(appStore.get(alertsAtom)); }),
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
      <AlertList alerts={firedAlerts} />
      <AccountSummary {...totals} pinnedCount={pinnedCount} />
      <PositionsPanel rows={positionRows} />
      <InstrumentTable
        rows={instrumentRows}
        selectedId={selectedId}
        onSelect={setSelected}
        onTogglePin={togglePin}
      />
    </div>
  );
}
