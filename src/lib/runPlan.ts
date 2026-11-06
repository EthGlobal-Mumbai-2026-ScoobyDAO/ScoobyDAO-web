import type { Hex, Log } from 'viem';
import { ProtocolRevert, type ContractCall, type TxEffect, type TxPlan } from '@/protocol/types';
import { revertReason } from './errors';

// Executes a TxPlan step by step. Pure orchestration: wallet/chain access is injected so the
// same logic runs against wagmi in the browser and against stubs in tests.

export type StepStatus = 'idle' | 'switching' | 'preparing' | 'wallet' | 'pending' | 'done' | 'failed';

export interface StepProgress {
  index: number;
  total: number;
  label: string;
  chainId: number;
  status: StepStatus;
  hash?: Hex;
  reason?: string;
  simulated?: boolean;
}

export interface RunDeps {
  currentChainId: () => number | undefined;
  switchChain: (chainId: number) => Promise<void>;
  /** simulate → estimate gas (+20%) → send; returns the tx hash. Throws on simulation failure or user rejection. */
  send: (req: ContractCall, chainId: number) => Promise<Hex>;
  /** Wait for the receipt on `chainId`; unless status is 'success', replay at that block and return the reason. */
  confirm: (hash: Hex, req: ContractCall, chainId: number) => Promise<{ ok: true; logs: Log[] } | { ok: false; reason: string }>;
  decode: (logs: Log[]) => TxEffect;
  fakeHash: () => Hex;
  delay?: (ms: number) => Promise<void>;
  chainName: (id: number) => string;
  /** Checked once before the first real transaction; a returned reason stops the plan (e.g. deployment mismatch). */
  gate?: () => Promise<string | undefined>;
}

export interface RunResult {
  ok: boolean;
  effect: TxEffect;
  /** Hash of the last step sent (e.g. the CCIP source tx). */
  lastHash?: Hex;
  failedAt?: number;
  reason?: string;
}

/** Gas limit sent with every write: the estimate plus 20%. Never a fixed override. */
export const GAS_MARGIN_PERCENT = 20n;
export const withGasMargin = (estimate: bigint) => (estimate * (100n + GAS_MARGIN_PERCENT)) / 100n;

export async function runPlan(plan: TxPlan, deps: RunDeps, onProgress: (p: StepProgress) => void = () => {}): Promise<RunResult> {
  const effect: TxEffect = {};
  let lastHash: Hex | undefined;
  let gated = false;
  const wait = deps.delay ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    const base = { index: i, total: plan.length, label: step.label, chainId: step.chainId };
    const fail = (reason: string, hash?: Hex): RunResult => {
      onProgress({ ...base, status: 'failed', reason, hash, simulated: !!step.fixture });
      return { ok: false, effect, failedAt: i, reason };
    };

    if (step.fixture) {
      onProgress({ ...base, status: 'wallet', simulated: true });
      await wait(350);
      const hash = deps.fakeHash();
      onProgress({ ...base, status: 'pending', hash, simulated: true });
      await wait(700);
      try {
        Object.assign(effect, step.fixture() ?? {});
      } catch (e) {
        return fail(e instanceof ProtocolRevert ? e.reason : revertReason(e), hash);
      }
      onProgress({ ...base, status: 'done', hash, simulated: true });
      lastHash = hash;
      continue;
    }

    if (!step.request && !step.prepare) return fail('Nothing to send for this step');
    if (!gated && deps.gate) {
      gated = true;
      const blocked = await deps.gate().catch((e: unknown) => revertReason(e));
      if (blocked) return fail(blocked);
    }
    if (deps.currentChainId() !== step.chainId) {
      onProgress({ ...base, status: 'switching' });
      try {
        await deps.switchChain(step.chainId);
      } catch (e) {
        return fail(`Switch your wallet to ${deps.chainName(step.chainId)} to continue. ${revertReason(e)}`);
      }
      if (deps.currentChainId() !== step.chainId) return fail(`Your wallet is still on another network. Switch to ${deps.chainName(step.chainId)}.`);
    }

    let request = step.request;
    if (step.prepare) {
      onProgress({ ...base, status: 'preparing' });
      try {
        request = await step.prepare();
      } catch (e) {
        return fail(e instanceof ProtocolRevert ? e.reason : revertReason(e));
      }
    }
    if (!request) return fail('Nothing to send for this step');

    onProgress({ ...base, status: 'wallet' });
    let hash: Hex;
    try {
      hash = await deps.send(request, step.chainId);
    } catch (e) {
      return fail(revertReason(e));
    }
    onProgress({ ...base, status: 'pending', hash });
    try {
      const r = await deps.confirm(hash, request, step.chainId);
      if (!r.ok) return fail(r.reason, hash);
      Object.assign(effect, deps.decode(r.logs), step.decode?.(r.logs) ?? {});
    } catch (e) {
      return fail(revertReason(e), hash);
    }
    onProgress({ ...base, status: 'done', hash });
    lastHash = hash;
  }
  return { ok: true, effect, lastHash };
}
