'use client';

import { ArrowRight, FileSearch } from 'lucide-react';
import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { Identicon } from '@/components/Identicon';
import { OddsBar } from '@/components/OddsBar';
import { PillarDots } from '@/components/report/PillarDots';
import { ReviewBadge } from '@/components/report/ReviewBadge';
import { StatusChip } from '@/components/StatusChip';
import { chainName } from '@/lib/explorer';
import { formatDate, formatUsdc } from '@/lib/format';
import { NOT_STATED } from '@/lib/types';
import { nextDeadline } from '@/protocol';
import type { CaseRow } from './useCaseRows';

/** Deterministic tilt per card so the board looks pinned by hand, not random on each render. */
export function tilt(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.45;
}

export function CaseCard({ row, now }: { row: CaseRow; now?: number }) {
  const { report, market: m, onchainId, status } = row;
  const href = report ? `/cases/${encodeURIComponent(report.id)}` : `/case/${onchainId}/stake`;
  const symbol =
    report?.claimManifest.symbol ?? (onchainId !== undefined ? `Case #${onchainId}` : 'Unknown');
  const token = report?.claimManifest.token;
  const next = m ? nextDeadline(m) : undefined;
  const why = [report?.claimManifest.summary, report?.claimManifest.claimText].find(
    (t) => t && t !== NOT_STATED,
  );
  const evidence = report?.report?.evidence?.length ?? report?.claimManifest.evidence?.length;
  const pillars = report?.report?.pillars;
  const statuses = pillars
    ? Object.fromEntries(Object.entries(pillars).map(([k, p]) => [k, p?.status]))
    : {};
  // Only the backend's lifecycle says a human approved: a published report passed the World ID gate.
  const approved = report?.status === 'published';
  return (
    <article
      className="paper-plain group relative flex h-full flex-col p-5 pt-6 transition-transform duration-200 hover:rotate-0 motion-reduce:transition-none"
      style={{ transform: `rotate(${tilt(row.key)}deg)` }}
    >
      <span
        aria-hidden
        className="bg-mask absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full shadow-[inset_-2px_-2px_0_rgb(0_0_0/0.25),0_2px_3px_rgb(0_0_0/0.4)]"
      />
      <div className="flex items-start gap-3">
        <Identicon address={token && token.startsWith('0x') ? token : row.key} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <h3 className="text-lg leading-tight font-semibold">{symbol}</h3>
            <StatusChip status={status} />
          </div>
          <p className="text-muted mt-0.5 text-[13px]">
            {row.chainId ? chainName(row.chainId) : 'Chain unknown'}
            {report && <> · filed {formatDate(report.createdAt)}</>}
          </p>
        </div>
      </div>

      {why && (
        <div className="mt-4">
          <p className="text-muted text-[13px] font-medium">Why Sniff flagged it</p>
          <p className="mt-1 line-clamp-2 text-[15px]" title={why}>
            {why}
          </p>
        </div>
      )}

      {pillars && (
        <div className="mt-3">
          <PillarDots statuses={statuses} />
        </div>
      )}

      {m && (
        <div className="mt-4">
          <OddsBar compact yes={m.totals.yes} no={m.totals.no} />
          <p className="text-muted mt-2 flex flex-wrap justify-between gap-x-3 text-xs">
            <span>
              <span className="num text-text">{formatUsdc(m.totals.yes)}</span> Yes ·{' '}
              <span className="num text-text">{formatUsdc(m.totals.no)}</span> No dUSD
            </span>
            {next && (
              <span>
                {next.label}:{' '}
                <Countdown to={next.at} now={now} className="text-text" endedLabel="now" />
              </span>
            )}
          </p>
        </div>
      )}

      <div className="border-line mt-auto border-t pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {report && <ReviewBadge kind={approved ? 'approved' : 'pending'} />}
          {evidence !== undefined && (
            <span className="text-muted text-xs">
              {evidence} evidence {evidence === 1 ? 'record' : 'records'}
            </span>
          )}
        </div>
        <Link
          href={href}
          className="bg-beam text-on-beam mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 font-semibold hover:brightness-105"
        >
          {report ? (
            <>
              <FileSearch size={16} aria-hidden /> Open case file
            </>
          ) : (
            <>
              Open market <ArrowRight size={16} aria-hidden />
            </>
          )}
          <span className="sr-only"> for {symbol}</span>
        </Link>
      </div>
    </article>
  );
}
