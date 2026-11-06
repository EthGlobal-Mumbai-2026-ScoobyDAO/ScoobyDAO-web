import { getAddress, type Address, type Hex } from 'viem';
import { arbitrumSepolia, sepolia } from 'viem/chains';
import { v2 } from '@/contracts/v2';
import type { CcipApiResult } from '@/protocol/ccipApi';
import { createV2 } from '@/protocol/v2';
import { V2 } from '@/protocol/v2contracts';
import { mockClient, MockRevert, type MockChainState, type MockContract } from './mockRpc';

// A mutable mocked V2 deployment on both chains. Defaults mirror reads recorded from the live
// contracts on 6 Nov 2026 (src/test/recorded/v2-wiring.json and the quote probe in NOTES.md);
// tests change fields to reach other states. Handlers read the world on every call.

export const ME = getAddress('0x1111111111111111111111111111111111111111');
export const OTHER = getAddress('0x2222222222222222222222222222222222222222');
export const DEPLOYER = v2.report.reviewer;
const ZERO32 = `0x${'0'.repeat(64)}` as Hex;
const U = 1_000_000n;

type Book = Record<string, bigint>;
const k = (...parts: unknown[]) => parts.map((p) => String(p).toLowerCase()).join(':');
const get = (b: Book, ...parts: unknown[]) => b[k(...parts)] ?? 0n;

interface RegistryReport {
  reportHash: Hex;
  claimHash: Hex;
  reviewer: Address;
  resolver: Address;
  adjudicator: Address;
  lockTime: bigint;
  crossChainCutoff: bigint;
  resultDeadline: bigint;
  challengePeriod: bigint;
}

export function liveWorld() {
  return {
    now: 1_793_961_648n, // Sepolia block time when the live reads were taken
    arbNow: 1_793_961_650n,
    blockNumber: 12_076_029n,
    arbBlockNumber: 326_600_000n,
    report: <RegistryReport>{
      reportHash: v2.report.reportHash,
      claimHash: v2.report.claimHash,
      reviewer: DEPLOYER,
      resolver: DEPLOYER,
      adjudicator: DEPLOYER,
      lockTime: BigInt(v2.report.lockTime),
      crossChainCutoff: BigInt(v2.report.crossChainCutoff),
      resultDeadline: BigInt(v2.report.resultDeadline),
      challengePeriod: BigInt(v2.report.challengePeriod),
    },
    /** Extra registry entries (e.g. a report published without a vault). */
    extraReports: {} as Record<string, RegistryReport>,
    vault: {
      reportId: 1n,
      totalYes: 100n * U,
      totalNo: 15n * U,
      proposed: 0,
      proposedAt: 0n,
      challenged: false,
      finalOutcome: 0,
      finalizedAt: 0n,
      evidenceHash: ZERO32,
      principalAvailable: 0n,
      maturity: BigInt(v2.report.maturity),
      feeClaimed: false,
      positions: {} as Book,
    },
    dusd: { balances: { [k(V2.vault.address)]: 115n * U } as Book, allowances: {} as Book },
    dusdArb: { balances: {} as Book, allowances: {} as Book },
    rep: { balances: {} as Book, totalSupply: 0n },
    yt: { balances: { [k(V2.hook.address)]: 109_999_768n } as Book, allowances: {} as Book, totalSupply: 115n * U, globalIndex: 0n, paidIndex: {} as Book, unclaimed: {} as Book },
    hook: {
      poolKeyHash: v2.poolKeyHash,
      usdcReserve: 49_910_518n,
      ytReserve: 109_999_768n,
      spotPriceWad: 9_002_992_551_214_505n,
      impliedRateWad: 99_950_001_160_000_000n,
      timeRemainingWad: 90_068_873_668_188_736n,
      feePips: 3000,
      maturity: BigInt(v2.report.maturity),
      lpYieldPerShare: 276_693_358_816_330_398n,
      paidLPIndex: {} as Book,
      unclaimedLP: {} as Book,
      /** Recorded live: quoteBuy(0.9 dUSD) = 99.425914 YT; ~110.5 YT per dUSD near spot. */
      quoteBuy: (usdcIn: bigint) => (usdcIn * 110_473_237n) / U,
      /** Recorded live: quoteSell(3 YT) = 0.026923 dUSD. */
      quoteSell: (ytIn: bigint) => (ytIn * 8_974n) / U,
    },
    lp: { balances: { [k(DEPLOYER)]: 70_710_678n } as Book, totalSupply: 70_710_678n },
    receiver: { delivered: {} as Record<string, boolean>, recoverable: {} as Book, recoverySource: {} as Record<string, Address> },
    sender: { reportCutoff: BigInt(v2.report.crossChainCutoff), used: {} as Record<string, boolean>, fee: 744_250_004_505_817n, quoted: [] as unknown[] },
    ethBalances: {} as Book,
    receipts: { eth: {} as Record<string, unknown>, arb: {} as Record<string, unknown> },
    logs: [] as NonNullable<MockChainState['logs']>,
    ccipApi: { ok: true } as CcipApiResult,
  };
}
export type World = ReturnType<typeof liveWorld>;

