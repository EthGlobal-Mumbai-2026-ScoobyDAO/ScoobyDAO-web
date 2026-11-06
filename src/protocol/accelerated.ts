import { getAddress, type Abi, type Address } from 'viem';
import manifest from '@/contracts/accelerated/addresses.json';
import { demoUsdAbi, riskFiStakeVaultV2Abi, yieldCurveHookV2Abi, yieldSwapRouterAbi } from '@/contracts/v2';

const eth = manifest.ethereumSepolia;
const arb = manifest.arbitrumSepolia;
export const accelerated = {
  reportId: BigInt(eth.reportId),
  reportHash: eth.report.reportHash,
  claimHash: eth.report.claimHash,
  times: eth.reportTimes,
  resultDeadline: eth.report.resultDeadline,
  token: getAddress(eth.contracts.DemoUSD),
  registry: getAddress(eth.contracts.ReportRegistry),
  vault: getAddress(eth.contracts.RiskFiStakeVaultV2),
  yt: getAddress(eth.contracts.StakerYieldToken),
  hook: getAddress(eth.contracts.YieldCurveHookV2),
  router: getAddress(eth.contracts.YieldSwapRouter),
  sender: getAddress(arb.contracts.CCIPStakeSenderV2),
  receiver: getAddress(eth.contracts.CCIPStakeReceiverV2),
  faucet: getAddress('0x0c23f7d58e22554e20419728889ffce161938c35'),
  poolKey: {
    currency0: getAddress(eth.ytPoolKey.currency0),
    currency1: getAddress(eth.ytPoolKey.currency1),
    fee: eth.ytPoolKey.fee,
    tickSpacing: eth.ytPoolKey.tickSpacing,
    hooks: getAddress(eth.ytPoolKey.hooks),
  },
  tokenAbi: demoUsdAbi as Abi,
  vaultAbi: riskFiStakeVaultV2Abi as Abi,
  hookAbi: yieldCurveHookV2Abi as Abi,
  routerAbi: yieldSwapRouterAbi as Abi,
  faucetAbi: [{ type: 'function', name: 'claim', inputs: [], outputs: [], stateMutability: 'nonpayable' }] as const,
} as const;

export type AcceleratedAddress = Address;
