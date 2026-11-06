import { maxUint256, zeroAddress, type Abi, type Address, type Hex } from 'viem';
import {
  ARB_SEPOLIA_ID,
  arbitrumSepolia as arb,
  ccipStakeReceiverV2Abi,
  ccipStakeSenderV2Abi,
  demoUsdAbi,
  reportRegistryAbi,
  riskFiStakeVaultV2Abi,
  SEPOLIA_ID,
  sepolia as eth,
  stakeAndSellRouterV2Abi,
  stakerYieldTokenAbi,
  yieldCurveHookV2Abi,
  yieldLpShareAbi,
  yieldSwapRouterAbi,
} from '@/contracts';
import { payoutFor } from '@/lib/payout';
import { basicExtraArgsV3, buildIntentV2, ccipStatus, loadTracked, withFeeBuffer, type CcipLogs } from './ccip';
import { arbClient, recentFrom, sepoliaClient } from './clients';
import { yieldPoolKey, zeroForOneFor } from './market';
import { derivePhase, outcomeFromEnum } from './phase';
import { ProtocolRevert, type CcipStake, type ContractCall, type Decision, type MarketPool, type Protocol, type TxPlan } from './types';

// Live adapter for the V2 contracts (src/v2/*). Local only today: every address is read from
// testnets.json, and missing ones throw "not deployed yet". One vault = one report series.

const req = <T>(v: T | undefined, what: string): T => {
  if (!v) throw new ProtocolRevert(`${what} is not deployed yet`);
  return v;
};
const call = (address: Address, abi: Abi, functionName: string, args: readonly unknown[] = [], value?: bigint): ContractCall => ({
  address,
  abi,
  functionName,
  args,
  ...(value !== undefined ? { value } : {}),
});
const vault = () => req(eth.RiskFiStakeVaultV2, 'RiskFiStakeVaultV2');
const V = (functionName: string, args: readonly unknown[] = []) =>
  ({ address: vault(), abi: riskFiStakeVaultV2Abi, functionName, args }) as const;

async function vaultYt(): Promise<Address | undefined> {
  const yt = (await sepoliaClient().readContract(V('yt') as never)) as Address;
  return yt === zeroAddress ? undefined : yt;
}

async function seriesId(): Promise<bigint> {
  return (await sepoliaClient().readContract(V('reportId') as never)) as bigint;
}

async function assertSeries(id: bigint) {
  if ((await seriesId()) !== id) throw new ProtocolRevert(`The V2 vault serves report #${await seriesId()}, not #${id}`);
}

async function pool(): Promise<MarketPool | undefined> {
  const hook = eth.YieldCurveHookV2;
  const yt = await vaultYt();
  if (!hook || !yt || !eth.DemoUSD) return undefined;
  const c = sepoliaClient();
  const H = (functionName: string) => ({ address: hook, abi: yieldCurveHookV2Abi, functionName }) as const;
  const [spot, rate, tau, usdcR, ytR, fee, maturity, keyHash] = (await c.multicall({
    allowFailure: true,
    contracts: ['spotPriceWad', 'impliedRateWad', 'timeRemainingWad', 'usdcReserve', 'ytReserve', 'feePips', 'maturity', 'poolKeyHash'].map(H) as never,
  })) as { result?: unknown }[];
  return {
    hook,
    router: eth.YieldSwapRouterV2,
    poolKey: yieldPoolKey(eth.DemoUSD, yt, hook),
    spotPriceWad: spot.result as bigint | undefined,
    impliedRateWad: rate.result as bigint | undefined,
    timeRemainingWad: tau.result as bigint | undefined,
    reserves: { usdc: (usdcR.result as bigint) ?? 0n, yt: (ytR.result as bigint) ?? 0n },
    feePips: Number(fee.result ?? 0),
    maturity: Number(maturity.result ?? 0),
    configured: keyHash.result !== undefined && keyHash.result !== `0x${'0'.repeat(64)}`,
  };
}