function reportFor(w: World, id: bigint): RegistryReport {
  if (id === 1n) return w.report;
  return (
    w.extraReports[id.toString()] ?? {
      reportHash: ZERO32,
      claimHash: ZERO32,
      reviewer: getAddress('0x0000000000000000000000000000000000000000'),
      resolver: getAddress('0x0000000000000000000000000000000000000000'),
      adjudicator: getAddress('0x0000000000000000000000000000000000000000'),
      lockTime: 0n,
      crossChainCutoff: 0n,
      resultDeadline: 0n,
      challengePeriod: 0n,
    }
  );
}

function sepoliaContracts(w: World): Record<string, MockContract> {
  const c = (h: keyof typeof V2, fns: MockContract['fns']) => [V2[h].address.toLowerCase(), { abi: V2[h].abi, fns }] as const;
  const quoteSell = (x: bigint) => {
    const out = w.hook.quoteSell(x);
    if (out <= 0n) throw new MockRevert('SELL_INPUT');
    if (out >= w.hook.usdcReserve) throw new MockRevert('USDC_RESERVE');
    return out;
  };
  return Object.fromEntries([
    c('registry', {
      getReport: ([id]) => reportFor(w, id as bigint),
      maturity: ([id]) => reportFor(w, id as bigint).lockTime + 30n * 86_400n,
      reportCount: () => 1n + BigInt(Object.keys(w.extraReports).length),
    }),
    c('vault', {
      reportId: () => w.vault.reportId,
      yt: () => V2.yt.address,
      rep: () => V2.rep.address,
      registry: () => V2.registry.address,
      usdc: () => V2.dusd.address,
      totalYes: () => w.vault.totalYes,
      totalNo: () => w.vault.totalNo,
      proposed: () => w.vault.proposed,
      proposedAt: () => w.vault.proposedAt,
      challenged: () => w.vault.challenged,
      finalOutcome: () => w.vault.finalOutcome,
      finalizedAt: () => w.vault.finalizedAt,
      evidenceHash: () => w.vault.evidenceHash,
      principalAvailable: () => w.vault.principalAvailable,
      maturity: () => w.vault.maturity,
      feeClaimed: () => w.vault.feeClaimed,
      treasury: () => DEPLOYER,
      positionOf: ([a, yes]) => get(w.vault.positions, a, yes),
    }),
    c('dusd', { balanceOf: ([a]) => get(w.dusd.balances, a), allowance: ([o, s]) => get(w.dusd.allowances, o, s) }),
    c('rep', { balanceOf: ([a]) => get(w.rep.balances, a), totalSupply: () => w.rep.totalSupply }),
    c('yt', {
      balanceOf: ([a]) => get(w.yt.balances, a),
      allowance: ([o, s]) => get(w.yt.allowances, o, s),
      totalSupply: () => w.yt.totalSupply,
      globalIndex: () => w.yt.globalIndex,
      paidIndex: ([a]) => get(w.yt.paidIndex, a),
      unclaimedUSDC: ([a]) => get(w.yt.unclaimed, a),
    }),
    c('hook', {
      poolKeyHash: () => w.hook.poolKeyHash,
      shares: () => V2.lp.address,
      usdcReserve: () => w.hook.usdcReserve,
      ytReserve: () => w.hook.ytReserve,
      spotPriceWad: () => w.hook.spotPriceWad,
      impliedRateWad: () => w.hook.impliedRateWad,
      timeRemainingWad: () => (w.now >= w.hook.maturity ? 0n : w.hook.timeRemainingWad),
      feePips: () => w.hook.feePips,
      maturity: () => w.hook.maturity,
      lpYieldPerShare: () => w.hook.lpYieldPerShare,
      paidLPIndex: ([a]) => get(w.hook.paidLPIndex, a),
      unclaimedLPYield: ([a]) => get(w.hook.unclaimedLP, a),
      quoteBuy: ([x]) => {
        if (w.now >= w.hook.maturity) throw new MockRevert('BUY_INPUT');
        const out = w.hook.quoteBuy(x as bigint);
        if (out <= 0n) throw new MockRevert('BUY_DUST');
        if (out >= w.hook.ytReserve) throw new MockRevert('YT_RESERVE');
        return out;
      },
      quoteSell: ([x]) => quoteSell(x as bigint),
    }),
    c('lp', { balanceOf: ([a]) => get(w.lp.balances, a), totalSupply: () => w.lp.totalSupply }),
    c('stakeAndSell', { quoteSell: ([x]) => quoteSell(x as bigint) }),
    c('receiver', {
      delivered: ([id]) => w.receiver.delivered[k(id)] ?? false,
      recoverable: ([id]) => get(w.receiver.recoverable, id),
      recoverySourceAccount: ([id]) => w.receiver.recoverySource[k(id)] ?? getAddress('0x0000000000000000000000000000000000000000'),
      recoveryOperator: () => DEPLOYER,
    }),
  ]);
}

