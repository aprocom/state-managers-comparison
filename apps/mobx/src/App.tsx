import { observer } from 'mobx-react-lite';
import { AppShell } from '@smc/ui';
import { appStore } from './state/store';
import { TerminalScreen } from './screens/TerminalScreen';
import { JournalScreen } from './screens/JournalScreen';

export const App = observer(function App() {
  return (
    <AppShell
      title="TraderCat Lite — MobX"
      screen={appStore.screen}
      onScreenChange={(next) => appStore.setScreen(next)}
      feedRate={appStore.feedRate}
      onFeedRateChange={(rate) => appStore.setFeedRate(rate)}
    >
      {appStore.screen === 'terminal' ? <TerminalScreen /> : <JournalScreen />}
    </AppShell>
  );
});
