import { getAddress, type Address } from 'viem';
import testnets from './testnets.json';

// V1 only: typed view of ../SmartContracts/deployments/testnets.json (copied by `npm run sync:contracts`).
// Any contract not in the file is `undefined`; features that need it show "Not deployed yet".
// V2 addresses come only from the handoff bundle in ./v2 (npm run sync:v2), never from this file.

export const SEPOLIA_ID = 11155111 as const;
export const ARB_SEPOLIA_ID = 421614 as const;

type Entry = { address?: string };
type ChainBlock = { chainId: number; contracts: Record<string, Entry | undefined> };
const file = testnets as unknown as { ethereumSepolia?: ChainBlock; arbitrumSepolia?: ChainBlock };

function pick(block: ChainBlock | undefined, name: string): Address | undefined {
  const a = block?.contracts?.[name]?.address;
  return a && /^0x[0-9a-fA-F]{40}$/.test(a) ? getAddress(a) : undefined;
}

const eth = file.ethereumSepolia;
const arb = file.arbitrumSepolia;

/** V1, deployed on Ethereum Sepolia. */
export const sepolia = {
  DemoUSD: pick(eth, 'DemoUSD'),
  Treasury: pick(eth, 'Treasury'),
  ReportRegistry: pick(eth, 'ReportRegistry'),
  VotingPositionToken: pick(eth, 'VotingPositionToken'),
  VoteMarket: pick(eth, 'VoteMarket'),
  Settlement: pick(eth, 'Settlement'),
  YieldSplitter: pick(eth, 'YieldSplitter'),
  YieldVaultAdapter: pick(eth, 'YieldVaultAdapter'),
  CCIPStakeReceiver: pick(eth, 'CCIPStakeReceiver'),
  Reputation: pick(eth, 'Reputation'),
  YieldHookFactory: pick(eth, 'YieldHookFactory'),
  // Not in testnets.json yet: written by DeployYieldHook.s.sol after a report locks.
  YieldMarketHook: pick(eth, 'YieldMarketHook'),
  YieldSwapRouter: pick(eth, 'YieldSwapRouter'),
} as const;

/** V1 CCIP source chain. */
export const arbitrumSepolia = {
  DemoUSD: pick(arb, 'DemoUSD'),
  CCIPStakeSender: pick(arb, 'CCIPStakeSender'),
} as const;

/** The minimum set the V1 adapter needs to read live. */
export const v1Deployed = !!(
  sepolia.DemoUSD &&
  sepolia.ReportRegistry &&
  sepolia.VoteMarket &&
  sepolia.VotingPositionToken &&
  sepolia.Settlement
);
export const ccipV1Deployed = !!(arbitrumSepolia.CCIPStakeSender && arbitrumSepolia.DemoUSD && sepolia.CCIPStakeReceiver);

export const deploymentTxs = {
  poolConfigurationTx: (eth as unknown as Record<string, string | undefined>)?.poolConfigurationTx,
  identitySignerMode: (eth as unknown as Record<string, string | undefined>)?.identitySignerMode,
};
