import { getAddress, keccak256, toHex, type Address, type Hex } from 'viem';
import { feeOf, payoutFor } from '@/lib/payout';
import { ccipStatus, type CcipLogs } from './ccip';
import { constantProductOut, spotPriceWad, yieldPoolKey, zeroForOneFor } from './market';
import { canChallenge, canFinalize, derivePhase, stakingOpen, THIRTY_DAYS } from './phase';
import {
  ProtocolRevert,
  type CcipStake,
  type Decision,
  type MarketView,
  type Outcome,
  type PositionView,
  type Protocol,
  type TxPlan,
} from './types';

// In-memory chain that enforces the same rules as the contracts the UI depends on:
// stakes only before lockTime, CCIP only before the cutoff (late delivery → Held),
// Settlement payout math, the challenge window, Void (incl. one-sided markets).
// Its clock is a demo clock (wall time + offset), labelled "Demo clock" in the UI.

const SEPOLIA = 11155111;
const ARB = 421614;
const U = 1_000_000n; // 1 dUSD
const MIN = 60;
const HOUR = 3600;
const DAY = 86400;

export const FIXTURE_ADDR = {
  DemoUSD: getAddress('0x3d1f1bffb82a244bf58ff42a3202e7d25aeb2525'),
  VoteMarket: getAddress('0x313b1b96ab196eaf7ac937e7d3f56bf2acf397bf'),
  Settlement: getAddress('0x8225b1651c1ffcb04bd28e9c123bb29482e9d92d'),
  CCIPStakeSender: getAddress('0xe397409ef4d8927342c65fa0e11d3eeecaf137a5'),
  YieldSwapRouter: getAddress('0x0000000000000000000000000000000000005a9e'),
  Hook: getAddress('0x0000000000000000000000000000000000002088'),
  YT: getAddress('0x00000000000000000000000000000000000000a7'),
  Treasury: getAddress('0xe397409ef4d8927342c65fa0e11d3eeecaf137a5'),
  Resolver: getAddress('0x5e5011e5000000000000000000000000000000a1'),
  Reviewer: getAddress('0x2e71e3e2000000000000000000000000000000b2'),
};
/** Used as "your wallet" in fixture mode when no wallet is connected. */
export const FIXTURE_ACCOUNT = getAddress('0xd3e0000000000000000000000000000000000001');
export const HELD_MESSAGE_ID = keccak256(toHex('fixture-held-ccip')) as Hex;

interface Series {
  id: bigint;
  reportHash: Hex;
  claimHash: Hex;
  lockTime: number;
  crossChainCutoff: number;
  resultDeadline: number;
  challengePeriod: number;
  totals: { yes: bigint; no: bigint };
  locked: boolean;
  decision?: Decision;
  proposedOutcome?: Outcome;
  pool?: { usdc: bigint; yt: bigint; feePips: number };
}
interface Account {
  dusd: bigint;
  dusdArb: bigint;
  allowance: Record<string, bigint>;
  pos: Record<string, { yes: bigint; no: bigint; yt: bigint; ytSince: number; ytAccrued: bigint; badge: boolean }>;
}
interface Msg {
  messageId: Hex;
  reportId: bigint;
  yes: boolean;
  amount: bigint;
  recipient: Address;
  sourceTx: Hex;
  sentAt: number;
  deliverAt: number;
  recovered?: boolean;
  forceHeld?: boolean;
}

let offset = 0;
let nowFn: () => number = () => Math.floor(Date.now() / 1000) + offset;
/** Tests pin the clock; the demo can fast-forward it. */
export function setFixtureClock(fn: (() => number) | null) {
  nowFn = fn ?? (() => Math.floor(Date.now() / 1000) + offset);
}
export function warpFixture(seconds: number) {
  offset += seconds;
}
const now = () => nowFn();

let seq = 1;
let ccipLatency = 20;
/** Demo/test knob: seconds of demo clock between a CCIP send and its delivery. */
export function setCcipLatency(seconds: number) {
  ccipLatency = seconds;
}
export const fakeTxHash = (): Hex => keccak256(toHex(`fixture-tx-${seq++}-${Date.now()}`));
const h = (s: string) => keccak256(toHex(s));

