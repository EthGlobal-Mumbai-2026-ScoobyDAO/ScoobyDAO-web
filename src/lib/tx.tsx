'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, CheckCircle2, ExternalLink, Loader2, Repeat, Wallet, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Hex } from 'viem';
import { getAccount, simulateContract, switchChain, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { decodeEffects, type TxPlan } from '@/protocol';
import { fakeTxHash } from '@/protocol/fixture';
import { revertReason } from './errors';
import { chainName, explorer, explorerName } from './explorer';
import { shortHex } from './format';
import { runPlan, type RunResult, type StepProgress } from './runPlan';
import { wagmiConfig } from './wagmi';

type Loose = Record<string, unknown>;
const simulate = simulateContract as unknown as (c: typeof wagmiConfig, p: Loose) => Promise<{ request: Loose }>;
const write = writeContract as unknown as (c: typeof wagmiConfig, p: Loose) => Promise<Hex>;

const deps = {
  currentChainId: () => getAccount(wagmiConfig).chainId,
  switchChain: async (chainId: number) => {
    await switchChain(wagmiConfig, { chainId: chainId as 11155111 | 421614 });
  },
  send: async (req: { address: `0x${string}` } & Loose) => {
    const account = getAccount(wagmiConfig).address;
    const { request } = await simulate(wagmiConfig, { ...req, account, chainId: getAccount(wagmiConfig).chainId });
    return write(wagmiConfig, request);
  },
  confirm: async (hash: Hex, req: Loose) => {
    const chainId = getAccount(wagmiConfig).chainId as 11155111 | 421614;
    const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId });
    if (receipt.status === 'reverted') {
      // Replay at the same block to recover the revert string.
      let reason = 'Transaction reverted';
      try {
        await simulate(wagmiConfig, { ...req, account: receipt.from, blockNumber: receipt.blockNumber, chainId });
      } catch (e) {
        reason = revertReason(e);
      }
      return { ok: false as const, reason };
    }
    return { ok: true as const, logs: receipt.logs };
  },
  decode: decodeEffects,
  fakeHash: fakeTxHash,
  chainName,
};

interface Toast extends StepProgress {
  id: string;
}
export type RunPlan = (plan: TxPlan, onProgress?: (p: StepProgress) => void) => Promise<RunResult>;
const Ctx = createContext<RunPlan | null>(null);

export function TxProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const qc = useQueryClient();

  const run = useCallback<RunPlan>(
    async (plan, onProgress) => {
      const runId = `${Date.now()}-${Math.random()}`;
      const result = await runPlan(plan, deps as never, (p) => {
        onProgress?.(p);
        const id = `${runId}-${p.index}`;
        setToasts((ts) => {
          const rest = ts.filter((t) => t.id !== id);
          return [...rest.slice(-3), { ...p, id }];
        });
        if (p.status === 'done') setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 9000);
      });
      // Every write can change chain state the pages read.
      await qc.invalidateQueries({ queryKey: ['protocol'] });
      return result;
    },
    [qc],
  );

  const value = useMemo(() => run, [run]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <Toaster toasts={toasts} dismiss={(id) => setToasts((ts) => ts.filter((t) => t.id !== id))} />
    </Ctx.Provider>
  );
}

export function useRunPlan(): RunPlan {
  const c = useContext(Ctx);
  if (!c) throw new Error('useRunPlan must be used inside TxProvider');
  return c;
}

const PHASE_COPY: Record<StepProgress['status'], string> = {
  idle: 'Waiting',
  switching: 'Switch network in your wallet',
  wallet: 'Confirm in your wallet',
  pending: 'Pending onchain',
  done: 'Confirmed',
  failed: 'Failed',
};

function Toaster({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <ol
      aria-live="polite"
      aria-label="Transactions"
      className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
    >
      {toasts.map((t) => (
        <li
          key={t.id}
          role={t.status === 'failed' ? 'alert' : 'status'}
          className={`bg-surface pointer-events-auto w-full rounded-xl border p-3.5 shadow-2xl ${
            t.status === 'failed'
              ? 'border-[color-mix(in_srgb,var(--mask-500)_60%,transparent)]'
              : t.status === 'done'
                ? 'border-[color-mix(in_srgb,var(--clue-500)_55%,transparent)]'
                : 'border-line'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">
              {t.status === 'switching' && <Repeat size={18} className="text-beam-ink" aria-hidden />}
              {(t.status === 'wallet' || t.status === 'idle') && <Wallet size={18} className="text-beam-ink" aria-hidden />}
              {t.status === 'pending' && <Loader2 size={18} className="text-beam-ink animate-spin" aria-hidden />}
              {t.status === 'done' && <CheckCircle2 size={18} className="text-clue-ink" aria-hidden />}
              {t.status === 'failed' && <AlertOctagon size={18} className="text-mask-ink" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">
                {t.total > 1 && (
                  <span className="num text-muted mr-1.5">
                    {t.index + 1}/{t.total}
                  </span>
                )}
                {t.label}
              </p>
              <p className="text-muted">
                {PHASE_COPY[t.status]} · {chainName(t.chainId)}
                {t.simulated && ' · fixture, no real tx'}
              </p>
              {t.reason && <p className="num text-mask-ink mt-1 text-[13px] break-words">{t.reason}</p>}
              {t.hash && !t.simulated && (
                <a
                  href={explorer.tx(t.hash, t.chainId)}
                  target="_blank"
                  rel="noreferrer"
                  className="num text-beam-ink mt-1 inline-flex items-center gap-1 text-[13px] underline-offset-2 hover:underline"
                >
                  {shortHex(t.hash, 10, 6)} <ExternalLink size={12} aria-hidden />
                  <span className="sr-only">View on {explorerName(t.chainId)}</span>
                </a>
              )}
              {t.hash && t.simulated && <p className="num text-muted mt-1 text-[13px]">{shortHex(t.hash, 10, 6)}</p>}
            </div>
            {(t.status === 'failed' || t.status === 'done') && (
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-muted hover:text-text">
                <X size={16} aria-hidden />
              </button>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
