import { formatUsdc } from '@/lib/format';

/**
 * Teal For vs red Against. Uses impliedForProbability when the pools report it,
 * otherwise the revealed stake split (labelled as such).
 */
export function OddsBar({
  probability,
  forRevealed,
  againstRevealed,
  compact = false,
}: {
  probability?: number;
  forRevealed?: string;
  againstRevealed?: string;
  compact?: boolean;
}) {
  const f = BigInt(forRevealed ?? '0');
  const a = BigInt(againstRevealed ?? '0');
  const fromStakes = probability === undefined;
  const p = fromStakes
    ? f + a === 0n
      ? undefined
      : Number((f * 10000n) / (f + a)) / 10000
    : probability;

  if (p === undefined) {
    return <p className="text-muted text-sm">No odds yet: nobody has revealed a stake.</p>;
  }
  const forPct = Math.round(p * 100);
  return (
    <div>
      <div
        className={`flex overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fog-400)_20%,transparent)] ${compact ? 'h-2' : 'h-3'}`}
        role="img"
        aria-label={`${fromStakes ? 'Revealed stakes' : 'Market odds'}: ${forPct}% For, ${100 - forPct}% Against`}
      >
        <div className="bg-clue" style={{ width: `${forPct}%` }} />
        <div className="bg-bg w-0.5" />
        <div className="bg-mask flex-1" />
      </div>
      <div className={`mt-1.5 flex justify-between ${compact ? 'text-xs' : 'text-sm'}`}>
        <span className="text-clue-ink">
          <span className="num font-semibold">{forPct}%</span> For
        </span>
        {!compact && (
          <span className="text-muted text-xs">
            {fromStakes ? 'From revealed stakes' : 'Implied by the pools'}
          </span>
        )}
        <span className="text-mask-ink">
          Against <span className="num font-semibold">{100 - forPct}%</span>
        </span>
      </div>
      {!compact && !fromStakes && (forRevealed || againstRevealed) && (
        <p className="sr-only">
          Revealed: {formatUsdc(f)} USDC For, {formatUsdc(a)} USDC Against.
        </p>
      )}
    </div>
  );
}
