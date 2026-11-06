'use client';

import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { Identicon } from '@/components/Identicon';
import { OddsBar } from '@/components/OddsBar';
import { StatusChip } from '@/components/StatusChip';
import { chainName } from '@/lib/explorer';
import { formatDate, formatUsdc, shortHex } from '@/lib/format';
import { nextDeadline } from '@/protocol';
import type { CaseRow } from './useCaseRows';

/** Deterministic tilt per card so the board looks pinned by hand, not random on each render. */
function tilt(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.45;
}

export function CaseCard({ row, now }: { row: CaseRow; now?: number }) {
  const { report, market: m, onchainId, status } = row;
  const href = report ? `/cases/${encodeURIComponent(report.id)}` : `/case/${onchainId}/stake`;
  const symbol = report?.claimManifest.symbol ?? (onchainId !== undefined ? `Case #${onchainId}` : 'Unknown');
  const token = report?.claimManifest.token;
  const next = m ? nextDeadline(m) : undefined;
  const label = report?.claimManifest.claimText.split('. ')[0];
  return (
    <article
      className="paper-plain group relative flex h-full flex-col p-4 pt-6 transition-transform duration-200 hover:rotate-0 motion-reduce:transition-none"
      style={{ transform: `rotate(${tilt(row.key)}deg)` }}
    >
      <span
        aria-hidden
        className="bg-mask absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full shadow-[inset_-2px_-2px_0_rgb(0_0_0/0.25),0_2px_3px_rgb(0_0_0/0.4)]"
      />
      <div className="flex items-start gap-3">
        <Identicon address={token && token.startsWith('0x') ? token : row.key} size={52} />
        <div className="min-w-0">
          <h3 className="font-semibold">
            <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
              {symbol}
            </Link>
          </h3>
          <p className="text-muted mt-0.5 text-xs">
            {row.chainId ? chainName(row.chainId) : 'Chain unknown'}
            {token?.startsWith('0x') && <span className="num"> · {shortHex(token, 6, 4)}</span>}
          </p>
          <p className="text-muted text-xs">
            {onchainId !== undefined ? `Case #${onchainId}` : 'Not yet a case'}
            {report && <> · filed {formatDate(report.createdAt)}</>}
          </p>
        </div>
      </div>

      {label && (
        <p className="mt-3 text-sm">
          <span className="text-muted">Assessment:</span> {label === 'not stated' ? 'no label' : label}
        </p>
      )}

      <div className="mt-3">
        <StatusChip status={status} />
      </div>

      <div className="mt-auto pt-4">
        {m ? (
          <>
            <OddsBar compact yes={m.totals.yes} no={m.totals.no} />
            <p className="text-muted mt-2 flex flex-wrap justify-between gap-x-3 text-xs">
              <span>
                <span className="num text-text">{formatUsdc(m.totals.yes)}</span> Yes ·{' '}
                <span className="num text-text">{formatUsdc(m.totals.no)}</span> No dUSD
              </span>
              {next && (
                <span>
                  {next.label}: <Countdown to={next.at} now={now} className="text-text" endedLabel="now" />
                </span>
              )}
            </p>
          </>
        ) : onchainId !== undefined ? (
          <p className="text-muted text-xs">Reading the market…</p>
        ) : (
          <p className="text-muted text-xs">{report?.report?.evidence?.length ?? report?.claimManifest.evidence?.length ?? 0} evidence records</p>
        )}
      </div>
    </article>
  );
}
