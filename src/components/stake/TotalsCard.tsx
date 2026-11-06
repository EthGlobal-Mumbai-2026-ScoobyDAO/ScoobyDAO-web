import { OddsBar } from '@/components/OddsBar';
import { formatUsdc } from '@/lib/format';
import type { ClaimView } from '@/lib/types';

export function TotalsCard({
  claim,
  totals,
  feeBps,
}: {
  claim: ClaimView;
  totals: ClaimView['totals'];
  feeBps: bigint;
}) {
  return (
    <section aria-labelledby="totals-h" className="glass p-5 sm:p-6">
      <h2 id="totals-h" className="font-semibold">
        Stakes so far
      </h2>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {[
          ['Committed', totals.committed, 'text-text'],
          ['Revealed For', totals.forRevealed, 'text-clue-ink'],
          ['Revealed Against', totals.againstRevealed, 'text-mask-ink'],
        ].map(([label, v, ink]) => (
          <div key={label}>
            <dt className="text-muted text-xs">{label}</dt>
            <dd className={`num mt-1 text-lg font-semibold sm:text-xl ${ink}`}>{formatUsdc(v)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted mt-1 text-xs">
        USDC. Committed includes sealed stakes whose side isn&apos;t known yet.
      </p>
      <div className="mt-5">
        <OddsBar
          probability={claim.impliedForProbability}
          forRevealed={totals.forRevealed}
          againstRevealed={totals.againstRevealed}
        />
      </div>
      <div id="how-payouts-work" className="border-line text-muted mt-6 border-t pt-4 text-sm">
        <h3 className="text-text font-semibold">How payouts work</h3>
        <p className="mt-1.5">
          If the trap springs before the window ends, <span className="text-clue-ink">For</span>{' '}
          wins. If the window ends with no trigger, the token is cleared and{' '}
          <span className="text-mask-ink">Against</span> wins. Winners split the losing side pro
          rata after a <span className="num">{(Number(feeBps) / 100).toFixed(2)}%</span> fee:
        </p>
        <p className="num text-text mt-2 text-xs">payout = s + s × L × (10000 − f) / (10000 × W)</p>
        <p className="mt-2">If only one side revealed, everyone is refunded minus the fee.</p>
      </div>
    </section>
  );
}
