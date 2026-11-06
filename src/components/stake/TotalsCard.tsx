import { OddsBar } from '@/components/OddsBar';
import { PublicStakesLabel } from '@/components/HonestyLabels';
import { formatUsdc } from '@/lib/format';
import type { MarketView } from '@/protocol';

export function TotalsCard({ market: m }: { market: MarketView }) {
  return (
    <section aria-labelledby="totals-h" className="glass p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="totals-h" className="font-semibold">
          Stakes so far
        </h2>
        <PublicStakesLabel />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {[
          ['Total', m.totals.yes + m.totals.no, 'text-text'],
          ['Yes', m.totals.yes, 'text-beam-ink'],
          ['No', m.totals.no, 'text-clue-ink'],
        ].map(([label, v, ink]) => (
          <div key={label as string}>
            <dt className="text-muted text-xs">{label as string}</dt>
            <dd className={`num mt-1 text-lg font-semibold sm:text-xl ${ink as string}`}>{formatUsdc(v as bigint)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted mt-1 text-xs">dUSD. Credited CCIP stakes are included; stakes still in transit are not.</p>
      <div className="mt-5">
        <OddsBar yes={m.totals.yes} no={m.totals.no} />
      </div>
      <div id="how-payouts-work" className="border-line text-muted mt-6 border-t pt-4 text-sm">
        <h3 className="text-text font-semibold">How payouts work</h3>
        <p className="mt-1.5">
          After maturity the resolver proposes Yes, No or Void with an evidence hash. Anyone can challenge during the challenge
          window; then anyone can finalize. Winners get their stake back plus 80% of the losing pool, pro rata. The fee is 20% of
          the losing pool only. Losers get 0.
        </p>
        <p className="mt-2">Example: Yes 80, No 20, Yes wins → treasury 4, each Yes unit redeems 1.20, each No unit 0.</p>
        <p className="mt-2">Void (one side empty, or no final result by the deadline) refunds principal pro rata, no fee.</p>
      </div>
    </section>
  );
}
