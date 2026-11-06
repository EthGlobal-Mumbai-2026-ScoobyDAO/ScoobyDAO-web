'use client';

import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { StatusChip } from '@/components/StatusChip';
import { TxLink } from '@/components/TxLink';
import { CLAIM_TYPE_LABEL } from '@/lib/claimText';
import { shortHex } from '@/lib/format';
import type { ClaimView, Report } from '@/lib/types';

export function CaseHeader({
  claim,
  report,
  tab,
}: {
  claim: ClaimView;
  report?: Report;
  tab: 'stake' | 'market';
}) {
  const types = report?.manifest.claims.map((c) => CLAIM_TYPE_LABEL[c.type]) ?? [];
  return (
    <header className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="font-display text-4xl sm:text-5xl">Case #{claim.claimId}</h1>
        <StatusChip status={claim.status} size="lg" />
      </div>
      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted">Token</dt>
          <dd className="mt-0.5">
            <TxLink kind="token" value={claim.token} />
          </dd>
        </div>
        <div>
          <dt className="text-muted">Claim</dt>
          <dd className="mt-0.5">{types.length ? types.join(', ') : '—'}</dd>
        </div>
        {claim.status === 'Open' && (
          <div>
            <dt className="text-muted">Staking closes in</dt>
            <dd className="mt-0.5 text-base font-semibold">
              <Countdown to={claim.windowEnd} endedLabel="Closed" />
            </dd>
          </div>
        )}
        {claim.evidenceHash && (
          <div>
            <dt className="text-muted">Evidence hash</dt>
            <dd className="num mt-0.5" title={claim.evidenceHash}>
              {shortHex(claim.evidenceHash, 10, 6)}
            </dd>
          </div>
        )}
        {claim.triggerTxHash && (
          <div>
            <dt className="text-muted">Trigger tx</dt>
            <dd className="mt-0.5">
              <TxLink value={claim.triggerTxHash} />
            </dd>
          </div>
        )}
      </dl>
      <nav aria-label="Case sections" className="border-line flex gap-1 border-b text-sm">
        {report && (
          <Link
            href={`/cases/${report.id}`}
            className="text-muted hover:text-text -mb-px border-b-2 border-transparent px-3 py-2"
          >
            Case file
          </Link>
        )}
        {(['stake', 'market'] as const).map((t) => (
          <Link
            key={t}
            href={`/case/${claim.claimId}/${t}`}
            aria-current={tab === t ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 ${tab === t ? 'border-beam text-text' : 'text-muted hover:text-text border-transparent'}`}
          >
            {t === 'stake' ? 'Stake' : 'Trade shares'}
          </Link>
        ))}
      </nav>
    </header>
  );
}
