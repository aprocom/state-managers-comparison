import { AppShell } from '@smc/ui';
import { appStore } from './state/store';
import { useBehavior } from './state/useBehavior';
import { TerminalScreen } from './screens/TerminalScreen';
import { JournalScreen } from './screens/JournalScreen';

export function App() {
  const screen = useBehavior(appStore.screen$);
  const feedRate = useBehavior(appStore.feedRate$);

  return (
    <AppShell
      title="TraderCat Lite — RxJS"
      screen={screen}
      onScreenChange={(next) => appStore.setScreen(next)}
      feedRate={feedRate}
      onFeedRateChange={(rate) => appStore.setFeedRate(rate)}
    >
      {screen === 'terminal' ? <TerminalScreen /> : <JournalScreen />}
    </AppShell>
  );
}
