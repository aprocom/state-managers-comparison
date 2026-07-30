import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { createAppFeed } from '@smc/domain';
import type { Feed } from '@smc/domain';
import { INITIAL_FEED_RATE, AccountSummary, AlertList, InstrumentTable, PositionsPanel, TESTID } from '@smc/ui';
import type { InstrumentId } from '@smc/domain';
import { appStore, attachAlertEngine } from '../state/store';

// Hoisted for a stable prop identity — see the note in the RxJS screen.
const selectInstrument = (id: InstrumentId) => appStore.selectInstrument(id);
const togglePin = (id: InstrumentId) => appStore.togglePin(id);

export const TerminalScreen = observer(function TerminalScreen() {
  // The list renders the *current* alert set straight from the store. Driving
  // it from onFire — which is a one-shot notification for newly triggered
  // alerts — meant a cleared alert stayed on screen forever, because nothing
  // fires on the way out. All five apps now render current state and use
  // onFire only for the fired counter.
  const [firedCount, setFiredCount] = useState(0);

  useEffect(
    () => attachAlertEngine(appStore, () => { setFiredCount((count) => count + 1); }),
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
    const unsubscribe = feed.subscribe((quote) => appStore.applyQuote(quote));
    feed.start();
    return () => {
      feed.stop();
      unsubscribe();
      feedRef.current = null;
    };
  }, []);

  // `feedRate` is read here so the observer re-runs the component when it
  // changes; the effect then pushes it into the running feed. Listing an
  // observable in a dependency array would not work — MobX invalidates the
  // render, not the array.
  const { feedRate } = appStore;
  useEffect(() => {
    feedRef.current?.setRate(feedRate);
  }, [feedRate]);

  return (
    <div data-testid={TESTID.screenTerminal} className="terminal">
      <AlertList alerts={appStore.alerts} firedCount={firedCount} />
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
