import type { Decision, MarketView, Outcome, Phase } from './types';

// Phase is derived from onchain values and the latest block timestamp only.
// Boundaries mirror the contracts exactly:
//   CCIPStakeSender.stakeRemote    requires now <  reportCutoff         → open until cutoff
//   VoteMarket.stakeLocal          requires now <  lockTime             → open_local_only until lock
//   Settlement.propose             requires now >= lockTime + 30 days   → matured at maturity
//   Settlement.challenge           requires now <  proposedAt + period  → challenge window
//   Settlement.finalize            requires now >= proposedAt + period (unchallenged), or now > resultDeadline

export const THIRTY_DAYS = 30 * 24 * 3600;

/** Settlement.Outcome / RiskFiStakeVaultV2.Outcome enum: None, Yes, No, Void. */
export function outcomeFromEnum(n: number | bigint): Outcome | undefined {
  const v = Number(n);
  return v === 1 ? 'yes' : v === 2 ? 'no' : v === 3 ? 'void' : undefined;
}

export interface PhaseInput {
  now: number;
  lockTime: number;
  crossChainCutoff: number;
  decision?: Pick<Decision, 'outcome' | 'proposedAt' | 'challenged'>;
}

export function derivePhase({ now, lockTime, crossChainCutoff, decision }: PhaseInput): Phase {
  if (decision?.outcome === 'yes') return 'final_yes';
  if (decision?.outcome === 'no') return 'final_no';
  if (decision?.outcome === 'void') return 'void';
  if (decision && decision.proposedAt > 0) return decision.challenged ? 'challenged' : 'proposed';
  if (now >= lockTime + THIRTY_DAYS) return 'matured';
  if (now >= lockTime) return 'locked';
  if (now >= crossChainCutoff) return 'open_local_only';
  return 'open';
}

type Times = Pick<MarketView, 'challengePeriod' | 'resultDeadline' | 'decision' | 'phase'>;

export const isFinal = (p: Phase) => p === 'final_yes' || p === 'final_no' || p === 'void';
export const stakingOpen = (p: Phase) => p === 'open' || p === 'open_local_only';

/** End of the challenge window (exclusive): challenge allowed while now < this. */
export function challengeEnds(m: Times): number | undefined {
  return m.decision && m.decision.proposedAt > 0
    ? m.decision.proposedAt + m.challengePeriod
    : undefined;
}

export function canChallenge(m: Times, now: number): boolean {
  const end = challengeEnds(m);
  return m.phase === 'proposed' && end !== undefined && now < end;
}

/** Anyone may call finalize: after an unchallenged window, or after the result deadline (→ Void). */
export function canFinalize(m: Times, now: number): boolean {
  if (isFinal(m.phase)) return false;
  if (now > m.resultDeadline) return true;
  const end = challengeEnds(m);
  return m.phase === 'proposed' && end !== undefined && now >= end;
}

/** The next deadline a card should count down to, with a label. */
export function nextDeadline(
  m: Pick<MarketView, 'phase' | 'crossChainCutoff' | 'lockTime' | 'maturity' | 'resultDeadline' | 'challengePeriod' | 'decision'>,
): { label: string; at: number } | undefined {
  switch (m.phase) {
    case 'open':
      return { label: 'Cross-chain stakes close', at: m.crossChainCutoff };
    case 'open_local_only':
      return { label: 'Stakes lock', at: m.lockTime };
    case 'locked':
      return { label: 'Maturity', at: m.maturity };
    case 'matured':
      return { label: 'Result deadline', at: m.resultDeadline };
    case 'proposed': {
      const end = challengeEnds(m);
      return end ? { label: 'Challenge window ends', at: end } : undefined;
    }
    case 'challenged':
      return { label: 'Result deadline', at: m.resultDeadline };
    default:
      return undefined;
  }
}
