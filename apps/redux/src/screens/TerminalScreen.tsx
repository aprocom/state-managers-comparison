import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NOW, createAppFeed } from '@smc/domain';
import type { Feed } from '@smc/domain';
import type { Alert, InstrumentId } from '@smc/domain';
import { INITIAL_FEED_RATE, AccountSummary, AlertList, InstrumentTable, PositionsPanel, TESTID } from '@smc/ui';
import { appStore, instrumentSelected, pinToggled, quoteApplied } from '../state/slice';
import type { AppDispatch, RootState } from '../state/slice';
import {
  selectAccountTotals, selectInstrumentRows, selectPinnedCount, selectPositionRows,
} from '../state/selectors';
import { attachAlertEngine } from '../state/alertEngine';

export function TerminalScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const feedRate = useSelector((state: RootState) => state.app.feedRate);
  const selectedId = useSelector((state: RootState) => state.app.selectedInstrumentId);
  const instrumentRows = useSelector(selectInstrumentRows);
  const positionRows = useSelector(selectPositionRows);
  const totals = useSelector(selectAccountTotals);
  const pinnedCount = useSelector(selectPinnedCount);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [firedCount, setFiredCount] = useState(0);

  // Stable prop identity. An inline arrow would change every render and defeat
  // React.memo on all fifty rows, misreporting Redux as far slower than it is.
  const onTogglePin = useCallback(
    (id: InstrumentId) => { dispatch(pinToggled(id)); },
    [dispatch],
  );

  const onSelect = useCallback(
    (id: InstrumentId) => dispatch(instrumentSelected(id)),
    [dispatch],
  );

  useEffect(
    () => attachAlertEngine(appStore, {
      now: () => NOW,
      onFire: () => { setFiredCount((count) => count + 1); },
      onChange: setAlerts,
    }),
    [],
  );

  const feedRef = useRef<Feed | null>(null);

  // The feed is created once and its rate is mutated in place. Rebuilding it on
  // every rate change restarted its sequence counter while the store kept the
  // last sequence it had seen, so the store's staleness guard silently dropped
  // the next N quotes per instrument.
  useEffect(() => {
    const feed = createAppFeed(INITIAL_FEED_RATE);
    feedRef.current = feed;
    const unsubscribe = feed.subscribe((quote) => dispatch(quoteApplied(quote)));
    feed.start();
    return () => {
      feed.stop();
      unsubscribe();
      feedRef.current = null;
    };
  }, [dispatch]);

  useEffect(() => {
    feedRef.current?.setRate(feedRate);
  }, [feedRate]);

  return (
    <div data-testid={TESTID.screenTerminal} className="terminal">
      <AlertList alerts={alerts} firedCount={firedCount} />
      <AccountSummary {...totals} pinnedCount={pinnedCount} />
      <PositionsPanel rows={positionRows} />
      <InstrumentTable
        rows={instrumentRows}
        selectedId={selectedId}
        onSelect={onSelect}
        onTogglePin={onTogglePin}
      />
    </div>
  );
}
