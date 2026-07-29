import type { EquityPoint } from '@smc/domain';
import { TESTID } from './testids';

const WIDTH = 640;
const HEIGHT = 180;

/**
 * Hand-rolled SVG rather than a charting library: a chart dependency would
 * land in every app's bundle and distort the per-implementation size metric.
 */
export function EquityChart({ points }: { points: EquityPoint[] }) {
  if (points.length < 2) {
    return <svg data-testid={TESTID.equityChart} width={WIDTH} height={HEIGHT} />;
  }

  const equities = points.map((point) => point.equity);
  const min = Math.min(...equities);
  const max = Math.max(...equities);
  const span = max - min || 1;

  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * WIDTH;
      const y = HEIGHT - ((point.equity - min) / span) * HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg data-testid={TESTID.equityChart} width={WIDTH} height={HEIGHT} className="chart">
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
