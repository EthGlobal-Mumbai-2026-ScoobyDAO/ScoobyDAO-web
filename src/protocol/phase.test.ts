import { describe, expect, it } from 'vitest';
import {
  canAdjudicate,
  canChallenge,
  canClaimFee,
  canFinalize,
  canInjectYield,
  canPropose,
  challengeEnds,
  CLAIM_WINDOW,
  claimPrincipalOpen,
  claimsCloseAt,
  claimsExpired,
  derivePhase,
  localStakeOpen,
  lpExitOpen,
  nextDeadline,
  remoteCutoffOf,
  remoteSendOpen,
  THIRTY_DAYS,
  tradingOpen,
} from './phase';
import type { MarketView } from './types';

const LOCK = 1_800_000_000;
const CUTOFF = LOCK - 86_400;
const MATURITY = LOCK + THIRTY_DAYS;
const at = (now: number, decision?: Parameters<typeof derivePhase>[0]['decision']) =>
  derivePhase({ now, lockTime: LOCK, crossChainCutoff: CUTOFF, decision });

describe('derivePhase boundaries (mirror the contract require()s)', () => {
  it('cutoff − 1 is open (CCIPStakeSender requires now < cutoff)', () => expect(at(CUTOFF - 1)).toBe('open'));
  it('cutoff is open_local_only', () => expect(at(CUTOFF)).toBe('open_local_only'));
  it('lock − 1 is still open for local stakes (VoteMarket requires now < lockTime)', () => expect(at(LOCK - 1)).toBe('open_local_only'));
  it('lock is locked', () => expect(at(LOCK)).toBe('locked'));
  it('maturity − 1 is locked', () => expect(at(MATURITY - 1)).toBe('locked'));
  it('maturity is matured (Settlement.propose requires now >= lockTime + 30 days)', () => expect(at(MATURITY)).toBe('matured'));
  it('a proposal makes it proposed; a challenge makes it challenged', () => {
    expect(at(MATURITY + 10, { proposedAt: MATURITY + 5, challenged: false })).toBe('proposed');
    expect(at(MATURITY + 10, { proposedAt: MATURITY + 5, challenged: true })).toBe('challenged');
  });
  it('final outcomes win over everything', () => {
    expect(at(MATURITY + 10, { outcome: 'yes', proposedAt: 1, challenged: false })).toBe('final_yes');
    expect(at(MATURITY + 10, { outcome: 'no', proposedAt: 1, challenged: true })).toBe('final_no');
    expect(at(MATURITY + 10, { outcome: 'void', proposedAt: 0, challenged: false })).toBe('void');
  });
});

describe('challenge window edge (proposedAt + challengePeriod)', () => {
  const proposedAt = MATURITY + 100;
  const period = 86_400;
  const m = (now: number, challenged = false) =>
    ({
      phase: at(now, { proposedAt, challenged }),
      challengePeriod: period,
      resultDeadline: LOCK + 33 * 86_400,
      decision: { proposedAt, challenged, evidenceHash: '0x01' },
    }) as Pick<MarketView, 'phase' | 'challengePeriod' | 'resultDeadline' | 'decision'>;
  const end = proposedAt + period;

  it('challengeEnds = proposedAt + challengePeriod', () => expect(challengeEnds(m(end))).toBe(end));
  it('end − 1: challenge allowed, finalize not', () => {
    expect(canChallenge(m(end - 1), end - 1)).toBe(true);
    expect(canFinalize(m(end - 1), end - 1)).toBe(false);
  });
  it('exactly at end: challenge closed (now < end fails), finalize allowed (now >= end)', () => {
    expect(canChallenge(m(end), end)).toBe(false);
    expect(canFinalize(m(end), end)).toBe(true);
  });
  it('challenged: only the adjudicator settles before the deadline', () => {
    expect(canFinalize(m(end + 10, true), end + 10)).toBe(false);
  });
  it('after the result deadline anyone can finalize (→ Void), even without a proposal', () => {
    const late = LOCK + 33 * 86_400 + 1;
    expect(canFinalize({ phase: 'matured', challengePeriod: period, resultDeadline: late - 1 }, late)).toBe(true);
    expect(canFinalize({ phase: 'matured', challengePeriod: period, resultDeadline: late - 1 }, late - 1)).toBe(false);
  });
});

describe('nextDeadline', () => {
  const base = { crossChainCutoff: CUTOFF, lockTime: LOCK, maturity: MATURITY, resultDeadline: LOCK + 33 * 86_400, challengePeriod: 60 };
  it('points at the right deadline per phase', () => {
    expect(nextDeadline({ ...base, phase: 'open' })?.at).toBe(CUTOFF);
    expect(nextDeadline({ ...base, phase: 'open_local_only' })?.at).toBe(LOCK);
    expect(nextDeadline({ ...base, phase: 'locked' })?.at).toBe(MATURITY);
    expect(nextDeadline({ ...base, phase: 'proposed', decision: { proposedAt: 10, challenged: false, evidenceHash: '0x' } })?.at).toBe(70);
    expect(nextDeadline({ ...base, phase: 'void' })).toBeUndefined();
  });
});

