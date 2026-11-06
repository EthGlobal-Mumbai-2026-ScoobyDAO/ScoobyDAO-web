import { describe, expect, it } from 'vitest';
import { canChallenge, canFinalize, challengeEnds, derivePhase, nextDeadline, THIRTY_DAYS } from './phase';
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
