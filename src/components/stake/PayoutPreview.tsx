import { EstimateLabel } from '@/components/HonestyLabels';
import { formatUsdc } from '@/lib/format';
import { previewStake, type Totals } from '@/lib/payout';
import type { SideKey } from './SidePicker';

/**
 * Payout if Yes wins / if No wins / if Void for current totals plus your stake, with the contract's
 * math (fee = ⌊L/5⌋ of the losing pool only) and, in V2, scaled by the principal the vault still
 * holds when a simulated loss reduced it.
 */
export function PayoutPreview({ totals, side, amount, projectedPrincipal }: { totals: Totals; side: SideKey; amount: bigint; projectedPrincipal?: bigint }) {
  const p = previewStake(totals, side, amount, projectedPrincipal);
  const loserIfYes = p.totalsAfter.no;
  const loserIfNo = p.totalsAfter.yes;
  const total = totals.yes + totals.no;
  const scaled = projectedPrincipal !== undefined && projectedPrincipal < total;
  return (
    <section aria-labelledby="payout-h" className="border-line space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="payout-h" className="font-semibold">
          If you stake {formatUsdc(amount)} dUSD on {side === 'yes' ? 'Yes' : 'No'}
        </h3>
        <EstimateLabel />
      </div>
      <dl className="space-y-2 text-sm">
        <Line label="If Yes wins" value={p.ifYes} hint={side === 'yes' ? `fee ${formatUsdc(p.feeIfYes)} dUSD = 20% of the ${formatUsdc(loserIfYes)} No pool` : 'your No position pays 0'} />
        <Line label="If No wins" value={p.ifNo} hint={side === 'no' ? `fee ${formatUsdc(p.feeIfNo)} dUSD = 20% of the ${formatUsdc(loserIfNo)} Yes pool` : 'your Yes position pays 0'} />
        <Line label="If Void" value={p.ifVoid} hint="principal back, no fee" />
      </dl>
      <p className="num text-muted text-xs">payout = s + ⌊s × (L − ⌊L/5⌋) / W⌋ · each winning unit now redeems {formatUsdc(p.perUnitIfWin, { exact: true })}</p>
      {scaled && (
        <p className="text-beam-ink text-xs">
          A simulated loss left {formatUsdc(projectedPrincipal!)} of {formatUsdc(total)} dUSD backing positions, so every figure above is scaled down pro rata.
        </p>
      )}
      <p className="text-muted text-xs">Totals keep moving until lock, so this changes as others stake.</p>
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
