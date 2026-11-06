import { zeroAddress } from 'viem';
import originalRaw from '@/contracts/v2/addresses.json';
import flexibleRaw from '@/contracts/accelerated/addresses.json';
import { makeV2Bundle } from '@/contracts/v2';
import type { ReportChoice } from './reportDiscovery';

/** Build a V2 adapter from the registry report and deployed market catalog, without a frontend release. */
export function bundleForMarket(choice: ReportChoice) {
  if (!choice.market || !choice.report) throw new Error('The report has no activated market.');
  const raw = choice.deployment === 'flexible' ? flexibleRaw : originalRaw;
  const m = choice.market;
  const r = choice.report;
  const currency0 = BigInt(m.yt) < BigInt(raw.ethereumSepolia.contracts.DemoUSD) ? m.yt : raw.ethereumSepolia.contracts.DemoUSD;
  const currency1 = BigInt(m.yt) < BigInt(raw.ethereumSepolia.contracts.DemoUSD) ? raw.ethereumSepolia.contracts.DemoUSD : m.yt;
  return makeV2Bundle({
    ...raw,
    version: `${raw.version}-${choice.id}-${m.vault}-${choice.ccipReady ? choice.sender : 'local'}`,
    ethereumSepolia: {
      ...raw.ethereumSepolia,
      reportId: Number(choice.id),
      reportTimes: { crossChainCutoff: r.crossChainCutoff, lockTime: choice.lockTime, maturity: choice.maturity },
      contracts: {
        ...raw.ethereumSepolia.contracts,
        RiskFiStakeVaultV2: m.vault,
        StakeReceiptREP: m.rep,
        StakerYieldToken: m.yt,
        YieldCurveHookV2: m.hook,
        YieldLPShare: m.lpShare,
        YieldSwapRouter: m.swapRouter,
        StakeAndSellRouterV2: m.stakeAndSellRouter,
        CCIPStakeReceiverV2: m.ccipReceiver,
      },
      ytPoolKey: { currency0, currency1, fee: 0, tickSpacing: 1, hooks: m.hook },
      poolKeyHash: m.poolKeyHash,
      report: { reportId: Number(choice.id), reportHash: choice.reportHash, claimHash: r.claimHash, reviewer: r.reviewer,
        resolver: r.resolver, adjudicator: r.adjudicator, resultDeadline: r.resultDeadline, challengePeriodSeconds: r.challengePeriod },
    },
    arbitrumSepolia: {
      ...raw.arbitrumSepolia,
      reportId: Number(choice.id),
      contracts: { ...raw.arbitrumSepolia.contracts, CCIPStakeSenderV2: choice.ccipReady ? choice.sender! : zeroAddress },
    },
    exampleCCIP: { messageId: `0x${'0'.repeat(64)}`, sourceTx: `0x${'0'.repeat(64)}`, destinationTx: `0x${'0'.repeat(64)}` },
  });
}
