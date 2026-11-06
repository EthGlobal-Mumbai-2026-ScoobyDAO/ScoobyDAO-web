import { formatUsdc } from '@/lib/format';
import { BPS, refundPayout, winningPayout } from '@/lib/payout';

/** Shows the exact formula with the live numbers plugged in. No jokes on money screens. */
export function PayoutPreview({
  s,
  W,
  L,
  feeBps,
  refund = false,
  caption,
}: {
  s: bigint;
  W: bigint;
  L: bigint;
  feeBps: bigint;
  refund?: boolean;
  caption?: string;
}) {
  const oneSided = refund || W === 0n || L === 0n;
  const payout = oneSided ? refundPayout(s, feeBps) : winningPayout(s, W, L, feeBps);
  return (
    <div className="border-line rounded-xl border p-4">
      {caption && <p className="text-muted mb-3 text-sm">{caption}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">Your winning shares (s)</dt>
        <dd className="num text-right">{formatUsdc(s, { exact: true })}</dd>
        {!oneSided && (
          <>
            <dt className="text-muted">Winning side total (W)</dt>
            <dd className="num text-right">{formatUsdc(W, { exact: true })}</dd>
            <dt className="text-muted">Losing side total (L)</dt>
            <dd className="num text-right">{formatUsdc(L, { exact: true })}</dd>
          </>
        )}
        <dt className="text-muted">Fee (f)</dt>
        <dd className="num text-right">
          {feeBps.toString()} bps ({(Number(feeBps) / 100).toFixed(2)}%)
        </dd>
      </dl>
      <p className="num border-line text-muted mt-3 border-t pt-3 text-xs break-words">
        {oneSided
          ? `payout = s × (${BPS} − f) / ${BPS}`
          : `payout = s + s × L × (${BPS} − f) / (${BPS} × W)`}
      </p>
      <p className="mt-2 flex items-baseline justify-between gap-3">
        <span className="text-muted text-sm">{oneSided ? 'Refund' : 'Payout'}</span>
        <span className="num text-2xl font-semibold">
          {formatUsdc(payout, { exact: true })} USDC
        </span>
      </p>
    </div>
  );
}
