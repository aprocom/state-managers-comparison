import { AppShell } from '@smc/ui';
import { useAppStore } from './state/store';
import { TerminalScreen } from './screens/TerminalScreen';
import { JournalScreen } from './screens/JournalScreen';

export function App() {
  const screen = useAppStore((state) => state.screen);
  const setScreen = useAppStore((state) => state.setScreen);
  const feedRate = useAppStore((state) => state.feedRate);
  const setFeedRate = useAppStore((state) => state.setFeedRate);

  return (
    <AppShell
      title="TraderCat Lite — Zustand"
      screen={screen}
      onScreenChange={setScreen}
      feedRate={feedRate}
      onFeedRateChange={setFeedRate}
    >
      {screen === 'terminal' ? <TerminalScreen /> : <JournalScreen />}
    </AppShell>
  );
}
