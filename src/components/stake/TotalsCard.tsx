import { NetworkBadge } from '@/components/NetworkBadge';
import { OddsBar } from '@/components/OddsBar';
import { Card } from '@/components/ui';
import { formatUsdc } from '@/lib/format';
import type { MarketView } from '@/protocol';
import { PayoutRulesTip } from './PayoutCalculator';

/** Pool totals plus the payout rules as three short lines (details in the popover). */
export function TotalsCard({ market: m }: { market: MarketView }) {
  const total = m.totals.yes + m.totals.no;
  return (
    <Card title="Stakes so far" actions={<NetworkBadge chainId={11155111} />}>
      <p className="num text-3xl font-semibold">
        {formatUsdc(total)} <span className="text-muted text-base font-normal">dUSD</span>
      </p>
      <div className="mt-4">
        <OddsBar yes={m.totals.yes} no={m.totals.no} />
      </div>
      <p className="text-muted mt-2 text-[13px]">
        Yes <span className="num">{formatUsdc(m.totals.yes)}</span> · No <span className="num">{formatUsdc(m.totals.no)}</span>. Credited CCIP stakes count; stakes in transit
        don&apos;t yet.
      </p>
      <div id="how-payouts-work" className="border-line mt-5 border-t pt-4">
        <h3 className="flex items-center gap-1.5 text-[15px] font-semibold">
          How payouts work <PayoutRulesTip />
        </h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          <li className="flex justify-between gap-3">
            <span className="text-muted">Winners</span>
            <span className="text-right">stake back + 80% of the losing pool</span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="text-muted">Losers</span>
            <span className="text-right">0</span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="text-muted">Void</span>
            <span className="text-right">stakes back, no fee</span>
          </li>
        </ul>
      </div>
    </Card>
  );
}
