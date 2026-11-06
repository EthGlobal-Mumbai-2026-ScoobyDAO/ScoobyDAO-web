'use client';

import { CircleCheck, CircleX, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { chainName } from '@/lib/explorer';
import { deploymentQuery, type DeploymentReport } from '@/protocol';
import { useDeploymentCheck, useProtocol } from '@/protocol/hooks';
import { Banner } from './Banner';

/** Global banner: red on a deployment mismatch, amber when the check can't run. Nothing when green. */
export function DeploymentCheckBanner() {
  const { protocol } = useProtocol();
  const check = useDeploymentCheck();
  if (protocol.kind !== 'v2') return null;
  if (check.data && !check.data.ok)
    return (
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <Banner tone="danger" title="Deployment mismatch — wallet writes are disabled">
          <p>The contracts onchain don&apos;t match the V2 handoff bundle ({check.data.bundle}). Failed checks:</p>
          <FailedList report={check.data} />
        </Banner>
      </div>
    );
  if (check.isError)
    return (
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <Banner tone="warning" title="Couldn't verify the V2 deployment — wallet writes are paused">
          <p>{check.error.message.split('\n')[0]}</p>
          <RecheckButton />
        </Banner>
      </div>
    );
  return null;
}

function FailedList({ report }: { report: DeploymentReport }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5">
      {report.checks
        .filter((c) => !c.ok)
        .map((c) => (
          <li key={c.id}>
            <span className="font-semibold">{c.label}</span> <span className="text-muted">({chainName(c.chainId)})</span>
            {c.actual && (
              <span className="num block text-xs break-all">
                read {c.actual}
                {c.expected ? ` · expected ${c.expected}` : ''}
              </span>
            )}
          </li>
        ))}
    </ul>
  );
}

function RecheckButton() {
  const qc = useQueryClient();
  return (
    <button
      type="button"
      onClick={() => void qc.resetQueries({ queryKey: deploymentQuery.queryKey })}
      className="border-line mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-semibold hover:border-[var(--fog-400)]"
    >
      <RefreshCw size={14} aria-hidden /> Check again
    </button>
  );
}

/** Dashboard card: the check's status and every individual check. */
export function DeploymentCheckCard() {
  const { protocol } = useProtocol();
  const check = useDeploymentCheck();
  if (protocol.kind !== 'v2') return null;
  const r = check.data;
  const passed = r?.checks.filter((c) => c.ok).length ?? 0;
  return (
    <section aria-labelledby="deploy-h" className="glass space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="deploy-h" className="font-semibold">
          Deployment check
        </h2>
        {r ? (
          r.ok ? (
            <span className="text-clue-ink inline-flex items-center gap-1 text-sm font-semibold">
              <CircleCheck size={16} aria-hidden /> Green · {passed}/{r.checks.length}
            </span>
          ) : (
            <span className="text-mask-ink inline-flex items-center gap-1 text-sm font-semibold">
              <CircleX size={16} aria-hidden /> Mismatch · {passed}/{r.checks.length}
            </span>
          )
        ) : check.isError ? (
          <span className="text-mask-ink text-sm font-semibold">Couldn&apos;t run</span>
        ) : (
          <span className="text-muted text-sm">Checking…</span>
        )}
      </div>
      <p className="text-muted text-sm">
        Code at every bundle address on both chains, plus the vault, hook, routers, receiver and sender wiring. Writes stay disabled until it passes. Runs once per
        session.
      </p>
      {r && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Show all {r.checks.length} checks</summary>
          <ul className="mt-2 space-y-1">
            {r.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                {c.ok ? <CircleCheck size={15} className="text-clue-ink mt-0.5 shrink-0" aria-hidden /> : <CircleX size={15} className="text-mask-ink mt-0.5 shrink-0" aria-hidden />}
                <span>
                  {c.label} <span className="text-muted">· {chainName(c.chainId)}</span>
                  <span className="sr-only">{c.ok ? ' (passed)' : ' (failed)'}</span>
                  {!c.ok && c.actual && <span className="num block text-xs break-all">read {c.actual}{c.expected ? ` · expected ${c.expected}` : ''}</span>}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {check.isError && <RecheckButton />}
    </section>
  );
}
