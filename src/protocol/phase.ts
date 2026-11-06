import type { Decision, MarketView, Outcome, Phase } from './types';

// Phase is derived from onchain values and the latest block timestamp only.
// Boundaries mirror the contracts exactly:
//   CCIPStakeSender(V2).stakeRemote  requires now <  reportCutoff         → open until cutoff
//   VoteMarket.stakeLocal / vault.stake requires now < lockTime           → open_local_only until lock
//   Settlement.propose / vault.propose requires now >= lockTime + 30 days → matured at maturity
//   challenge                         requires now <  proposedAt + period → challenge window
//   finalize                          requires now >= proposedAt + period (unchallenged), or now > resultDeadline
//
// The V2 gates below are separate on purpose: remote send, local stake, trading, LP exit/yield,
// principal claims and finalization each close at a different time.

export const THIRTY_DAYS = 30 * 24 * 3600;
/** RiskFiStakeVaultV2.claimPrincipal / claimFee: allowed while now <= finalizedAt + 90 days. */
export const CLAIM_WINDOW = 90 * 24 * 3600;

/** Settlement.Outcome / RiskFiStakeVaultV2.Outcome enum: None, Yes, No, Void. */
export function outcomeFromEnum(n: number | bigint): Outcome | undefined {
  const v = Number(n);
  return v === 1 ? 'yes' : v === 2 ? 'no' : v === 3 ? 'void' : undefined;
}
export const outcomeToEnum = (o: Outcome): number => (o === 'yes' ? 1 : o === 'no' ? 2 : 3);

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
export function challengeEnds(m: Pick<MarketView, 'challengePeriod' | 'decision'>): number | undefined {
  return m.decision && m.decision.proposedAt > 0 ? m.decision.proposedAt + m.challengePeriod : undefined;
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

// ------------------------------------------------------------------------------- V2 gates

/**
 * Remote sends close at CCIPStakeSenderV2.reportCutoff(id) (the contract's check) and at the
 * registry's published crossChainCutoff, whichever is earlier. Undefined: no cutoff configured.
 */
export function remoteCutoffOf(m: Pick<MarketView, 'remoteCutoff' | 'crossChainCutoff'>): number | undefined {
  if (!m.remoteCutoff) return undefined;
  return Math.min(m.remoteCutoff, m.crossChainCutoff);
}

/** stakeRemote requires reportCutoff != 0 && now < reportCutoff (Arbitrum Sepolia block time). */
export function remoteSendOpen(m: Pick<MarketView, 'remoteCutoff' | 'crossChainCutoff' | 'series'>, now: number): boolean {
  const cutoff = remoteCutoffOf(m);
  return m.series !== false && cutoff !== undefined && now < cutoff;
}

/** vault.stake / stakeFromREP: id == vault.reportId() && now < lockTime. */
export function localStakeOpen(m: Pick<MarketView, 'lockTime' | 'series'>, now: number): boolean {
  return m.series !== false && now < m.lockTime;
}

/** YieldCurveHookV2.beforeSwap and addLiquidity require now < maturity. Trading is NOT closed at lock. */
export function tradingOpen(m: Pick<MarketView, 'maturity' | 'market'>, now: number): boolean {
  return now < (m.market?.maturity || m.maturity);
}

/** removeLiquidity, claimLPYield and yt.claimYield have no time gate. */
export const lpExitOpen = () => true;

export function claimsCloseAt(m: Pick<MarketView, 'decision'>): number | undefined {
  const f = m.decision?.finalizedAt;
  return f ? f + CLAIM_WINDOW : undefined;
}

/** vault.claimPrincipal: finalOutcome != None && now <= finalizedAt + 90 days. */
export function claimPrincipalOpen(m: Pick<MarketView, 'decision'>, now: number): boolean {
  const end = claimsCloseAt(m);
  return !!m.decision?.outcome && end !== undefined && now <= end;
}

export function claimsExpired(m: Pick<MarketView, 'decision'>, now: number): boolean {
  const end = claimsCloseAt(m);
  return !!m.decision?.outcome && end !== undefined && now > end;
}

/** vault.propose (resolver only): proposedAt == 0 && maturity <= now <= resultDeadline. */
export function canPropose(m: Pick<MarketView, 'decision' | 'maturity' | 'resultDeadline' | 'series'>, now: number): boolean {
  if (m.series === false || (m.decision && (m.decision.proposedAt > 0 || m.decision.finalizedAt))) return false;
  return now >= m.maturity && now <= m.resultDeadline;
}

/** vault.adjudicate (adjudicator only): challenged && finalizedAt == 0 && now <= resultDeadline. */
export function canAdjudicate(m: Pick<MarketView, 'decision' | 'resultDeadline'>, now: number): boolean {
  return !!m.decision?.challenged && !m.decision.finalizedAt && now <= m.resultDeadline;
}

/** vault.injectYield: something staked && now < maturity (simulated yield, demo only). */
export function canInjectYield(m: Pick<MarketView, 'totals' | 'maturity' | 'series'>, now: number): boolean {
  return m.series !== false && m.totals.yes + m.totals.no > 0n && now < m.maturity;
}

/** vault.claimFee: final Yes/No, not yet claimed, within the claim window. Pays the treasury. */
export function canClaimFee(m: Pick<MarketView, 'decision' | 'feeClaimed'>, now: number): boolean {
  const o = m.decision?.outcome;
  return (o === 'yes' || o === 'no') && !m.feeClaimed && claimPrincipalOpen(m, now);
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
    default: {
      const end = claimsCloseAt(m);
      return end ? { label: 'Claims close', at: end } : undefined;
    }
  }
}
