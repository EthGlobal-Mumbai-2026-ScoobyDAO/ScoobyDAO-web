'use client';

import { AlertOctagon, CheckCircle2, ExternalLink, Loader2, Wallet, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Abi, Address, Hex } from 'viem';
import { simulateContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { contractsDeployed } from '@/contracts';
import { revertReason } from './errors';
import { explorer } from './explorer';
import { FixtureRevert, fakeTxHash } from './fixtureChain';
import { shortHex } from './format';
import { useFixturesMode } from './queries';
import { wagmiConfig } from './wagmi';

type Phase = 'wallet' | 'pending' | 'confirmed' | 'failed';
interface Toast {
  id: number;
  label: string;
  phase: Phase;
  hash?: Hex;
  reason?: string;
  simulated?: boolean;
}

export interface WriteParams {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  account?: Address;
}

export interface TxSpec {
  /** Verb phrase used in every toast state, e.g. "Commit sealed stake". */
  label: string;
  /** Real transaction. */
  live: () => WriteParams;
  /** Fixture-mode effect; throw FixtureRevert to simulate a revert. */
  fixture: () => void;
  /** Send without a pre-flight simulation (the "force it anyway" demo on a frozen pool). */
  force?: boolean;
  /** Called with the decoded revert reason when the tx fails. */
  onFailed?: (reason: string) => void;
}

// Call sites build params from the typed ABIs in src/contracts; the runner only forwards them.
type Loose = Record<string, unknown>;
const simulate = simulateContract as unknown as (
  c: typeof wagmiConfig,
  p: Loose,
) => Promise<{ request: Loose }>;
const write = writeContract as unknown as (c: typeof wagmiConfig, p: Loose) => Promise<Hex>;

const Ctx = createContext<{ run: (spec: TxSpec) => Promise<boolean> } | null>(null);

export function TxProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fixtures = useFixturesMode().data ?? true;
  const simulated = fixtures || !contractsDeployed;

  const update = useCallback((id: number, patch: Partial<Toast>) => {
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    if (patch.phase === 'confirmed')
      setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 9000);
  }, []);

  const run = useCallback(
    async (spec: TxSpec): Promise<boolean> => {
      const id = Date.now() + Math.random();
      const fail = (reason: string, hash?: Hex) => {
        update(id, { phase: 'failed', reason, ...(hash ? { hash } : {}) });
        spec.onFailed?.(reason);
        return false;
      };
      setToasts((ts) => [...ts.slice(-3), { id, label: spec.label, phase: 'wallet', simulated }]);

      if (simulated) {
        await new Promise((r) => setTimeout(r, 500));
        const hash = fakeTxHash();
        update(id, { phase: 'pending', hash });
        await new Promise((r) => setTimeout(r, 1300));
        try {
          spec.fixture();
          update(id, { phase: 'confirmed' });
          return true;
        } catch (e) {
          return fail(e instanceof FixtureRevert ? e.reason : revertReason(e));
        }
      }

      let hash: Hex | undefined;
      const params = spec.live() as unknown as Loose;
      try {
        if (spec.force) {
          hash = await write(wagmiConfig, { ...params, gas: 500_000n });
        } else {
          const { request } = await simulate(wagmiConfig, params);
          hash = await write(wagmiConfig, request);
        }
        update(id, { phase: 'pending', hash });
        const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
        if (receipt.status === 'reverted') {
          // Replay at the same block to recover the revert string.
          let reason = 'Transaction reverted';
          try {
            await simulate(wagmiConfig, { ...params, blockNumber: receipt.blockNumber });
          } catch (e) {
            reason = revertReason(e);
          }
          return fail(reason);
        }
        update(id, { phase: 'confirmed' });
        return true;
      } catch (e) {
        return fail(revertReason(e), hash);
      }
    },
    [simulated, update],
  );

  const value = useMemo(() => ({ run }), [run]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <Toaster toasts={toasts} dismiss={(id) => setToasts((ts) => ts.filter((t) => t.id !== id))} />
    </Ctx.Provider>
  );
}

export function useTx() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTx must be used inside TxProvider');
  return c.run;
}

const PHASE_COPY: Record<Phase, string> = {
  wallet: 'Confirm in your wallet',
  pending: 'Pending onchain',
  confirmed: 'Confirmed',
  failed: 'Failed',
};

function Toaster({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <ol
      aria-live="polite"
      aria-label="Transactions"
      className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
    >
      {toasts.map((t) => (
        <li
          key={t.id}
          role={t.phase === 'failed' ? 'alert' : 'status'}
          className={`bg-surface pointer-events-auto w-full rounded-xl border p-3.5 shadow-2xl ${
            t.phase === 'failed'
              ? 'border-[color-mix(in_srgb,var(--mask-500)_60%,transparent)]'
              : t.phase === 'confirmed'
                ? 'border-[color-mix(in_srgb,var(--clue-500)_55%,transparent)]'
                : 'border-line'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">
              {t.phase === 'wallet' && <Wallet size={18} className="text-beam-ink" aria-hidden />}
              {t.phase === 'pending' && (
                <Loader2 size={18} className="text-beam-ink animate-spin" aria-hidden />
              )}
              {t.phase === 'confirmed' && (
                <CheckCircle2 size={18} className="text-clue-ink" aria-hidden />
              )}
              {t.phase === 'failed' && (
                <AlertOctagon size={18} className="text-mask-ink" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{t.label}</p>
              <p className="text-muted">
                {PHASE_COPY[t.phase]}
                {t.simulated && ' · fixture, no real tx'}
              </p>
              {t.reason && (
                <p className="num text-mask-ink mt-1 text-[13px] break-words">{t.reason}</p>
              )}
              {t.hash && !t.simulated && (
                <a
                  href={explorer.tx(t.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="num text-beam-ink mt-1 inline-flex items-center gap-1 text-[13px] underline-offset-2 hover:underline"
                >
                  {shortHex(t.hash, 10, 6)} <ExternalLink size={12} aria-hidden />
                  <span className="sr-only">View on Etherscan</span>
                </a>
              )}
              {t.hash && t.simulated && (
                <p className="num text-muted mt-1 text-[13px]">{shortHex(t.hash, 10, 6)}</p>
              )}
            </div>
            {(t.phase === 'failed' || t.phase === 'confirmed') && (
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="text-muted hover:text-text"
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
