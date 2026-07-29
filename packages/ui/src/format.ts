export function formatPrice(value: number, precision: number): string {
  return value.toFixed(precision);
}

/** Always signed — a bare "380" in a P&L column is ambiguous. */
export function formatSignedMoney(value: number): string {
  const sign = value < 0 ? '-' : '+';
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
