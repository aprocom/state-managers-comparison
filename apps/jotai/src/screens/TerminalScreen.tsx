import { useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { INSTRUMENTS, START_PRICES, createFeed } from '@smc/domain';
import type { Alert } from '@smc/domain';
import { AccountSummary, AlertList, InstrumentTable, PositionsPanel, TESTID } from '@smc/ui';
import {
  accountTotalsAtom, alertsAtom, applyQuoteAtom, feedRateAtom, instrumentRowsAtom,
  positionRowsAtom, selectedInstrumentIdAtom,
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

  const [firedAlerts, setFiredAlerts] = useState<Alert[]>(() => appStore.get(alertsAtom));

  useEffect(
    () => attachAlertEngine(appStore, () => { setFiredAlerts(appStore.get(alertsAtom)); }),
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
      <AlertList alerts={firedAlerts} />
      <AccountSummary {...totals} />
      <PositionsPanel rows={positionRows} />
      <InstrumentTable rows={instrumentRows} selectedId={selectedId} onSelect={setSelected} />
    </div>
  );
}