let series = new Map<string, Series>();
let accounts = new Map<string, Account>();
let msgs = new Map<string, Msg>();
let version = 0;
let ytTraded = 0n;
const listeners = new Set<() => void>();
const bump = () => {
  version++;
  listeners.forEach((l) => l());
};
export const subscribeFixture = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const fixtureVersion = () => version;

function add(s: Omit<Series, 'reportHash' | 'claimHash'> & Partial<Pick<Series, 'reportHash' | 'claimHash'>>) {
  series.set(s.id.toString(), {
    reportHash: h(`report-${s.id}`),
    claimHash: h(`claim-${s.id}`),
    ...s,
  });
}

/** Six demo scenarios, relative to the demo clock at load time. */
export function resetFixture(t = now()) {
  series = new Map();
  accounts = new Map();
  msgs = new Map();
  // 1 · open: local + CCIP stakes
  add({ id: 1n, lockTime: t + 3 * HOUR, crossChainCutoff: t + 2 * HOUR, resultDeadline: t + 3 * HOUR + 33 * DAY, challengePeriod: DAY, totals: { yes: 120n * U, no: 45n * U }, locked: false });
  // 2 · locked with a YT market
  add({ id: 2n, lockTime: t - 2 * DAY, crossChainCutoff: t - 3 * DAY, resultDeadline: t + 31 * DAY, challengePeriod: DAY, totals: { yes: 300n * U, no: 180n * U }, locked: true, pool: { usdc: 3_200_000n, yt: 400n * U, feePips: 3000 } });
  // 3 · proposed Yes, inside a short challenge window (demo clock)
  add({
    id: 3n, lockTime: t - 30 * DAY - 2 * HOUR, crossChainCutoff: t - 31 * DAY, resultDeadline: t + 2 * DAY, challengePeriod: 3 * MIN,
    totals: { yes: 80n * U, no: 20n * U }, locked: true,
    decision: { proposed: 'yes', evidenceHash: h('evidence-3'), proposedAt: t - 30, challenged: false },
  });
  // 4 · final Yes, 80/20 → each Yes unit redeems 1.20
  add({
    id: 4n, lockTime: t - 40 * DAY, crossChainCutoff: t - 41 * DAY, resultDeadline: t - 5 * DAY, challengePeriod: DAY,
    totals: { yes: 80n * U, no: 20n * U }, locked: true,
    decision: { proposed: 'yes', outcome: 'yes', evidenceHash: h('evidence-4'), proposedAt: t - 9 * DAY, challenged: false, finalizedAt: t - 8 * DAY },
  });
  // 5 · Void (result deadline passed without a verdict)
  add({
    id: 5n, lockTime: t - 50 * DAY, crossChainCutoff: t - 51 * DAY, resultDeadline: t - 15 * DAY, challengePeriod: DAY,
    totals: { yes: 40n * U, no: 35n * U }, locked: true,
    decision: { outcome: 'void', evidenceHash: `0x${'0'.repeat(64)}`, proposedAt: 0, challenged: false, finalizedAt: t - 14 * DAY },
  });
  bump();
}
resetFixture();

/** The backend fixture calls this when an approval is "spent": a new open report appears onchain. */
export function publishFixture(reportHash: Hex, claimHash: Hex): bigint {
  const id = BigInt(series.size + 1);
  const t = now();
  add({ id, reportHash, claimHash, lockTime: t + 3 * HOUR, crossChainCutoff: t + 2 * HOUR, resultDeadline: t + 3 * HOUR + 33 * DAY, challengePeriod: DAY, totals: { yes: 0n, no: 0n }, locked: false });
  bump();
  return id;
}

/** The fixture API binds its published demo reports to these scenarios (hash checks ✓ against "chain"). */
export function setFixtureSeriesHashes(id: bigint, reportHash: Hex, claimHash: Hex) {
  const s = series.get(id.toString());
  if (s) Object.assign(s, { reportHash, claimHash });
}

function get(id: bigint): Series {
  const s = series.get(id.toString());
  if (!s) throw new ProtocolRevert(`Report #${id} is not published onchain`);
  return s;
}

