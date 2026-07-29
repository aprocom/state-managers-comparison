import type { ReactNode } from 'react';
import { TESTID } from './testids';

// 1000/s is a stress rate, well past anything a real venue sends. Lighter
// rates turned out not to separate the implementations at all, so the high
// end is where the comparison has to look.
export const FEED_RATES = [10, 100, 1000];

export function AppShell(props: {
  title: string;
  screen: 'terminal' | 'journal';
  onScreenChange(next: 'terminal' | 'journal'): void;
  feedRate: number;
  onFeedRateChange(rate: number): void;
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <header className="shell__header">
        <h1 className="shell__title">{props.title}</h1>
        <nav className="shell__nav">
          <button
            data-testid={TESTID.navTerminal}
            aria-pressed={props.screen === 'terminal'}
            onClick={() => props.onScreenChange('terminal')}
          >
            Terminal
          </button>
          <button
            data-testid={TESTID.navJournal}
            aria-pressed={props.screen === 'journal'}
            onClick={() => props.onScreenChange('journal')}
          >
            Journal
          </button>
        </nav>
        <div className="shell__rates">
          {FEED_RATES.map((rate) => (
            <button
              key={rate}
              data-testid={TESTID.feedRate(rate)}
              aria-pressed={props.feedRate === rate}
              onClick={() => props.onFeedRateChange(rate)}
            >
              {rate}/s
            </button>
          ))}
        </div>
      </header>
      <main className="shell__main">{props.children}</main>
    </div>
  );
}
