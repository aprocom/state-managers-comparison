import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { INSTRUMENTS, START_PRICES, createFeed } from '@smc/domain';
import type { Feed } from '@smc/domain';
import type { Alert } from '@smc/domain';
import { AccountSummary, AlertList, InstrumentTable, PositionsPanel, TESTID } from '@smc/ui';
import type { InstrumentId } from '@smc/domain';
import { appStore, attachAlertEngine } from '../state/store';

// Hoisted for a stable prop identity — see the note in the RxJS screen.
const selectInstrument = (id: InstrumentId) => appStore.selectInstrument(id);
const togglePin = (id: InstrumentId) => appStore.togglePin(id);

export const TerminalScreen = observer(function TerminalScreen() {
  const [firedAlerts, setFiredAlerts] = useState<Alert[]>([]);

  useEffect(
    () => attachAlertEngine(appStore, () => { setFiredAlerts(appStore.alerts.slice()); }),
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
      updatesPerSecond: appStore.feedRate,
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
    feedRef.current?.setRate(appStore.feedRate);
  }, [appStore.feedRate]);

  return (
    <div data-testid={TESTID.screenTerminal} className="terminal">
      <AlertList alerts={firedAlerts} />
      <AccountSummary {...appStore.accountTotals} pinnedCount={appStore.pinnedCount} />
      <PositionsPanel rows={appStore.positionRows} />
      <InstrumentTable
        rows={appStore.instrumentRows}
        selectedId={appStore.selectedInstrumentId}
        onSelect={selectInstrument}
        onTogglePin={togglePin}
      />
    </div>
  );
});
