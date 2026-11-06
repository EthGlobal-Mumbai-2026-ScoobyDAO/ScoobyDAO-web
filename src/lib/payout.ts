// Settlement math, ported line for line from the contracts (all values in dUSD base units, 6 dp):
//
//   Settlement.redeemVPT / RiskFiStakeVaultV2.claimPrincipal
//     Void:            payout = amount
//     winning side:    payout = amount + amount * (loser - loser / 5) / winner
//     losing side:     payout = 0
//   Settlement.claimFee / claimFee():  fee = loser / 5        (20% of the losing pool only)
//
// Integer division floors, exactly like Solidity. Note `loser - loser / 5` floors the *fee*,
// so the distributable pool is L - floor(L/5), which can be 1 unit more than floor(L * 0.8).
// Principal actually released is then scaled by principalAvailable / totalPrincipal
// (simulated vault loss), see `scaledPaid`.

export type Side = 'yes' | 'no';
export interface Totals {
  yes: bigint;
  no: bigint;
}

export const feeOf = (loser: bigint): bigint => loser / 5n;
export const distributable = (loser: bigint): bigint => loser - loser / 5n;

/** Nominal payout for `amount` units of `side` under a final outcome. */
export function payoutFor(
  outcome: 'yes' | 'no' | 'void',
  side: Side,
  amount: bigint,
  totals: Totals,
): bigint {
  if (amount <= 0n) return 0n;
  // _finalize turns a one-sided market into Void.
  if (outcome === 'void' || totals.yes === 0n || totals.no === 0n) return amount;
  if (outcome !== side) return 0n;
  const winner = side === 'yes' ? totals.yes : totals.no;
  const loser = side === 'yes' ? totals.no : totals.yes;
  return amount + (amount * distributable(loser)) / winner;
}

/** VoteMarket.release / RiskFiStakeVaultV2._release: pro-rata scaling for principal loss. */
export function scaledPaid(nominal: bigint, principalAvailable: bigint, totalPrincipal: bigint): bigint {
  if (totalPrincipal === 0n) return 0n;
  return (nominal * principalAvailable) / totalPrincipal;
}

export interface PayoutPreview {
  totalsAfter: Totals;
  ifYes: bigint;
  ifNo: bigint;
  /** Void refunds principal (pro rata if the vault lost principal); no fee. */
  ifVoid: bigint;
  feeIfYes: bigint;
  feeIfNo: bigint;
  /** Payout per 1 dUSD (1e6 units) staked on `side` if that side wins, 6-dp. */
  perUnitIfWin: bigint;
}

/** Preview for a new stake: current totals plus your stake. */
export function previewStake(totals: Totals, side: Side, stake: bigint): PayoutPreview {
  const totalsAfter = {
    yes: totals.yes + (side === 'yes' ? stake : 0n),
    no: totals.no + (side === 'no' ? stake : 0n),
  };
  const ifYes = payoutFor('yes', side, stake, totalsAfter);
  const ifNo = payoutFor('no', side, stake, totalsAfter);
  return {
    totalsAfter,
    ifYes,
    ifNo,
    ifVoid: stake,
    feeIfYes: totalsAfter.no === 0n || totalsAfter.yes === 0n ? 0n : feeOf(totalsAfter.no),
    feeIfNo: totalsAfter.no === 0n || totalsAfter.yes === 0n ? 0n : feeOf(totalsAfter.yes),
    perUnitIfWin: payoutFor(side, side, 1_000_000n, totalsAfter),
  };
}

/** Share of stakes on Yes, 0..1 (not a probability). */
export function yesShare(totals: Totals): number | undefined {
  const all = totals.yes + totals.no;
  if (all === 0n) return undefined;
  return Number((totals.yes * 1_000_000n) / all) / 1_000_000;
}
