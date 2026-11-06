import { getAddress, type Address, type Hex } from 'viem';
import bundle from './addresses.json';
import flexibleBundle from '../accelerated/addresses.json';

// The V2 handoff bundle (../v2, copied by `npm run sync:v2`) is the only source for V2 addresses,
// selectors, the pool key and report #1. Addresses are keyed by (chainId, contract name), never by
// address alone: 0xfb2c…88e5 is the V1 ReportRegistry on Ethereum Sepolia *and* the V2
// CCIPStakeSenderV2 on Arbitrum Sepolia.
// Only src/protocol may import from here (pages and components go through src/protocol).

export * from './abis';

export const SEPOLIA_ID = 11155111 as const;
export const ARB_SEPOLIA_ID = 421614 as const;
export type V2ChainId = typeof SEPOLIA_ID | typeof ARB_SEPOLIA_ID;

export function makeV2Bundle(raw: typeof bundle) {
const S = raw.ethereumSepolia.contracts;
const A = raw.arbitrumSepolia.contracts;

const sepolia = {
  DemoUSD: getAddress(S.DemoUSD),
  BurnMintTokenPool: getAddress(S.BurnMintTokenPool),
  ReportRegistry: getAddress(S.ReportRegistry),
  RiskFiStakeVaultV2: getAddress(S.RiskFiStakeVaultV2),
  StakeReceiptREP: getAddress(S.StakeReceiptREP),
  CCIPStakeReceiverV2: getAddress(S.CCIPStakeReceiverV2),
  StakerYieldToken: getAddress(S.StakerYieldToken),
  YieldCurveFactoryV2: getAddress(S.YieldCurveFactoryV2),
  YieldCurveHookV2: getAddress(S.YieldCurveHookV2),
  YieldLPShare: getAddress(S.YieldLPShare),
  YieldSwapRouter: getAddress(S.YieldSwapRouter),
  StakeAndSellRouterV2: getAddress(S.StakeAndSellRouterV2),
  PoolManager: getAddress(S.PoolManager),
  CCIPRouter: getAddress(S.CCIPRouter),
} as const;

const arbitrumSepolia = {
  DemoUSD: getAddress(A.DemoUSD),
  BurnMintTokenPool: getAddress(A.BurnMintTokenPool),
  CCIPStakeSenderV2: getAddress(A.CCIPStakeSenderV2),
  CCIPRouter: getAddress(A.CCIPRouter),
} as const;

const key = raw.ethereumSepolia.ytPoolKey;
const r = raw.ethereumSepolia.report;
const t = raw.ethereumSepolia.reportTimes;

return {
  version: raw.version,
  chainIds: { sepolia: SEPOLIA_ID, arbitrumSepolia: ARB_SEPOLIA_ID },
  sepolia,
  arbitrumSepolia,
  /** CCIP chain selectors exceed Number.MAX_SAFE_INTEGER, so they are bigints. */
  selectors: {
    sepolia: BigInt(raw.ethereumSepolia.chainSelector),
    arbitrumSepolia: BigInt(raw.arbitrumSepolia.chainSelector),
    /** What the Arbitrum sender was configured to send to. */
    senderDestination: BigInt(raw.arbitrumSepolia.destinationSelector),
  },
  /** The single YT/dUSD v4 pool: hook-owned inventory, fee 0, tick spacing 1. */
  poolKey: {
    currency0: getAddress(key.currency0),
    currency1: getAddress(key.currency1),
    fee: key.fee,
    tickSpacing: key.tickSpacing,
    hooks: getAddress(key.hooks),
  },
  poolKeyHash: raw.ethereumSepolia.poolKeyHash as Hex,
  /** The report the deployed vault serves (vault.reportId()). */
  reportId: BigInt(raw.ethereumSepolia.reportId),
  /**
   * Snapshot of report #1 at deployment. The UI derives every time and role from chain reads;
   * this snapshot is for tests and for recognising the demo hashes (not linked to any backend report).
   */
  report: {
    reportId: BigInt(r.reportId),
    reportHash: r.reportHash as Hex,
    claimHash: r.claimHash as Hex,
    reviewer: getAddress(r.reviewer),
    resolver: getAddress(r.resolver),
    adjudicator: getAddress(r.adjudicator),
    crossChainCutoff: t.crossChainCutoff,
    lockTime: t.lockTime,
    maturity: t.maturity,
    resultDeadline: r.resultDeadline,
    challengePeriod: r.challengePeriodSeconds,
  },
  /** A delivered CCIP message (first destination attempt failed on low gas, then a manual retry). */
  exampleCCIP: {
    messageId: raw.exampleCCIP.messageId as Hex,
    sourceTx: raw.exampleCCIP.sourceTx as Hex,
    destinationTx: raw.exampleCCIP.destinationTx as Hex,
  },
} as const;
}

export const v2 = makeV2Bundle(bundle);
export const v2Flexible = makeV2Bundle(flexibleBundle);
export type V2Bundle = ReturnType<typeof makeV2Bundle>;
export type SepoliaContract = keyof typeof v2.sepolia;
export type ArbitrumContract = keyof typeof v2.arbitrumSepolia;

const BY_CHAIN: Record<V2ChainId, Readonly<Record<string, Address>>> = {
  [SEPOLIA_ID]: v2.sepolia,
  [ARB_SEPOLIA_ID]: v2.arbitrumSepolia,
};

/** Address of `name` on `chainId`, or undefined when the bundle has no such pair. */
export function addressOf(chainId: number, name: string): Address | undefined {
  return BY_CHAIN[chainId as V2ChainId]?.[name];
}

/** Every (chainId, name, address) in the bundle, for the deployment check. */
export function allContracts(): { chainId: V2ChainId; name: string; address: Address }[] {
  return [
    ...Object.entries(v2.sepolia).map(([name, address]) => ({ chainId: SEPOLIA_ID, name, address })),
    ...Object.entries(v2.arbitrumSepolia).map(([name, address]) => ({ chainId: ARB_SEPOLIA_ID, name, address })),
  ];
}