/** Each fixture wallet starts with test dUSD on both chains and demo positions. */
function acct(a: Address): Account {
  const k = a.toLowerCase();
  let x = accounts.get(k);
  if (!x) {
    const t = now();
    x = {
      dusd: 500n * U,
      dusdArb: 200n * U,
      allowance: {},
      pos: {
        '2': { yes: 5n * U, no: 0n, yt: 0n, ytSince: t, ytAccrued: 0n, badge: false },
        '3': { yes: 10n * U, no: 0n, yt: 4n * U, ytSince: t - DAY, ytAccrued: 120_000n, badge: false },
        '4': { yes: 20n * U, no: 0n, yt: 2n * U, ytSince: t - 30 * DAY, ytAccrued: 310_000n, badge: false },
        '5': { yes: 0n, no: 15n * U, yt: 0n, ytSince: t, ytAccrued: 0n, badge: false },
      },
    };
    // Include the seeded stakes in the totals so payouts add up.
    accounts.set(k, x);
    msgs.set(HELD_MESSAGE_ID, {
      messageId: HELD_MESSAGE_ID, reportId: 1n, yes: true, amount: 7n * U, recipient: a,
      sourceTx: h('fixture-held-src'), sentAt: t - 3 * HOUR, deliverAt: t - 2 * HOUR, forceHeld: true,
    });
  }
  return x;
}
const pos = (a: Address, id: bigint) => {
  const x = acct(a);
  return (x.pos[id.toString()] ??= { yes: 0n, no: 0n, yt: 0n, ytSince: now(), ytAccrued: 0n, badge: false });
};

/** Simulated yield: 0.0004 dUSD per YT per hour while before maturity. */
function ytClaimable(s: Series, p: Account['pos'][string]): bigint {
  const until = Math.min(now(), s.lockTime + THIRTY_DAYS);
  const hours = BigInt(Math.max(0, Math.floor((until - p.ytSince) / HOUR)));
  return p.ytAccrued + (p.yt * 400n * hours) / U;
}

function msgState(m: Msg): CcipLogs & { isHeld: boolean } {
  const logs: CcipLogs = { sent: { tx: m.sourceTx, at: m.sentAt } };
  const delivered = now() >= m.deliverAt;
  let held = false;
  if (delivered) {
    const s = series.get(m.reportId.toString());
    held = m.forceHeld || !s || m.deliverAt >= s.lockTime;
    if (held) logs.held = { tx: h(`dest-${m.messageId}`) };
    else logs.credited = { tx: h(`dest-${m.messageId}`) };
    if (held && m.recovered) logs.recovered = { tx: h(`rec-${m.messageId}`) };
  }
  return { ...logs, isHeld: held };
}
/** Credit delivered messages exactly once (CCIPStakeReceiver._ccipReceive → VoteMarket.creditCCIP). */
const credited = new Set<string>();
function settleMessages() {
  for (const m of msgs.values()) {
    const st = msgState(m);
    if (st.credited && !credited.has(m.messageId)) {
      credited.add(m.messageId);
      const s = get(m.reportId);
      s.totals[m.yes ? 'yes' : 'no'] += m.amount;
      pos(m.recipient, m.reportId)[m.yes ? 'yes' : 'no'] += m.amount;
    }
  }
}

function view(s: Series): MarketView {
  settleMessages();
  const t = now();
  const maturity = s.lockTime + THIRTY_DAYS;
  const pool = s.pool;
  return {
    reportId: s.id,
    reportHash: s.reportHash,
    claimHash: s.claimHash,
    reviewer: FIXTURE_ADDR.Reviewer,
    resolver: FIXTURE_ADDR.Resolver,
    adjudicator: FIXTURE_ADDR.Resolver,
    lockTime: s.lockTime,
    crossChainCutoff: s.crossChainCutoff,
    resultDeadline: s.resultDeadline,
    challengePeriod: s.challengePeriod,
    maturity,
    totals: { ...s.totals },
    locked: s.locked,
    phase: derivePhase({ now: t, lockTime: s.lockTime, crossChainCutoff: s.crossChainCutoff, decision: s.decision }),
    chainTime: t,
    blockNumber: BigInt(t),
    decision: s.decision ? { ...s.decision } : undefined,
    yt: s.locked || pool ? { address: FIXTURE_ADDR.YT } : undefined,
    market: pool
      ? {
          hook: FIXTURE_ADDR.Hook,
          router: FIXTURE_ADDR.YieldSwapRouter,
          poolKey: yieldPoolKey(FIXTURE_ADDR.DemoUSD, FIXTURE_ADDR.YT, FIXTURE_ADDR.Hook),
          reserves: { usdc: pool.usdc, yt: pool.yt },
          spotPriceWad: spotPriceWad(pool.usdc, pool.yt),
          feePips: pool.feePips,
          maturity,
          configured: true,
        }
      : undefined,
    remoteCutoff: s.crossChainCutoff,
    demoClock: true,
  };
}

