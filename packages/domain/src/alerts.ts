import { realizedPnl } from './calculations';
import type { Position, Trade } from './types';

export const TILT_WINDOW_MS = 30 * 60 * 1000;
export const TILT_LOSS_STREAK = 4;
export const TIME_IN_TRADE_FACTOR = 3;

export type AlertKind =
  | 'daily-loss-limit'
  | 'risk-per-trade'
  | 'tilt'
  | 'time-in-trade';

export interface Alert {
  kind: AlertKind;
  /** Position id, or 'account' for account-wide rules. */
  subjectId: string;
  message: string;
}

export interface OpenPositionSnapshot {
  position: Position;
  holdingMs: number;
}

export interface AlertContext {
  now: number;
  dailyPnl: number;
  /** Positive number. The rule fires when dailyPnl <= -dailyLossLimit. */
  dailyLossLimit: number;
  riskLimitPerTrade: number;
  /** Sorted by closedAt descending. */
  recentClosedTrades: Trade[];
  openPositions: OpenPositionSnapshot[];
  avgHoldingMs: number;
}

/**
 * Pure predicate shared by every implementation. Deciding *when* to call this
 * and how to fire each alert exactly once per transition is the state layer's
 * job, and is precisely what the comparison measures.
 */
/**
 * The identity of an alert across time: the same rule firing about the same
 * subject is the same alert. Every implementation needs this to fire once per
 * transition rather than once per evaluation, so it is a domain fact, not a
 * storage detail — it lived in all five state layers until it was not.
 */
export function alertKey(alert: Alert): string {
  return `${alert.kind}:${alert.subjectId}`;
}

export function evaluateAlerts(context: AlertContext): Alert[] {
  const alerts: Alert[] = [];

  if (context.dailyPnl <= -context.dailyLossLimit) {
    alerts.push({
      kind: 'daily-loss-limit',
      subjectId: 'account',
      message: `Daily loss limit reached: ${context.dailyPnl.toFixed(2)} of -${context.dailyLossLimit}`,
    });
  }

  for (const { position } of context.openPositions) {
    if (position.riskAmount > context.riskLimitPerTrade) {
      alerts.push({
        kind: 'risk-per-trade',
        subjectId: position.id,
        message: `${position.instrumentId} risks ${position.riskAmount} over a ${context.riskLimitPerTrade} limit`,
      });
    }
  }

  let streak = 0;
  for (const trade of context.recentClosedTrades) {
    if (context.now - trade.closedAt > TILT_WINDOW_MS) break;
    if (realizedPnl(trade) >= 0) break;
    streak += 1;
  }
  if (streak >= TILT_LOSS_STREAK) {
    alerts.push({
      kind: 'tilt',
      subjectId: 'account',
      message: `${streak} losing trades in a row within ${TILT_WINDOW_MS / 60000} minutes`,
    });
  }

  if (context.avgHoldingMs > 0) {
    for (const { position, holdingMs } of context.openPositions) {
      if (holdingMs > context.avgHoldingMs * TIME_IN_TRADE_FACTOR) {
        alerts.push({
          kind: 'time-in-trade',
          subjectId: position.id,
          message: `${position.instrumentId} has been open ${(holdingMs / context.avgHoldingMs).toFixed(1)}x your average`,
        });
      }
    }
  }

  return alerts;
}
