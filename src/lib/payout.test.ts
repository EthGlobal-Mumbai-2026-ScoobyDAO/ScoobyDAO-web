import { describe, expect, it } from 'vitest';
import { distributable, feeOf, payoutFor, previewStake, scaledPaid, yesShare } from './payout';

const U = 1_000_000n;

describe('payout math = Settlement.redeemVPT / RiskFiStakeVaultV2.claimPrincipal', () => {
  // test/Voting.t.sol testYes80No20: Alice 80 Yes, Bob 20 No, Yes wins → Alice 96, treasury 4.
  it('Voting.t.sol testYes80No20: winner 96, fee 4, loser 0, 1.20 per unit', () => {
    const t = { yes: 80n * U, no: 20n * U };
    expect(payoutFor('yes', 'yes', 80n * U, t)).toBe(96n * U);
    expect(payoutFor('yes', 'no', 20n * U, t)).toBe(0n);
    expect(feeOf(t.no)).toBe(4n * U);
    expect(payoutFor('yes', 'yes', U, t)).toBe(1_200_000n);
    expect(payoutFor('yes', 'yes', 80n * U, t) + feeOf(t.no)).toBe(t.yes + t.no);
  });

  it('Voting.t.sol testNo80Yes20: the No winner gets 96', () => {
    expect(payoutFor('no', 'no', 80n * U, { yes: 20n * U, no: 80n * U })).toBe(96n * U);
  });

  it('Voting.t.sol testOneSidedVoid: a one-sided market refunds the stake', () => {
    expect(payoutFor('yes', 'yes', 80n * U, { yes: 80n * U, no: 0n })).toBe(80n * U);
  });

  it('Void refunds principal on both sides, no fee', () => {
    const t = { yes: 40n * U, no: 35n * U };
    expect(payoutFor('void', 'yes', 40n * U, t)).toBe(40n * U);
    expect(payoutFor('void', 'no', 35n * U, t)).toBe(35n * U);
  });

  it('Voting.t.sol testRoundingDustSweptAfterClaimsExpire: 2+1 Yes vs 1 No floors to 2 and 1, 1 unit of dust', () => {
    const t = { yes: 3n, no: 1n };
    const alice = payoutFor('yes', 'yes', 2n, t);
    const bob = payoutFor('yes', 'yes', 1n, t);
    expect(alice).toBe(2n);
    expect(bob).toBe(1n);
    expect(feeOf(1n)).toBe(0n);
    expect(t.yes + t.no - alice - bob - feeOf(1n)).toBe(1n);
  });

  // test/EightVoterWorkflowV2.t.sol: Yes 145 (80, 30, 20, 10, 5), No 75 (40, 20, 15), Yes wins.
  it('EightVoterWorkflowV2.t.sol 145/75: fee 15, per-voter floors, dust ≤ 5', () => {
    const t = { yes: 145n * U, no: 75n * U };
    expect(feeOf(t.no)).toBe(15n * U);
    expect(distributable(t.no)).toBe(60n * U);
    const winners = [80n, 30n, 20n, 10n, 5n].map((s) => payoutFor('yes', 'yes', s * U, t));
    expect(winners).toEqual([113_103_448n, 42_413_793n, 28_275_862n, 14_137_931n, 7_068_965n]);
    for (const s of [40n, 20n, 15n]) expect(payoutFor('yes', 'no', s * U, t)).toBe(0n);
    const paid = winners.reduce((a, b) => a + b, 0n);
    expect(paid + 15n * U).toBeLessThanOrEqual(220n * U);
    expect(220n * U - paid - 15n * U).toBeLessThanOrEqual(5n);
  });

  it('the fee floors (L - L/5), which can exceed floor(L * 0.8) by one unit', () => {
    expect(distributable(9n)).toBe(8n); // 9 - 1; floor(9 * 0.8) = 7
    expect(feeOf(9n)).toBe(1n);
  });

  it('principal loss scales the paid amount pro rata', () => {
    expect(scaledPaid(96n * U, 90n * U, 100n * U)).toBe(86_400_000n);
  });
});

describe('previewStake', () => {
  it('adds your stake to the totals before computing', () => {
    const p = previewStake({ yes: 70n * U, no: 20n * U }, 'yes', 10n * U);
    expect(p.totalsAfter).toEqual({ yes: 80n * U, no: 20n * U });
    expect(p.ifYes).toBe(12n * U);
    expect(p.ifNo).toBe(0n);
    expect(p.ifVoid).toBe(10n * U);
    expect(p.feeIfYes).toBe(4n * U);
    expect(p.perUnitIfWin).toBe(1_200_000n);
  });
  it('first stake on an empty market previews as a refund (one-sided → Void)', () => {
    const p = previewStake({ yes: 0n, no: 0n }, 'no', 5n * U);
    expect(p.ifNo).toBe(5n * U);
    expect(p.ifYes).toBe(5n * U);
  });
  it('share of stakes is a split, not a probability', () => {
    expect(yesShare({ yes: 80n, no: 20n })).toBe(0.8);
    expect(yesShare({ yes: 0n, no: 0n })).toBeUndefined();
  });
});