const revert = (reason: string): never => {
  throw new ProtocolRevert(reason);
};

function approveStep(chainId: number, account: Address, spender: string, label = 'Approve dUSD') {
  return {
    label,
    chainId,
    fixture: () => {
      acct(account).allowance[`${chainId}:${spender}`] = 2n ** 255n;
      bump();
    },
  };
}
const allowanceOf = (a: Address, chainId: number, spender: string) => acct(a).allowance[`${chainId}:${spender}`] ?? 0n;

function finalOutcome(s: Series, o: Outcome): Outcome {
  return s.totals.yes === 0n || s.totals.no === 0n ? 'void' : o;
}

/** The fixture acts as `account` for calls whose sender is implicit (redeem). Set by useProtocol. */
export const fixture: Protocol & { account: Address } = {
  kind: 'fixture',
  dusd: FIXTURE_ADDR.DemoUSD,
  account: FIXTURE_ACCOUNT,

  async listPublished() {
    return [...series.values()].map((s) => s.id);
  },
  async chainTime() {
    return now();
  },
  async getMarket(id) {
    return view(get(id));
  },

  async getPosition(id, account) {
    const s = get(id);
    const m = view(s);
    const p = pos(account, id);
    const x = acct(account);
    const outcome = s.decision?.outcome;
    const pendingCcip: CcipStake[] = [];
    for (const msg of msgs.values()) {
      if (msg.reportId !== id || msg.recipient.toLowerCase() !== account.toLowerCase()) continue;
      const t = await fixture.trackCcip(msg.messageId);
      if (t && t.status !== 'credited' && t.status !== 'recovered') pendingCcip.push(t);
    }
    return {
      yes: p.yes,
      no: p.no,
      yt: p.yt,
      ytClaimable: ytClaimable(s, p),
      lpShares: 0n,
      lpClaimable: 0n,
      pendingCcip,
      redeemable: outcome ? payoutFor(outcome, 'yes', p.yes, m.totals) + payoutFor(outcome, 'no', p.no, m.totals) : undefined,
      reputationBadge: p.badge,
      repReceipt: 0n,
      dusdBalance: x.dusd,
      allowance: allowanceOf(account, SEPOLIA, FIXTURE_ADDR.VoteMarket),
      remote: { dusdBalance: x.dusdArb, allowance: allowanceOf(account, ARB, FIXTURE_ADDR.CCIPStakeSender), ethBalance: 10n ** 17n },
      transferable: true,
    } satisfies PositionView;
  },

  async stakeLocal(id, yes, amount, account) {
    const plan: TxPlan = [];
    if (allowanceOf(account, SEPOLIA, FIXTURE_ADDR.VoteMarket) < amount) plan.push(approveStep(SEPOLIA, account, FIXTURE_ADDR.VoteMarket));
    plan.push({
      label: `Stake ${yes ? 'Yes' : 'No'}`,
      chainId: SEPOLIA,
      fixture: () => {
        const s = get(id);
        if (amount <= 0n) revert('STAKE');
        if (now() >= s.lockTime) revert('CLOSED');
        const x = acct(account);
        if (allowanceOf(account, SEPOLIA, FIXTURE_ADDR.VoteMarket) < amount || x.dusd < amount) revert('TokenCallFailed');
        x.dusd -= amount;
        s.totals[yes ? 'yes' : 'no'] += amount;
        pos(account, id)[yes ? 'yes' : 'no'] += amount;
        bump();
      },
    });
    return plan;
  },

  async quoteRemote(id) {
    const s = get(id);
    return { fee: 2_001_988_491_940_296n, deadline: s.lockTime - 1, cutoff: s.crossChainCutoff };
  },

  async stakeRemote(id, yes, amount, account) {
    const plan: TxPlan = [];
    if (allowanceOf(account, ARB, FIXTURE_ADDR.CCIPStakeSender) < amount)
      plan.push(approveStep(ARB, account, FIXTURE_ADDR.CCIPStakeSender, 'Approve dUSD on Arbitrum Sepolia'));
    plan.push({
      label: `Send ${yes ? 'Yes' : 'No'} stake via CCIP`,
      chainId: ARB,
      fixture: () => {
        const s = get(id);
        if (now() >= s.crossChainCutoff) revert('REMOTE_CLOSED');
        const x = acct(account);
        if (allowanceOf(account, ARB, FIXTURE_ADDR.CCIPStakeSender) < amount || x.dusdArb < amount) revert('TokenCallFailed');
        x.dusdArb -= amount;
        const messageId = keccak256(toHex(`ccip-${id}-${account}-${seq++}-${Date.now()}`));
        const t = now();
        // Testnet lanes take minutes; the demo delivers after `ccipLatency` s of demo clock.
        msgs.set(messageId, { messageId, reportId: id, yes, amount, recipient: account, sourceTx: fakeTxHash(), sentAt: t, deliverAt: t + ccipLatency });
        bump();
        return { messageId };
      },
    });
    return plan;
  },

  async quoteYT(id, dir, amount) {
    const p = get(id).pool;
    if (!p) revert('Market not deployed yet');
    const [rin, rout] = dir === 'buy' ? [p!.usdc, p!.yt] : [p!.yt, p!.usdc];
    return { out: constantProductOut(amount, rin, rout, p!.feePips), price: spotPriceWad(p!.usdc, p!.yt) };
  },

  async swapYT(id, dir, amount, minOut, deadline, account) {
    const plan: TxPlan = [];
    const spender = `${FIXTURE_ADDR.YieldSwapRouter}:${dir}`;
    if (allowanceOf(account, SEPOLIA, spender) < amount) plan.push(approveStep(SEPOLIA, account, spender, dir === 'buy' ? 'Approve dUSD' : 'Approve YT'));
    plan.push({
      label: dir === 'buy' ? 'Buy YT' : 'Sell YT',
      chainId: SEPOLIA,
      fixture: () => {
        const s = get(id);
        const p = s.pool ?? revert('POOL');
        if (now() > deadline) revert('DEADLINE');
        if (now() >= s.lockTime + THIRTY_DAYS) revert('EXACT_INPUT_OR_MATURED');
        const x = acct(account);
        const ps = pos(account, id);
        const key = yieldPoolKey(FIXTURE_ADDR.DemoUSD, FIXTURE_ADDR.YT, FIXTURE_ADDR.Hook);
        void zeroForOneFor(key, dir, FIXTURE_ADDR.DemoUSD);
        if (dir === 'buy' && x.dusd < amount) revert('TokenCallFailed');
        if (dir === 'sell' && ps.yt < amount) revert('arithmetic underflow');
        const [rin, rout] = dir === 'buy' ? [p.usdc, p.yt] : [p.yt, p.usdc];
        const out = constantProductOut(amount, rin, rout, p.feePips);
        if (out < minOut || out === 0n) revert('SWAP_LIMIT');
        ps.ytAccrued = ytClaimable(s, ps);
        ps.ytSince = now();
        ytTraded += dir === 'buy' ? out : amount;
        if (dir === 'buy') {
          x.dusd -= amount;
          ps.yt += out;
          p.usdc += amount;
          p.yt -= out;
        } else {
          ps.yt -= amount;
          x.dusd += out;
          p.yt += amount;
          p.usdc -= out;
        }
        bump();
        return { amountOut: out };
      },
    });
    return plan;
  },

  async quoteStakeAndSell(amount) {
    const p = get(2n).pool!;
    return constantProductOut(amount, p.yt, p.usdc, p.feePips);
  },

  async stakeAndSell(id, yes, amount, minUsdcOut, deadline, account) {
    const plan = await fixture.stakeLocal(id, yes, amount, account);
    const stake = plan.pop()!;
    plan.push({
      label: `Stake ${yes ? 'Yes' : 'No'} and sell my YT`,
      chainId: SEPOLIA,
      fixture: () => {
        if (now() > deadline) revert('INPUT');
        stake.fixture!();
        const out = constantProductOut(amount, get(2n).pool!.yt, get(2n).pool!.usdc, 3000);
        if (out < minUsdcOut) revert('OUTPUT_DELTA');
        acct(account).dusd += out;
        bump();
        return { amountOut: out };
      },
    });
    return plan;
  },

  async challenge(id) {
    return [
      {
        label: 'Challenge the proposal',
        chainId: SEPOLIA,
        fixture: () => {
          const s = get(id);
          if (!canChallenge(view(s), now())) revert('CHALLENGE_WINDOW');
          s.decision!.challenged = true;
          bump();
        },
      },
    ];
  },

  async finalize(id) {
    return [
      {
        label: 'Finalize',
        chainId: SEPOLIA,
        fixture: () => {
          const s = get(id);
          const m = view(s);
          if (!canFinalize(m, now())) revert(m.decision?.outcome ? 'REPORT_OR_FINAL' : 'PENDING');
          const out = now() > s.resultDeadline ? 'void' : finalOutcome(s, s.decision!.proposed!);
          s.decision = { ...(s.decision ?? { evidenceHash: `0x${'0'.repeat(64)}`, proposedAt: 0, challenged: false }), outcome: out, finalizedAt: now() };
          s.locked = true;
          bump();
        },
      },
    ];
  },

  async redeem(id, yes, amount) {
    return [
      {
        label: `Redeem ${yes ? 'Yes' : 'No'} position`,
        chainId: SEPOLIA,
        fixture: () => {
          const s = get(id);
          const outcome = s.decision?.outcome ?? revert('NOT_FINAL');
          if (amount <= 0n) revert('AMOUNT');
          const p = pos(fixture.account, id);
          const side = yes ? 'yes' : 'no';
          if (p[side] < amount) revert('ERC1155: burn amount exceeds balance');
          const paid = payoutFor(outcome, side, amount, s.totals);
          p[side] -= amount;
          acct(fixture.account).dusd += paid;
          bump();
          return { paid };
        },
      },
    ];
  },

  async claimYield(id, account) {
    return [
      {
        label: 'Claim yield',
        chainId: SEPOLIA,
        fixture: () => {
          const s = get(id);
          const p = pos(account, id);
          const paid = ytClaimable(s, p);
          p.ytAccrued = 0n;
          p.ytSince = now();
          acct(account).dusd += paid;
          bump();
          return { paid };
        },
      },
    ];
  },

  async claimReputationBadge(a) {
    return [
      {
        label: 'Claim reputation badge (World ID, V1)',
        chainId: SEPOLIA,
        fixture: () => {
          const s = get(BigInt(a.reportId));
          const o = s.decision?.outcome;
          if (o !== 'yes' && o !== 'no') revert('INELIGIBLE');
          const p = pos(a.recipient, s.id);
          if (p.badge) revert('ALREADY_CLAIMED');
          p.badge = true;
          bump();
        },
      },
    ];
  },

  async recoverCcip(messageId, to) {
    return [
      {
        label: 'Recover held dUSD',
        chainId: SEPOLIA,
        fixture: () => {
          const m = msgs.get(messageId) ?? revert('NO_FUNDS');
          const st = msgState(m);
          if (!st.isHeld || m.recovered) revert('NO_FUNDS');
          if (m.recipient.toLowerCase() !== to.toLowerCase()) revert('RECIPIENT');
          m.recovered = true;
          acct(to).dusd += m.amount;
          bump();
        },
      },
    ];
  },

  async ytVolume() {
    return 1_250n * U + ytTraded;
  },

  async trackCcip(messageId) {
    const m = msgs.get(messageId);
    if (!m) return undefined;
    settleMessages();
    const st = msgState(m);
    return {
      messageId,
      reportId: m.reportId,
      yes: m.yes,
      amount: m.amount,
      recipient: m.recipient,
      sourceTx: m.sourceTx,
      sentAt: m.sentAt,
      status: ccipStatus(st),
      destTx: st.recovered?.tx ?? st.held?.tx ?? st.credited?.tx,
      recoveryRecipient: st.held ? m.recipient : undefined,
      recoverable: st.held && !m.recovered ? m.amount : st.held ? 0n : undefined,
    };
  },
};

/** For tests: the treasury fee a final market would pay. */
export const fixtureFee = (id: bigint) => {
  const s = get(id);
  const o = s.decision?.outcome;
  return o === 'yes' ? feeOf(s.totals.no) : o === 'no' ? feeOf(s.totals.yes) : 0n;
};
export const fixtureStakingOpen = (id: bigint) => stakingOpen(view(get(id)).phase);
