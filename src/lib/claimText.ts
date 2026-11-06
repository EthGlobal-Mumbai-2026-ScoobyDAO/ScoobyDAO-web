import type { ManifestClaim } from './types';

const pct = (bps: unknown) =>
  typeof bps === 'number' ? `${(bps / 100).toLocaleString('en-US')}%` : undefined;

/** Exact claim sentence rendered from manifest claim type + params (what the reviewer signs off on). */
export function claimSentence(c: ManifestClaim): string {
  const p = c.params;
  switch (c.type) {
    case 'SELL_REVERTS':
      return `A normal wallet that buys this token can't sell it: the sell reverts${
        pct(p.minSellTaxBps) ? ` or loses at least ${pct(p.minSellTaxBps)} to tax` : ''
      }.`;
    case 'SELL_TAX_ABOVE':
      return `Selling this token costs more than ${pct(p.thresholdBps) ?? 'the threshold'} in tax${
        pct(p.observedBps) ? ` (measured: ${pct(p.observedBps)})` : ''
      }.`;
    case 'OWNER_CAN_PAUSE_OR_BLACKLIST':
      return `The token's owner can pause transfers or block specific wallets${
        typeof p.function === 'string' ? ` using ${p.function}` : ''
      }.`;
    default:
      return `${(c as ManifestClaim).type} ${JSON.stringify((c as ManifestClaim).params)}`;
  }
}

export const CLAIM_TYPE_LABEL: Record<ManifestClaim['type'], string> = {
  SELL_REVERTS: "Can't sell",
  SELL_TAX_ABOVE: 'High sell tax',
  OWNER_CAN_PAUSE_OR_BLACKLIST: 'Owner can freeze wallets',
};
