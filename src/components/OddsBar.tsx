import { formatUsdc } from '@/lib/format';
import { yesShare } from '@/lib/payout';

/** Yes vs No share of stakes. This is the split of money staked, not a probability. */
export function OddsBar({ yes, no, compact = false }: { yes: bigint; no: bigint; compact?: boolean }) {
  const p = yesShare({ yes, no });
  if (p === undefined) return <p className="text-muted text-sm">No stakes yet.</p>;
  const yesPct = Math.round(p * 100);
  return (
    <div>
      <div
        className={`flex overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fog-400)_20%,transparent)] ${compact ? 'h-2' : 'h-3'}`}
        role="img"
        aria-label={`Share of stakes: ${yesPct}% Yes, ${100 - yesPct}% No`}
      >
        <div className="bg-beam" style={{ width: `${yesPct}%` }} />
        <div className="bg-bg w-0.5" />
        <div className="bg-clue flex-1" />
      </div>
      <div className={`mt-1.5 flex justify-between ${compact ? 'text-xs' : 'text-sm'}`}>
        <span className="text-beam-ink">
          <span className="num font-semibold">{yesPct}%</span> Yes
        </span>
        {!compact && <span className="text-muted text-xs">Share of stakes</span>}
        <span className="text-clue-ink">
          No <span className="num font-semibold">{100 - yesPct}%</span>
        </span>
      </div>
      {!compact && (
        <p className="sr-only">
          {formatUsdc(yes)} dUSD on Yes, {formatUsdc(no)} dUSD on No.
        </p>
      )}
    </div>
  );
}