describe('V2 gates are separate (§3.7), each at its contract boundary', () => {
  // Report #1's real schedule (bundle snapshot, used only for tests).
  const CUT = 1_794_123_840;
  const LOCK_ = 1_794_210_240;
  const MAT = LOCK_ + THIRTY_DAYS;
  const DEADLINE = 1_797_147_840;
  const base = {
    series: true,
    remoteCutoff: CUT,
    crossChainCutoff: CUT,
    lockTime: LOCK_,
    maturity: MAT,
    resultDeadline: DEADLINE,
    challengePeriod: 86_400,
    totals: { yes: 100n, no: 15n },
    feeClaimed: false,
  };

  it('remote send closes at the sender cutoff (now < cutoff)', () => {
    expect(remoteSendOpen(base, CUT - 1)).toBe(true);
    expect(remoteSendOpen(base, CUT)).toBe(false);
    expect(remoteSendOpen({ ...base, remoteCutoff: undefined }, CUT - 100)).toBe(false); // not configured
    expect(remoteCutoffOf({ remoteCutoff: CUT + 50, crossChainCutoff: CUT })).toBe(CUT); // the earlier of sender and registry
  });

  it('local stake closes at lock, not at the cutoff', () => {
    expect(localStakeOpen(base, CUT)).toBe(true);
    expect(localStakeOpen(base, LOCK_ - 1)).toBe(true);
    expect(localStakeOpen(base, LOCK_)).toBe(false);
    expect(localStakeOpen({ ...base, series: false }, CUT - 1)).toBe(false);
  });

  it('trading and add-liquidity stay open after lock, until maturity', () => {
    expect(tradingOpen(base, LOCK_)).toBe(true);
    expect(tradingOpen(base, MAT - 1)).toBe(true);
    expect(tradingOpen(base, MAT)).toBe(false);
    expect(lpExitOpen()).toBe(true);
  });

  it('propose from maturity to the result deadline (resolver only), once', () => {
    expect(canPropose(base, MAT - 1)).toBe(false);
    expect(canPropose(base, MAT)).toBe(true);
    expect(canPropose(base, DEADLINE)).toBe(true);
    expect(canPropose(base, DEADLINE + 1)).toBe(false);
    expect(canPropose({ ...base, decision: { proposedAt: MAT, challenged: false, evidenceHash: '0x01' } }, MAT + 5)).toBe(false);
  });

  it('challenge until proposedAt + period; finalize from then; adjudicate while challenged', () => {
    const proposedAt = MAT + 600;
    const proposed = { ...base, decision: { proposedAt, challenged: false, evidenceHash: '0x01' as const }, phase: 'proposed' as const };
    expect(canChallenge(proposed, proposedAt + 86_400 - 1)).toBe(true);
    expect(canChallenge(proposed, proposedAt + 86_400)).toBe(false);
    expect(canFinalize(proposed, proposedAt + 86_400 - 1)).toBe(false);
    expect(canFinalize(proposed, proposedAt + 86_400)).toBe(true);
    const challenged = { ...proposed, decision: { ...proposed.decision, challenged: true }, phase: 'challenged' as const };
    expect(canAdjudicate(challenged, DEADLINE)).toBe(true);
    expect(canAdjudicate(challenged, DEADLINE + 1)).toBe(false);
    expect(canFinalize(challenged, DEADLINE)).toBe(false);
  });

  it('finalize() after the result deadline produces Void, with or without a proposal', () => {
    const matured = { ...base, phase: 'matured' as const };
    expect(canFinalize(matured, DEADLINE)).toBe(false);
    expect(canFinalize(matured, DEADLINE + 1)).toBe(true);
  });

  it('principal claims: from finalization until finalizedAt + 90 days, then expired', () => {
    const finalizedAt = MAT + 2 * 86_400;
    const final = { ...base, decision: { outcome: 'yes' as const, proposedAt: MAT, challenged: false, evidenceHash: '0x01' as const, finalizedAt } };
    expect(claimPrincipalOpen({ ...base, decision: undefined }, MAT)).toBe(false);
    expect(claimsCloseAt(final)).toBe(finalizedAt + CLAIM_WINDOW);
    expect(claimPrincipalOpen(final, finalizedAt)).toBe(true);
    expect(claimPrincipalOpen(final, finalizedAt + CLAIM_WINDOW)).toBe(true);
    expect(claimPrincipalOpen(final, finalizedAt + CLAIM_WINDOW + 1)).toBe(false);
    expect(claimsExpired(final, finalizedAt + CLAIM_WINDOW)).toBe(false);
    expect(claimsExpired(final, finalizedAt + CLAIM_WINDOW + 1)).toBe(true);
    expect(canClaimFee(final, finalizedAt + 1)).toBe(true);
    expect(canClaimFee({ ...final, feeClaimed: true }, finalizedAt + 1)).toBe(false);
    expect(canClaimFee({ ...final, decision: { ...final.decision, outcome: 'void' as const } }, finalizedAt + 1)).toBe(false);
    expect(nextDeadline({ ...final, phase: 'final_yes' })).toEqual({ label: 'Claims close', at: finalizedAt + CLAIM_WINDOW });
  });

  it('simulated yield only before maturity while something is staked', () => {
    expect(canInjectYield(base, MAT - 1)).toBe(true);
    expect(canInjectYield(base, MAT)).toBe(false);
    expect(canInjectYield({ ...base, totals: { yes: 0n, no: 0n } }, LOCK_)).toBe(false);
  });

  it('derivePhase walks the same boundaries', () => {
    const at = (now: number) => derivePhase({ now, lockTime: LOCK_, crossChainCutoff: CUT });
    expect([at(CUT - 1), at(CUT), at(LOCK_ - 1), at(LOCK_), at(MAT - 1), at(MAT)]).toEqual([
      'open',
      'open_local_only',
      'open_local_only',
      'locked',
      'locked',
      'matured',
    ]);
  });
});