function arbitrumContracts(w: World): Record<string, MockContract> {
  return {
    [V2.sender.address.toLowerCase()]: {
      abi: V2.sender.abi,
      fns: {
        reportCutoff: ([id]) => (id === 1n ? w.sender.reportCutoff : 0n),
        usedNonce: ([a, n]) => w.sender.used[k(a, n)] ?? false,
        quoteFee: ([intent]) => {
          w.sender.quoted.push(intent);
          return w.sender.fee;
        },
      },
    },
    [V2.dusdArb.address.toLowerCase()]: {
      abi: V2.dusdArb.abi,
      fns: { balanceOf: ([a]) => get(w.dusdArb.balances, a), allowance: ([o, s]) => get(w.dusdArb.allowances, o, s) },
    },
  };
}

/** createV2 over mocked transports for `w`; the returned states expose the recorded calls. */
export function v2For(w: World) {
  // Blocks are getters: every RPC call sees the world's current clock.
  const eth: MockChainState = {
    chain: sepolia,
    get block() {
      return { number: w.blockNumber, timestamp: w.now };
    },
    contracts: sepoliaContracts(w),
    receipts: w.receipts.eth,
    logs: w.logs,
  };
  const arb: MockChainState = {
    chain: arbitrumSepolia,
    get block() {
      return { number: w.arbBlockNumber, timestamp: w.arbNow };
    },
    contracts: arbitrumContracts(w),
    balances: w.ethBalances,
    receipts: w.receipts.arb,
  };
  const ethClient = mockClient(eth);
  const arbClient = mockClient(arb);
  const protocol = createV2({ eth: () => ethClient, arb: () => arbClient, fetchCcip: async () => w.ccipApi });
  return { protocol, eth, arb };
}

export const setBalance = (b: Book, owner: Address, v: bigint) => (b[k(owner)] = v);
export const setAllowance = (b: Book, owner: Address, spender: Address, v: bigint) => (b[k(owner, spender)] = v);
export const setPosition = (w: World, owner: Address, yes: boolean, v: bigint) => (w.vault.positions[k(owner, yes)] = v);
