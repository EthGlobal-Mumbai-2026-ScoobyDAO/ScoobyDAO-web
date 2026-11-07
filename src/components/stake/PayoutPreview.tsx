import { InfoTip } from '@/components/ui';
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
        <h3 id="payout-h" className="text-[15px] font-semibold">
          If you stake {formatUsdc(amount)} dUSD on {side === 'yes' ? 'Yes' : 'No'}
        </h3>
        <InfoTip label="Payout formula" align="end">
          <span className="num block">payout = s + ⌊s × (L − ⌊L/5⌋) / W⌋</span>
          <span className="text-muted mt-1 block">Each winning unit now redeems {formatUsdc(p.perUnitIfWin, { exact: true })}. Totals keep moving until the lock.</span>
        </InfoTip>
      </div>
      <dl className="space-y-2 text-sm">
        <Line label="If Yes wins" value={p.ifYes} hint={side === 'yes' ? `fee ${formatUsdc(p.feeIfYes)} dUSD = 20% of the ${formatUsdc(loserIfYes)} No pool` : 'your No position pays 0'} />
        <Line label="If No wins" value={p.ifNo} hint={side === 'no' ? `fee ${formatUsdc(p.feeIfNo)} dUSD = 20% of the ${formatUsdc(loserIfNo)} Yes pool` : 'your Yes position pays 0'} />
        <Line label="If Void" value={p.ifVoid} hint="stake back, no fee" />
      </dl>
      {scaled && (
        <p className="text-beam-ink text-xs">
          A simulated loss left {formatUsdc(projectedPrincipal!)} of {formatUsdc(total)} dUSD backing positions, so every figure above is scaled down pro rata.
        </p>
      )}
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
