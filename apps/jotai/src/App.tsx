import { useAtom } from 'jotai';
import { AppShell } from '@smc/ui';
import { feedRateAtom, screenAtom } from './state/atoms';
import { TerminalScreen } from './screens/TerminalScreen';
import { JournalScreen } from './screens/JournalScreen';

export function App() {
  const [screen, setScreen] = useAtom(screenAtom);
  const [feedRate, setFeedRate] = useAtom(feedRateAtom);

  return (
    <AppShell
      title="TraderCat Lite — Jotai"
      screen={screen}
      onScreenChange={setScreen}
      feedRate={feedRate}
      onFeedRateChange={setFeedRate}
    >
      {screen === 'terminal' ? <TerminalScreen /> : <JournalScreen />}
    </AppShell>
  );
}
