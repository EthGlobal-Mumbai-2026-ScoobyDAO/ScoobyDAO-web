import { encodeEventTopics, isAddressEqual, parseEventLogs, type Abi, type Address, type Hex, type Log } from 'viem';
import {
  ARB_SEPOLIA_ID,
  ccipStakeReceiverV2Abi,
  ccipStakeSenderV2Abi,
  demoUsdAbi,
  reportRegistryAbi,
  riskFiStakeVaultV2Abi,
  SEPOLIA_ID,
  stakeAndSellRouterV2Abi,
  stakeReceiptRepAbi,
  stakerYieldTokenAbi,
  v2,
  yieldCurveHookV2Abi,
  yieldLpShareAbi,
  yieldSwapRouterAbi,
  type V2Bundle,
} from '@/contracts/v2';
import type { ReadCall } from './clients';
import type { ContractCall } from './types';

// Every V2 contract the app talks to, keyed by (chainId, bundle name), with the exact functions and
// events it uses. read()/write()/logsOf() only accept names listed in V2_USAGE (checked by
// TypeScript), and src/protocol/v2abi.test.ts checks V2_USAGE against the bundle ABIs.

export function makeV2Handles(bundle: V2Bundle) {
  return {
    registry: { name: 'ReportRegistry', chainId: SEPOLIA_ID, address: bundle.sepolia.ReportRegistry, abi: reportRegistryAbi },
    vault: { name: 'RiskFiStakeVaultV2', chainId: SEPOLIA_ID, address: bundle.sepolia.RiskFiStakeVaultV2, abi: riskFiStakeVaultV2Abi },
    rep: { name: 'StakeReceiptREP', chainId: SEPOLIA_ID, address: bundle.sepolia.StakeReceiptREP, abi: stakeReceiptRepAbi },
    yt: { name: 'StakerYieldToken', chainId: SEPOLIA_ID, address: bundle.sepolia.StakerYieldToken, abi: stakerYieldTokenAbi },
    hook: { name: 'YieldCurveHookV2', chainId: SEPOLIA_ID, address: bundle.sepolia.YieldCurveHookV2, abi: yieldCurveHookV2Abi },
    lp: { name: 'YieldLPShare', chainId: SEPOLIA_ID, address: bundle.sepolia.YieldLPShare, abi: yieldLpShareAbi },
    swapRouter: { name: 'YieldSwapRouter', chainId: SEPOLIA_ID, address: bundle.sepolia.YieldSwapRouter, abi: yieldSwapRouterAbi },
    stakeAndSell: { name: 'StakeAndSellRouterV2', chainId: SEPOLIA_ID, address: bundle.sepolia.StakeAndSellRouterV2, abi: stakeAndSellRouterV2Abi },
    receiver: { name: 'CCIPStakeReceiverV2', chainId: SEPOLIA_ID, address: bundle.sepolia.CCIPStakeReceiverV2, abi: ccipStakeReceiverV2Abi },
    dusd: { name: 'DemoUSD', chainId: SEPOLIA_ID, address: bundle.sepolia.DemoUSD, abi: demoUsdAbi },
    sender: { name: 'CCIPStakeSenderV2', chainId: ARB_SEPOLIA_ID, address: bundle.arbitrumSepolia.CCIPStakeSenderV2, abi: ccipStakeSenderV2Abi },
    dusdArb: { name: 'DemoUSD', chainId: ARB_SEPOLIA_ID, address: bundle.arbitrumSepolia.DemoUSD, abi: demoUsdAbi },
  } as const;
}
export const V2 = makeV2Handles(v2);

export type V2Handle = keyof typeof V2;

const ERC20 = ['balanceOf', 'allowance', 'approve', 'transfer', 'totalSupply'] as const;

