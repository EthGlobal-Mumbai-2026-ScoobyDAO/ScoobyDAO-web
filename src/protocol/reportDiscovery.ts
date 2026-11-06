import type { Abi, Address } from 'viem';
import { reportRegistryAbi, v2, v2Flexible } from '@/contracts/v2';
import catalogAbi from '@/contracts/market-infrastructure/V2PoolCatalog.json';
import infra from '@/contracts/market-infrastructure/addresses.json';
import senderFactoryAbi from '@/contracts/market-infrastructure/V2CCIPSenderFactory.json';
import receiverAbi from '@/contracts/v2/abis/CCIPStakeReceiverV2.json';
import { arbClient, sepoliaClient } from './clients';

export type ReportChoice = {
  deployment: 'original' | 'flexible';
  id: string;
  reportHash: string;
  lockTime: number;
  maturity: number;
  tradable: boolean;
  report?: {
    claimHash: string; reviewer: string; resolver: string; adjudicator: string;
    crossChainCutoff: number; resultDeadline: number; challengePeriod: number;
  };
  market?: {
    vault: string; yt: string; rep: string; hook: string; lpShare: string;
    swapRouter: string; stakeAndSellRouter: string; ccipReceiver: string; poolKeyHash: string;
  };
  sender?: string;
  ccipReady?: boolean;
};

const deployments = [
  { key: 'flexible', bundle: v2Flexible },
  { key: 'original', bundle: v2 },
] as const;

/** Enumerate both onchain registries on each request; report IDs are namespaced by registry. */
export async function listReportChoices(): Promise<ReportChoice[]> {
  const client = sepoliaClient();
  const results = await Promise.all(deployments.map(async ({ key, bundle }) => {
    const address = bundle.sepolia.ReportRegistry;
    const abi = reportRegistryAbi as Abi;
    let count: bigint;
    try { count = await client.readContract({ address, abi, functionName: 'reportCount' }) as bigint; }
    catch { count = bundle.reportId; }
    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
    return Promise.all(ids.map(async id => {
      try {
        const [report, maturity, deployed] = await Promise.all([
          client.readContract({ address, abi, functionName: 'getReport', args: [id] }) as Promise<{ reportHash: string; claimHash: string; reviewer: string; resolver: string; adjudicator: string; lockTime: bigint; crossChainCutoff: bigint; resultDeadline: bigint; challengePeriod: bigint }>,
          client.readContract({ address, abi, functionName: 'maturity', args: [id] }) as Promise<bigint>,
          client.readContract({ address: infra.poolCatalog as Address, abi: catalogAbi as Abi, functionName: 'getMarket', args: [address, id] }).catch(() => undefined) as Promise<{ vault: string; yt: string; rep: string; hook: string; lpShare: string; swapRouter: string; stakeAndSellRouter: string; ccipReceiver: string; poolKeyHash: string } | undefined>,
        ]);
        const known = id === bundle.reportId && report.reportHash.toLowerCase() === bundle.report.reportHash.toLowerCase();
        const hasMarket = !!deployed && deployed.hook !== '0x0000000000000000000000000000000000000000';
        const sender = hasMarket ? await arbClient().readContract({ address: infra.arbSenderFactory as Address, abi: senderFactoryAbi as Abi, functionName: 'senderForReceiver', args: [deployed!.ccipReceiver] }).catch(() => undefined) as string | undefined : undefined;
        const configured = sender && sender !== '0x0000000000000000000000000000000000000000' ? await client.readContract({ address: deployed!.ccipReceiver as Address, abi: receiverAbi as Abi, functionName: 'sourceSender' }).catch(() => undefined) as string | undefined : undefined;
        return { deployment: key, id: id.toString(), reportHash: report.reportHash, lockTime: Number(report.lockTime), maturity: Number(maturity), tradable: known || hasMarket,
          report: { claimHash: report.claimHash, reviewer: report.reviewer, resolver: report.resolver, adjudicator: report.adjudicator,
            crossChainCutoff: Number(report.crossChainCutoff), resultDeadline: Number(report.resultDeadline), challengePeriod: Number(report.challengePeriod) },
          market: hasMarket ? deployed : undefined, sender, ccipReady: !!sender && configured?.toLowerCase() === sender.toLowerCase() } satisfies ReportChoice;
      } catch {
        if (id !== bundle.reportId) return null;
        return { deployment: key, id: id.toString(), reportHash: bundle.report.reportHash, lockTime: bundle.report.lockTime, maturity: bundle.report.maturity, tradable: true } satisfies ReportChoice;
      }
    }));
  }));
  const choices: ReportChoice[] = results.flat().filter((x) => x !== null);
  return choices.sort((a, b) => b.maturity - a.maturity);
}

export const registryFor = (deployment: ReportChoice['deployment']): Address =>
  deployment === 'flexible' ? v2Flexible.sepolia.ReportRegistry : v2.sepolia.ReportRegistry;
