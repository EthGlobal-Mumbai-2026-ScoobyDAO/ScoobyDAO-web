import { formatUsdc } from '@/lib/format';
import { previewStake, type Totals } from '@/lib/payout';
import type { SideKey } from './SidePicker';

/** Payout if Yes wins / if No wins / if Void, for current totals plus your stake (Settlement.redeemVPT math). */
export function PayoutPreview({ totals, side, amount }: { totals: Totals; side: SideKey; amount: bigint }) {
  const p = previewStake(totals, side, amount);
  const loserIfYes = p.totalsAfter.no;
  const loserIfNo = p.totalsAfter.yes;
  return (
    <section aria-labelledby="payout-h" className="border-line rounded-xl border p-4">
      <h3 id="payout-h" className="font-semibold">
        If you stake {formatUsdc(amount)} dUSD on {side === 'yes' ? 'Yes' : 'No'}
      </h3>
      <dl className="mt-3 space-y-2 text-sm">
        <Line label="If Yes wins" value={p.ifYes} hint={side === 'yes' ? `fee ${formatUsdc(p.feeIfYes)} dUSD = 20% of the ${formatUsdc(loserIfYes)} No pool` : 'your No position pays 0'} />
        <Line label="If No wins" value={p.ifNo} hint={side === 'no' ? `fee ${formatUsdc(p.feeIfNo)} dUSD = 20% of the ${formatUsdc(loserIfNo)} Yes pool` : 'your Yes position pays 0'} />
        <Line label="If Void" value={p.ifVoid} hint="refund pro rata, no fee" />
      </dl>
      <p className="num text-muted mt-3 text-xs">payout = s + ⌊s × (L − ⌊L/5⌋) / W⌋ · each winning unit now redeems {formatUsdc(p.perUnitIfWin, { exact: true })}</p>
      <p className="text-muted mt-1 text-xs">Totals keep moving until lock, so this preview changes as others stake.</p>
    </section>
  );
}

function Line({ label, value, hint }: { label: string; value: bigint; hint: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <dt>{label}</dt>
      <dd className="text-right">
        <span className="num font-semibold">{formatUsdc(value, { exact: true })}</span> dUSD
        <span className="text-muted block text-xs">{hint}</span>
      </dd>
    </div>
  );
}
