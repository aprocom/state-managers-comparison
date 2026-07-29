import { useDispatch, useSelector } from 'react-redux';
import { AppShell } from '@smc/ui';
import { feedRateSet, screenSet } from './state/slice';
import type { AppDispatch, RootState } from './state/slice';
import { TerminalScreen } from './screens/TerminalScreen';
import { JournalScreen } from './screens/JournalScreen';

export function App() {
  const dispatch = useDispatch<AppDispatch>();
  const screen = useSelector((state: RootState) => state.app.screen);
  const feedRate = useSelector((state: RootState) => state.app.feedRate);

  return (
    <AppShell
      title="TraderCat Lite — Redux Toolkit"
      screen={screen}
      onScreenChange={(next) => dispatch(screenSet(next))}
      feedRate={feedRate}
      onFeedRateChange={(rate) => dispatch(feedRateSet(rate))}
    >
      {screen === 'terminal' ? <TerminalScreen /> : <JournalScreen />}
    </AppShell>
  );
}
