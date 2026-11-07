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

// Server-side cache. Reading both registries takes ~2 s of RPC round trips, and every market tab, the landing page
// and /me need the list, so each navigation used to wait on it. Answers are reused for CHOICES_TTL_MS; after that the
// cached list is still served immediately while one background refresh runs (stale-while-revalidate). A new report
// therefore shows up within about a minute. Failures are never cached.
const CHOICES_TTL_MS = 30_000;
let cached: { at: number; value: ReportChoice[] } | undefined;
let inflight: Promise<ReportChoice[]> | undefined;

function refreshChoices(): Promise<ReportChoice[]> {
  inflight ??= readReportChoices()
    .then((value) => {
      cached = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      inflight = undefined;
    });
  return inflight;
}

/** Report choices from both onchain registries, cached briefly on the server (see above). */
export async function listReportChoices(): Promise<ReportChoice[]> {
  if (!cached) return refreshChoices();
  if (Date.now() - cached.at > CHOICES_TTL_MS) void refreshChoices().catch(() => undefined);
  return cached.value;
}

/** Test hook: drop the cached list. */
export const resetReportChoicesCache = () => {
  cached = undefined;
  inflight = undefined;
};

/** Enumerate both onchain registries; report IDs are namespaced by registry. */
async function readReportChoices(): Promise<ReportChoice[]> {
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