/** Every function and event the V2 adapter, CCIP tracker and deployment check use. */
export const V2_USAGE = {
  registry: { functions: ['getReport', 'maturity', 'reportCount'], events: [] },
  vault: {
    functions: [
      'reportId', 'yt', 'rep', 'registry', 'usdc', 'totalYes', 'totalNo', 'positionOf', 'proposed', 'proposedAt', 'challenged',
      'finalOutcome', 'finalizedAt', 'evidenceHash', 'principalAvailable', 'maturity', 'feeClaimed', 'treasury',
      'stake', 'deposit', 'stakeFromREP', 'withdraw', 'challenge', 'finalize', 'claimPrincipal', 'propose', 'adjudicate',
      'injectYield', 'claimFee',
    ],
    events: ['Staked', 'Deposited', 'Withdrawn', 'PrincipalClaimed'],
  },
  rep: { functions: ['balanceOf', 'totalSupply', 'transfer'], events: ['Transfer'] },
  yt: { functions: [...ERC20, 'globalIndex', 'paidIndex', 'unclaimedUSDC', 'claimYield'], events: ['Transfer'] },
  hook: {
    functions: [
      'poolKeyHash', 'shares', 'yt', 'usdc', 'manager', 'usdcReserve', 'ytReserve', 'spotPriceWad', 'impliedRateWad',
      'timeRemainingWad', 'feePips', 'maturity', 'lpYieldPerShare', 'paidLPIndex', 'unclaimedLPYield', 'quoteBuy', 'quoteSell',
      'addLiquidity', 'removeLiquidity', 'claimLPYield',
    ],
    events: ['Swapped', 'RateObserved', 'LiquidityAdded', 'LiquidityRemoved'],
  },
  lp: { functions: ['balanceOf', 'totalSupply'], events: [] },
  swapRouter: { functions: ['manager', 'swapExactInput'], events: [] },
  stakeAndSell: { functions: ['vault', 'hook', 'swapRouter', 'yt', 'usdc', 'ytIsCurrency0', 'quoteSell', 'stakeAndSellYield'], events: ['StakedAndSold'] },
  receiver: {
    functions: ['vault', 'sourceSender', 'sourceSelector', 'usdc', 'delivered', 'recoverable', 'recoverySourceAccount', 'recoveryOperator', 'recover'],
    events: ['Credited', 'DeferredAsREP', 'Held', 'Recovered'],
  },
  dusd: { functions: ['balanceOf', 'allowance', 'approve'], events: ['Transfer'] },
  sender: {
    functions: ['destinationReceiver', 'destinationSelector', 'sourceUSD', 'reportCutoff', 'usedNonce', 'quoteFee', 'stakeRemote'],
    events: ['Sent'],
  },
  dusdArb: { functions: ['balanceOf', 'allowance', 'approve'], events: [] },
} as const satisfies Record<V2Handle, { functions: readonly string[]; events: readonly string[] }>;

export type V2Fn<H extends V2Handle> = (typeof V2_USAGE)[H]['functions'][number];
export type V2Event<H extends V2Handle> = (typeof V2_USAGE)[H]['events'][number];

/** A read for multicall/readContract. */
export function read<H extends V2Handle>(h: H, functionName: V2Fn<H>, args: readonly unknown[] = [], contracts = V2): ReadCall {
  return { address: contracts[h].address, abi: contracts[h].abi, functionName, args };
}

/** A wallet write for a TxPlan step. */
export function write<H extends V2Handle>(h: H, functionName: V2Fn<H>, args: readonly unknown[] = [], value?: bigint, contracts = V2): ContractCall {
  return { address: contracts[h].address, abi: contracts[h].abi as Abi, functionName, args, ...(value !== undefined ? { value } : {}) };
}

/** Decoded logs of one event, emitted by that contract only. */
export function logsOf<H extends V2Handle>(h: H, eventName: V2Event<H>, logs: Log[], contracts = V2) {
  return (parseEventLogs({ abi: contracts[h].abi as Abi, eventName, logs, strict: true }) as unknown as { address: Address; args: Record<string, unknown>; transactionHash: Hex | null; blockNumber: bigint | null; logIndex: number | null }[]).filter(
    (l) => isAddressEqual(l.address, contracts[h].address),
  );
}

/** topic0 of an event, for eth_getLogs filters. */
export function eventTopic<H extends V2Handle>(h: H, eventName: V2Event<H>, contracts = V2): Hex {
  return encodeEventTopics({ abi: contracts[h].abi as Abi, eventName } as never)[0] as Hex;
}

/** dUSD received by `to` from `from` in these logs (yield claims emit only the token transfer). */
export function dusdReceived(logs: Log[], from: Address, to: Address, contracts = V2): bigint {
  return logsOf('dusd', 'Transfer', logs, contracts)
    .filter((l) => isAddressEqual(l.args.from as Address, from) && isAddressEqual(l.args.to as Address, to))
    .reduce((sum, l) => sum + (l.args.value as bigint), 0n);
}
