import { parseEventLogs, type Abi, type Log } from 'viem';
import {
  ccipStakeSenderAbi,
  ccipStakeSenderV2Abi,
  riskFiStakeVaultV2Abi,
  settlementAbi,
  stakeAndSellRouterV2Abi,
  yieldCurveHookV2Abi,
  yieldMarketHookAbi,
} from '@/contracts';
import type { TxEffect } from './types';

// Decodes what the UI reports after a plan: CCIP messageId (Sent), amount received (Swapped,
// StakedAndSold), amount paid (Redeemed, PrincipalClaimed).
const ABI = [
  ...ccipStakeSenderAbi,
  ...ccipStakeSenderV2Abi,
  ...yieldMarketHookAbi,
  ...yieldCurveHookV2Abi,
  ...stakeAndSellRouterV2Abi,
  ...settlementAbi,
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
    if (e.eventName === 'Sent' && typeof a.messageId === 'string') out.messageId = a.messageId as `0x${string}`;
    if (e.eventName === 'Swapped' && typeof a.amountOut === 'bigint') out.amountOut = a.amountOut;
    if (e.eventName === 'StakedAndSold' && typeof a.usdcReceived === 'bigint') out.amountOut = a.usdcReceived;
    if ((e.eventName === 'Redeemed' || e.eventName === 'PrincipalClaimed') && typeof a.paid === 'bigint') out.paid = a.paid;
  }
  return out;
}
