import { parseEventLogs, toFunctionSelector, type Abi, type Log } from 'viem';
import * as v1Abis from '@/contracts/generated';
import { ccipStakeSenderAbi, settlementAbi, yieldMarketHookAbi } from '@/contracts/generated';
import { ccipStakeSenderV2Abi, riskFiStakeVaultV2Abi, stakeAndSellRouterV2Abi, v2Abis, yieldCurveHookV2Abi } from '@/contracts/v2';
import type { TxEffect } from './types';

type AbiError = Extract<Abi[number], { type: 'error' }>;

// Decodes what the UI reports after a plan: CCIP Sent (messageId and intent), amount received
// (Swapped, StakedAndSold), amount paid (Redeemed, PrincipalClaimed), V2 Staked and LP shares.
// V1 event ABIs come from generated.ts, V2 ones only from the handoff bundle.
const ABI = [
  ...ccipStakeSenderAbi,
  ...yieldMarketHookAbi,
  ...settlementAbi,
  ...ccipStakeSenderV2Abi,
  ...yieldCurveHookV2Abi,
  ...stakeAndSellRouterV2Abi,
  ...riskFiStakeVaultV2Abi,
] as Abi;

export function decodeEffects(logs: Log[]): TxEffect {
  const out: TxEffect = {};
  let parsed: { eventName?: string; args?: unknown }[] = [];
  try {
    parsed = parseEventLogs({ abi: ABI, logs, strict: false }) as typeof parsed;
  } catch {
    return out;
  }
  for (const e of parsed) {
    const a = (e.args ?? {}) as Record<string, unknown>;
    if (e.eventName === 'Sent' && typeof a.messageId === 'string') {
      out.messageId = a.messageId as `0x${string}`;
      if (typeof a.sourceAccount === 'string')
        out.sent = {
          messageId: a.messageId as `0x${string}`,
          sourceAccount: a.sourceAccount as `0x${string}`,
          reportId: a.reportId as bigint,
          recipient: a.recipient as `0x${string}`,
          yes: a.yes as boolean,
          amount: a.amount as bigint,
        };
    }
    if (e.eventName === 'Swapped' && typeof a.amountOut === 'bigint') out.amountOut = a.amountOut;
    if (e.eventName === 'StakedAndSold' && typeof a.usdcReceived === 'bigint') out.amountOut = a.usdcReceived;
    if ((e.eventName === 'Redeemed' || e.eventName === 'PrincipalClaimed') && typeof a.paid === 'bigint') out.paid = a.paid;
    if (e.eventName === 'Staked' && typeof a.amount === 'bigint' && typeof a.ytReceiver === 'string')
      out.staked = { owner: a.owner as `0x${string}`, yes: a.yes as boolean, amount: a.amount, ytReceiver: a.ytReceiver as `0x${string}` };
    if (e.eventName === 'LiquidityAdded' && typeof a.shares === 'bigint') out.lpMinted = a.shares;
    if (e.eventName === 'LiquidityRemoved' && typeof a.usdcAmount === 'bigint')
      out.lpRemoved = { usdc: a.usdcAmount, yt: a.ytAmount as bigint };
  }
  return out;
}

const errorSig = (e: AbiError) => toFunctionSelector(`${e.name}(${e.inputs.map((i) => i.type).join(',')})`);

/**
 * Every custom error in the V1 and V2 ABIs, deduplicated by selector. Errors bubble up from nested
 * calls (e.g. TokenCallFailed() from the vault inside StakeAndSellRouterV2, InvalidRouter(address)
 * from the CCIP receiver), so the caller's own ABI isn't enough to decode them.
 */
export const KNOWN_ERRORS: AbiError[] = (() => {
  const seen = new Map<string, AbiError>();
  for (const abi of [...Object.values(v2Abis), ...Object.values(v1Abis)] as unknown as Abi[])
    for (const item of abi) if (item.type === 'error' && !seen.has(errorSig(item))) seen.set(errorSig(item), item);
  return [...seen.values()];
})();

/** The call's ABI plus any known error it lacks, for simulation and revert replay. */
export function withKnownErrors(abi: Abi): Abi {
  const have = new Set(abi.filter((i): i is AbiError => i.type === 'error').map(errorSig));
  return [...abi, ...KNOWN_ERRORS.filter((e) => !have.has(errorSig(e)))];
}
