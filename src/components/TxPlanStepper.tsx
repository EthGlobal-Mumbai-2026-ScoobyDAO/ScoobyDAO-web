'use client';

import { CheckCircle2, Circle, ExternalLink, Loader2, Repeat, Wallet, XCircle } from 'lucide-react';
import { useCallback, useState } from 'react';
import { chainName, explorer } from '@/lib/explorer';
import type { RunResult, StepProgress } from '@/lib/runPlan';
import { useRunPlan } from '@/lib/tx';
import type { TxPlan } from '@/protocol/types';

/** Runs a TxPlan and tracks each step for the stepper ("1/2 Approve dUSD → 2/2 Stake"). */
export function usePlan() {
  const run = useRunPlan();
  const [steps, setSteps] = useState<StepProgress[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);

  const start = useCallback(
    async (build: () => Promise<TxPlan>) => {
      setRunning(true);
      setResult(null);
      setBuildError(null);
      try {
        const plan = await build();
        setSteps(plan.map((s, index) => ({ index, total: plan.length, label: s.label, chainId: s.chainId, status: 'idle' })));
        const r = await run(plan, (p) => setSteps((ss) => ss.map((s) => (s.index === p.index ? p : s))));
        setResult(r);
        return r;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setBuildError(msg);
        return { ok: false, effect: {}, reason: msg } as RunResult;
      } finally {
        setRunning(false);
      }
    },
    [run],
  );
  const reset = useCallback(() => {
    setSteps([]);
    setResult(null);
    setBuildError(null);
  }, []);
  return { start, steps, running, result, buildError, reset };
}

const ICON = {
  idle: Circle,
  switching: Repeat,
  preparing: Loader2,
  wallet: Wallet,
  pending: Loader2,
  done: CheckCircle2,
  failed: XCircle,
} as const;
const COPY: Record<StepProgress['status'], string> = {
  idle: 'Waiting',
  switching: 'Switch network in your wallet',
  preparing: 'Re-reading the latest quote',
  wallet: 'Confirm in your wallet',
  pending: 'Pending onchain',
  done: 'Confirmed',
  failed: 'Failed',
};

export function TxPlanStepper({ steps, buildError }: { steps: StepProgress[]; buildError?: string | null }) {
  if (buildError)
    return (
      <p role="alert" className="text-mask-ink text-sm">
        Couldn&apos;t prepare the transaction: {buildError}
      </p>
    );
  if (steps.length === 0) return null;
  return (
    <ol className="space-y-2" aria-label="Transaction steps">
      {steps.map((s) => {
        const Icon = ICON[s.status];
        return (
          <li key={s.index} className="flex items-start gap-2 text-sm">
            <Icon
              size={18}
              aria-hidden
              className={`mt-0.5 shrink-0 ${s.status === 'pending' || s.status === 'preparing' ? 'text-beam-ink animate-spin motion-reduce:animate-none' : s.status === 'done' ? 'text-clue-ink' : s.status === 'failed' ? 'text-mask-ink' : 'text-muted'}`}
            />
            <div className="min-w-0">
              <p>
                <span className="num text-muted">
                  {s.index + 1}/{s.total}
                </span>{' '}
                <span className="font-semibold">{s.label}</span>{' '}
                <span className="text-muted">
                  · {COPY[s.status]} · {chainName(s.chainId)}
                </span>
              </p>
              {s.hash && !s.simulated && (
                <a href={explorer.tx(s.hash, s.chainId)} target="_blank" rel="noreferrer" className="num text-beam-ink inline-flex items-center gap-1 text-xs underline">
                  {s.hash.slice(0, 12)}… <ExternalLink size={11} aria-hidden />
                </a>
              )}
              {s.simulated && s.hash && <p className="num text-muted text-xs">fixture tx {s.hash.slice(0, 12)}…</p>}
              {s.reason && <p className="text-mask-ink text-xs break-words">{s.reason}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function WrongChainPrompt({ ensure }: { ensure: { wrong: boolean; name: string; switching: boolean; ensure: () => Promise<boolean> } }) {
  if (!ensure.wrong) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm" role="status">
      <span className="text-beam-ink">Your wallet is on another network.</span>
      <button
        type="button"
        onClick={() => void ensure.ensure()}
        disabled={ensure.switching}
        className="border-line rounded-lg border px-2.5 py-1 font-semibold hover:border-[var(--fog-400)] disabled:opacity-60"
      >
        {ensure.switching ? 'Switching…' : `Switch to ${ensure.name}`}
      </button>
    </p>
  );
}