const allowance = async (chain: 'eth' | 'arb', token: Address, owner: Address, spender: Address) =>
  (await (chain === 'eth' ? sepoliaClient() : arbClient()).readContract({
    address: token,
    abi: demoUsdAbi,
    functionName: 'allowance',
    args: [owner, spender],
  })) as bigint;
const approve = (chainId: number, token: Address, spender: Address, label = 'Approve dUSD') => ({
  label,
  chainId,
  request: call(token, demoUsdAbi as Abi, 'approve', [spender, maxUint256]),
});

export const v2: Protocol = {
  kind: 'v2',
  dusd: eth.DemoUSD,

  async listPublished() {
    const id = await seriesId();
    return id > 0n ? [id] : [];
  },

  async chainTime() {
    return Number((await sepoliaClient().getBlock()).timestamp);
  },

  async getMarket(id) {
    await assertSeries(id);
    const c = sepoliaClient();
    const block = await c.getBlock();
    const res = (await c.multicall({
      blockNumber: block.number,
      allowFailure: false,
      contracts: [
        { address: req(eth.ReportRegistry, 'ReportRegistry'), abi: reportRegistryAbi, functionName: 'getReport', args: [id] },
        V('totalYes'),
        V('totalNo'),
        V('proposed'),
        V('finalOutcome'),
        V('evidenceHash'),
        V('proposedAt'),
        V('finalizedAt'),
        V('challenged'),
        V('maturity'),
      ] as never,
    })) as unknown[];
    const r = res[0] as { reportHash: Hex; claimHash: Hex; reviewer: Address; resolver: Address; adjudicator: Address; lockTime: bigint; crossChainCutoff: bigint; resultDeadline: bigint; challengePeriod: bigint };
    const [totalYes, totalNo, proposed, finalOutcome, evidenceHash, proposedAt, finalizedAt, challenged, maturity] = res.slice(1) as [
      bigint, bigint, number, number, Hex, bigint, bigint, boolean, bigint,
    ];
    const decision: Decision | undefined =
      proposedAt > 0n || finalizedAt > 0n
        ? {
            proposed: outcomeFromEnum(proposed),
            outcome: outcomeFromEnum(finalOutcome),
            evidenceHash,
            proposedAt: Number(proposedAt),
            challenged,
            finalizedAt: finalizedAt > 0n ? Number(finalizedAt) : undefined,
          }
        : undefined;
    const now = Number(block.timestamp);
    const lockTime = Number(r.lockTime);
    const crossChainCutoff = Number(r.crossChainCutoff);
    let remoteCutoff: number | undefined;
    if (arb.CCIPStakeSenderV2)
      remoteCutoff = Number(
        await arbClient()
          .readContract({ address: arb.CCIPStakeSenderV2, abi: ccipStakeSenderV2Abi, functionName: 'reportCutoff', args: [id] })
          .catch(() => 0n),
      );
    const yt = await vaultYt();
    return {
      reportId: id,
      reportHash: r.reportHash,
      claimHash: r.claimHash,
      reviewer: r.reviewer,
      resolver: r.resolver,
      adjudicator: r.adjudicator,
      lockTime,
      crossChainCutoff,
      resultDeadline: Number(r.resultDeadline),
      challengePeriod: Number(r.challengePeriod),
      maturity: Number(maturity),
      totals: { yes: totalYes, no: totalNo },
      // V2 has no lock() call: stakes close at lockTime and YT exists from the first stake.
      locked: now >= lockTime,
      phase: derivePhase({ now, lockTime, crossChainCutoff, decision }),
      chainTime: now,
      blockNumber: block.number,
      decision,
      yt: yt ? { address: yt } : undefined,
      market: await pool().catch(() => undefined),
      remoteCutoff,
    };
  },

  async getPosition(id, account) {
    await assertSeries(id);
    const c = sepoliaClient();
    const dusd = req(eth.DemoUSD, 'DemoUSD');
    const [yes, no, bal, alw] = (await c.multicall({
      allowFailure: false,
      contracts: [
        V('positionOf', [account, true]),
        V('positionOf', [account, false]),
        { address: dusd, abi: demoUsdAbi, functionName: 'balanceOf', args: [account] },
        { address: dusd, abi: demoUsdAbi, functionName: 'allowance', args: [account, vault()] },
      ] as never,
    })) as bigint[];
    let yt = 0n;
    let ytClaimable = 0n;
    const ytAddr = await vaultYt();
    if (ytAddr) {
      const [b, idx, paid, unclaimed] = (await c.multicall({
        allowFailure: false,
        contracts: [
          { address: ytAddr, abi: stakerYieldTokenAbi, functionName: 'balanceOf', args: [account] },
          { address: ytAddr, abi: stakerYieldTokenAbi, functionName: 'globalIndex' },
          { address: ytAddr, abi: stakerYieldTokenAbi, functionName: 'paidIndex', args: [account] },
          { address: ytAddr, abi: stakerYieldTokenAbi, functionName: 'unclaimedUSDC', args: [account] },
        ],
      })) as unknown as bigint[];
      yt = b;
      ytClaimable = unclaimed + (b * (idx - paid)) / 10n ** 18n;
    }
    let lpShares = 0n;
    let lpClaimable = 0n;
    if (eth.YieldCurveHookV2) {
      const hook = eth.YieldCurveHookV2;
      const shares = (await c.readContract({ address: hook, abi: yieldCurveHookV2Abi, functionName: 'shares' })) as Address;
      if (shares !== zeroAddress) {
        const [s, per, paid, un] = (await c.multicall({
          allowFailure: false,
          contracts: [
            { address: shares, abi: yieldLpShareAbi, functionName: 'balanceOf', args: [account] },
            { address: hook, abi: yieldCurveHookV2Abi, functionName: 'lpYieldPerShare' },
            { address: hook, abi: yieldCurveHookV2Abi, functionName: 'paidLPIndex', args: [account] },
            { address: hook, abi: yieldCurveHookV2Abi, functionName: 'unclaimedLPYield', args: [account] },
          ],
        })) as unknown as bigint[];
        lpShares = s;
        lpClaimable = un + (s * (per - paid)) / 10n ** 18n;
      }
    }
    const m = await v2.getMarket(id);
    const outcome = m.decision?.outcome;
    const tracked = loadTracked().filter((t) => t.reportId === id.toString());
    const pendingCcip = (await Promise.all(tracked.map((t) => v2.trackCcip(t.messageId).catch(() => undefined)))).filter(
      (s): s is CcipStake => !!s && s.status !== 'credited' && s.status !== 'recovered',
    );
    return {
      yes,
      no,
      yt,
      ytClaimable,
      lpShares,
      lpClaimable,
      pendingCcip,
      redeemable: outcome ? payoutFor(outcome, 'yes', yes, m.totals) + payoutFor(outcome, 'no', no, m.totals) : undefined,
      // REP is a V1 contract bound to V1 Settlement.eligibleWinner.
      repBadge: false,
      dusdBalance: bal,
      allowance: alw,
      transferable: false,
    };
  },

  async stakeLocal(id, yes, amount, account) {
    await assertSeries(id);
    const dusd = req(eth.DemoUSD, 'DemoUSD');
    const plan: TxPlan = [];
    if ((await allowance('eth', dusd, account, vault())) < amount) plan.push(approve(SEPOLIA_ID, dusd, vault()));
    plan.push({
      label: `Stake ${yes ? 'Yes' : 'No'} (keep my YT)`,
      chainId: SEPOLIA_ID,
      request: call(vault(), riskFiStakeVaultV2Abi as Abi, 'stake', [id, yes, amount, account, account]),
    });
    return plan;
  },

  async quoteStakeAndSell(amount) {
    return (await sepoliaClient().readContract({
      address: req(eth.StakeAndSellRouterV2, 'StakeAndSellRouterV2'),
      abi: stakeAndSellRouterV2Abi,
      functionName: 'quoteSell',
      args: [amount],
    })) as bigint;
  },

  async stakeAndSell(id, yes, amount, minUsdcOut, deadline, account) {
    await assertSeries(id);
    const router = req(eth.StakeAndSellRouterV2, 'StakeAndSellRouterV2');
    const dusd = req(eth.DemoUSD, 'DemoUSD');
    const plan: TxPlan = [];
    if ((await allowance('eth', dusd, account, router)) < amount) plan.push(approve(SEPOLIA_ID, dusd, router));
    plan.push({
      label: `Stake ${yes ? 'Yes' : 'No'} and sell my YT`,
      chainId: SEPOLIA_ID,
      request: call(router, stakeAndSellRouterV2Abi as Abi, 'stakeAndSellYield', [yes, amount, minUsdcOut, BigInt(deadline)]),
    });
    return plan;
  },

  async quoteRemote(id, yes, amount, account) {
    const sender = req(arb.CCIPStakeSenderV2, 'CCIPStakeSenderV2');
    const m = await v2.getMarket(id);
    const intent = buildIntentV2({ reportId: id, yes, account, amount, lockTime: m.lockTime, nonce: 1n });
    const fee = (await arbClient().readContract({ address: sender, abi: ccipStakeSenderV2Abi, functionName: 'quoteFee', args: [intent, amount, basicExtraArgsV3()] })) as bigint;
    return { fee, deadline: Number(intent.deadline), cutoff: m.remoteCutoff ?? m.crossChainCutoff };
  },

  async stakeRemote(id, yes, amount, account) {
    const sender = req(arb.CCIPStakeSenderV2, 'CCIPStakeSenderV2');
    const dusd = req(arb.DemoUSD, 'DemoUSD (Arbitrum Sepolia)');
    const m = await v2.getMarket(id);
    const intent = buildIntentV2({ reportId: id, yes, account, amount, lockTime: m.lockTime });
    const extraArgs = basicExtraArgsV3();
    const fee = (await arbClient().readContract({ address: sender, abi: ccipStakeSenderV2Abi, functionName: 'quoteFee', args: [intent, amount, extraArgs] })) as bigint;
    const plan: TxPlan = [];
    if ((await allowance('arb', dusd, account, sender)) < amount) plan.push(approve(ARB_SEPOLIA_ID, dusd, sender, 'Approve dUSD on Arbitrum Sepolia'));
    plan.push({
      label: `Send ${yes ? 'Yes' : 'No'} stake via CCIP`,
      chainId: ARB_SEPOLIA_ID,
      request: call(sender, ccipStakeSenderV2Abi as Abi, 'stakeRemote', [intent, amount, extraArgs], withFeeBuffer(fee)),
    });
    return plan;
  },

  async quoteYT(_id, dir, amount) {
    const hook = req(eth.YieldCurveHookV2, 'YieldCurveHookV2');
    const c = sepoliaClient();
    const out = (await c.readContract({ address: hook, abi: yieldCurveHookV2Abi, functionName: dir === 'buy' ? 'quoteBuy' : 'quoteSell', args: [amount] })) as bigint;
    const price = (await c.readContract({ address: hook, abi: yieldCurveHookV2Abi, functionName: 'spotPriceWad' })) as bigint;
    return { out, price };
  },

  async swapYT(_id, dir, amount, minOut, deadline, account) {
    const usdc = req(eth.DemoUSD, 'DemoUSD');
    const p = await pool();
    if (!p?.poolKey || !p.configured) throw new ProtocolRevert('Market not deployed yet');
    const router = req(p.router, 'YieldSwapRouter (V2)');
    const yt = req(await vaultYt(), 'StakerYieldToken');
    const input = dir === 'buy' ? usdc : yt;
    const plan: TxPlan = [];
    if ((await allowance('eth', input, account, router)) < amount) plan.push(approve(SEPOLIA_ID, input, router, dir === 'buy' ? 'Approve dUSD' : 'Approve YT'));
    plan.push({
      label: dir === 'buy' ? 'Buy YT' : 'Sell YT',
      chainId: SEPOLIA_ID,
      request: call(router, yieldSwapRouterAbi as Abi, 'swapExactInput', [p.poolKey, zeroForOneFor(p.poolKey, dir, usdc), amount, minOut, BigInt(deadline)]),
    });
    return plan;
  },

  async challenge(id, evidenceHash) {
    await assertSeries(id);
    return [{ label: 'Challenge the proposal', chainId: SEPOLIA_ID, request: call(vault(), riskFiStakeVaultV2Abi as Abi, 'challenge', [evidenceHash]) }];
  },
  async finalize(id) {
    await assertSeries(id);
    return [{ label: 'Finalize', chainId: SEPOLIA_ID, request: call(vault(), riskFiStakeVaultV2Abi as Abi, 'finalize') }];
  },
  async redeem(id, yes, amount) {
    await assertSeries(id);
    return [{ label: `Claim ${yes ? 'Yes' : 'No'} principal`, chainId: SEPOLIA_ID, request: call(vault(), riskFiStakeVaultV2Abi as Abi, 'claimPrincipal', [yes, amount]) }];
  },
  async claimYield() {
    const yt = req(await vaultYt(), 'StakerYieldToken');
    return [{ label: 'Claim yield', chainId: SEPOLIA_ID, request: call(yt, stakerYieldTokenAbi as Abi, 'claimYield') }];
  },
  async claimLPYield() {
    return [{ label: 'Claim LP yield', chainId: SEPOLIA_ID, request: call(req(eth.YieldCurveHookV2, 'YieldCurveHookV2'), yieldCurveHookV2Abi as Abi, 'claimLPYield') }];
  },
  async recoverCcip(messageId, to) {
    return [{ label: 'Recover held dUSD', chainId: SEPOLIA_ID, request: call(req(eth.CCIPStakeReceiverV2, 'CCIPStakeReceiverV2'), ccipStakeReceiverV2Abi as Abi, 'recover', [messageId, to]) }];
  },

  async trackCcip(messageId) {
    const receiver = req(eth.CCIPStakeReceiverV2, 'CCIPStakeReceiverV2');
    const c = sepoliaClient();
    const logs: CcipLogs = {};
    const tracked = loadTracked().find((t) => t.messageId.toLowerCase() === messageId.toLowerCase());
    if (tracked) logs.sent = { tx: tracked.sourceTx ?? '0x', at: tracked.savedAt };
    // V2 has no creditedMessage view; Credited/Held/Recovered logs decide (bounded window).
    const from = await recentFrom(c, 200_000n);
    const find = async (eventName: 'Credited' | 'Held' | 'Recovered') =>
      (await c.getContractEvents({ address: receiver, abi: ccipStakeReceiverV2Abi, eventName, args: { messageId }, fromBlock: from }).catch(() => [])).at(-1);
    const [cr, hd, rc] = await Promise.all([find('Credited'), find('Held'), find('Recovered')]);
    if (cr) logs.credited = { tx: cr.transactionHash };
    if (hd) logs.held = { tx: hd.transactionHash };
    if (rc) logs.recovered = { tx: rc.transactionHash };
    if (!tracked && !cr && !hd) return undefined;
    const [recoverable, source] = (await c.multicall({
      allowFailure: false,
      contracts: [
        { address: receiver, abi: ccipStakeReceiverV2Abi, functionName: 'recoverable', args: [messageId] },
        { address: receiver, abi: ccipStakeReceiverV2Abi, functionName: 'recoverySourceAccount', args: [messageId] },
      ],
    })) as unknown as [bigint, Address];
    return {
      messageId,
      reportId: BigInt(tracked?.reportId ?? 0),
      yes: tracked?.side === 'yes',
      amount: BigInt(tracked?.amount ?? 0),
      recipient: source,
      sourceTx: tracked?.sourceTx,
      sentAt: tracked?.savedAt,
      status: ccipStatus(logs),
      destTx: (rc ?? hd ?? cr)?.transactionHash,
      recoveryRecipient: hd ? source : undefined,
      recoverable: hd ? recoverable : undefined,
    };
  },
};
