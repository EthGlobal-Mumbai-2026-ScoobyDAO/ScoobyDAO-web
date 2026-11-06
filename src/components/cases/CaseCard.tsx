import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { Identicon } from '@/components/Identicon';
import { OddsBar } from '@/components/OddsBar';
import { StatusChip } from '@/components/StatusChip';
import { CLAIM_TYPE_LABEL } from '@/lib/claimText';
import { formatDate, formatUsdc, shortHex } from '@/lib/format';
import type { CaseStatus } from '@/lib/status';
import type { ClaimView, Report } from '@/lib/types';

/** Deterministic tilt per card so the board looks pinned by hand, not random on each render. */
function tilt(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.45;
}

export function CaseCard({
  report,
  claim,
  status,
}: {
  report: Report;
  claim?: ClaimView;
  status: CaseStatus;
}) {
  const href = `/cases/${report.id}`;
  return (
    <article
      className="paper-plain group relative flex h-full flex-col p-4 pt-6 transition-transform duration-200 hover:rotate-0 motion-reduce:transition-none"
      style={{ transform: `rotate(${tilt(report.id)}deg)` }}
    >
      {/* push pin */}
      <span
        aria-hidden
        className="bg-mask absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full shadow-[inset_-2px_-2px_0_rgb(0_0_0/0.25),0_2px_3px_rgb(0_0_0/0.4)]"
      />
      <div className="flex items-start gap-3">
        <Identicon address={report.token} size={52} />
        <div className="min-w-0">
          <h3 className="font-semibold">
            <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
              <span className="num">{shortHex(report.token, 8, 4)}</span>
            </Link>
          </h3>
          <p className="text-muted mt-0.5 text-xs">
            {claim ? `Case #${claim.claimId}` : 'Not yet a case'} · filed{' '}
            {formatDate(report.createdAt)}
          </p>
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Claim types">
        {report.manifest.claims.map((c) => (
          <li key={c.id} className="border-line rounded border px-1.5 py-0.5 text-xs">
            {CLAIM_TYPE_LABEL[c.type]}
          </li>
        ))}
      </ul>

      <div className="mt-3">
        <StatusChip status={status} />
      </div>

      <div className="mt-auto pt-4">
        {claim ? (
          <>
            <OddsBar
              compact
              probability={claim.impliedForProbability}
              forRevealed={claim.totals.forRevealed}
              againstRevealed={claim.totals.againstRevealed}
            />
            <p className="text-muted mt-2 flex justify-between text-xs">
              <span>
                <span className="num text-text">{formatUsdc(claim.totals.committed)}</span> USDC
                staked
              </span>
              {claim.status === 'Open' && (
                <span>
                  <Countdown to={claim.windowEnd} className="text-text" /> left
                </span>
              )}
            </p>
          </>
        ) : (
          <p className="text-muted text-xs">
            {report.manifest.evidence.length}{' '}
            {report.manifest.evidence.length === 1 ? 'piece' : 'pieces'} of evidence
          </p>
        )}
      </div>
    </article>
  );
}
