import { estimatePaid } from '@/lib/payout';
import { claimPrincipalOpen, type MarketView, type PositionView } from '@/protocol';

export interface Row {
  market: MarketView;
  pos: PositionView;
}

/** Totals for the summary tiles. Claimable counts open principal claims (estimate), YT yield and liquidity yield. */
export function summarize(rows: Row[], now?: number) {
  let staked = 0n;
  let claimable = 0n;
  let yt = 0n;
  let rep = 0n;
  for (const { market: m, pos } of rows) {
    staked += pos.yes + pos.no;
    yt += pos.yt;
    rep += pos.repReceipt;
    claimable += pos.ytClaimable + pos.lpClaimable;
    const outcome = m.decision?.outcome;
    if (outcome && claimPrincipalOpen(m, now ?? m.chainTime)) {
      for (const s of ['yes', 'no'] as const) if (pos[s] > 0n) claimable += estimatePaid(outcome, s, pos[s], m.totals, m.principalAvailable);
    }
  }
  return { staked, claimable, yt, rep };
}

