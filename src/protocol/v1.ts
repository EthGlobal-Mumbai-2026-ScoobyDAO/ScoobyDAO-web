import { maxUint256, zeroAddress, type Abi, type Address, type Hex } from 'viem';
import {
  ARB_SEPOLIA_ID,
  arbitrumSepolia as arb,
  ccipStakeReceiverAbi,
  ccipStakeSenderAbi,
  demoUsdAbi,
  reportRegistryAbi,
  reputationAbi,
  SEPOLIA_ID,
  sepolia as eth,
  settlementAbi,
  voteMarketAbi,
  votingPositionTokenAbi,
  yieldHookFactoryAbi,
  yieldLpShareAbi,
  yieldMarketHookAbi,
  yieldSplitterAbi,
  yieldSwapRouterAbi,
  yieldTokenAbi,
  yieldVaultAdapterAbi,
} from '@/contracts';
import { payoutFor } from '@/lib/payout';
import { basicExtraArgsV3, buildIntentV1, ccipStatus, loadTracked, withFeeBuffer, type CcipLogs } from './ccip';
import { arbClient, recentFrom, sepoliaClient } from './clients';
import { constantProductOut, spotPriceWad, yieldPoolKey, zeroForOneFor } from './market';
import { derivePhase, outcomeFromEnum, THIRTY_DAYS } from './phase';
import {
  ProtocolRevert,
  type CcipStake,
  type ContractCall,
  type Decision,
  type MarketPool,
  type MarketView,
  type PositionView,
  type Protocol,
  type ReputationBadgeAuthorization,
  type TxPlan,
} from './types';

// Live adapter for the deployed V1 contracts (deployments/testnets.json).
// Field names checked against ../SmartContracts/src: ReportRegistry.getReport/reportCount,
// VoteMarket.total(id, yes)/locked, Settlement.decisions, VotingPositionToken.tokenId,
// YieldSplitter.yieldToken, YieldToken.{globalIndex,paidIndex,unclaimedUSDC}.

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

type ReportTuple = {
  reportHash: Hex;
  claimHash: Hex;
  reviewer: Address;
  resolver: Address;
  adjudicator: Address;
  lockTime: bigint;
  crossChainCutoff: bigint;
  resultDeadline: bigint;
  challengePeriod: bigint;
};

const ytCache = new Map<string, Address>();
const hookCache = new Map<string, Address | null>();

async function ytOf(id: bigint): Promise<Address | undefined> {
  if (!eth.YieldSplitter) return undefined;
  const k = id.toString();
  if (ytCache.has(k)) return ytCache.get(k);
  const yt = (await sepoliaClient().readContract({
    address: eth.YieldSplitter,
    abi: yieldSplitterAbi,
    functionName: 'yieldToken',
    args: [id],
  })) as Address;
  if (yt === zeroAddress) return undefined;
  ytCache.set(k, yt);
  return yt;
}

/** YieldMarketHook for a YT: testnets.json first, else YieldHookFactory.HookDeployed(hook, yt). */
async function hookOf(yt: Address): Promise<Address | undefined> {
  if (eth.YieldMarketHook) return eth.YieldMarketHook;
  if (!eth.YieldHookFactory) return undefined;
  const k = yt.toLowerCase();
  if (hookCache.has(k)) return hookCache.get(k) ?? undefined;
  try {
    const c = sepoliaClient();
    const logs = await c.getContractEvents({
      address: eth.YieldHookFactory,
      abi: yieldHookFactoryAbi,
      eventName: 'HookDeployed',
      args: { yt },
      fromBlock: await recentFrom(c, 500_000n),
    });
    const hook = (logs.at(-1)?.args as { hook?: Address } | undefined)?.hook;
    hookCache.set(k, hook ?? null);
    return hook;
  } catch {
    return undefined;
  }
}

async function poolOf(yt: Address): Promise<MarketPool | undefined> {
  const hook = await hookOf(yt);
  const usdc = eth.DemoUSD;
  if (!hook || !usdc) return undefined;
  const c = sepoliaClient();
  const base = { address: hook, abi: yieldMarketHookAbi } as const;
  const [usdcReserve, ytReserve, feePips, maturity, keyHash] = (await Promise.all([
    c.readContract({ ...base, functionName: 'usdcReserve' }),
    c.readContract({ ...base, functionName: 'ytReserve' }),
    c.readContract({ ...base, functionName: 'feePips' }),
    c.readContract({ ...base, functionName: 'maturity' }),
    c.readContract({ ...base, functionName: 'poolKeyHash' }),
  ])) as [bigint, bigint, number, bigint, Hex];
  return {
    hook,
    router: eth.YieldSwapRouter,
    poolKey: yieldPoolKey(usdc, yt, hook),
    reserves: { usdc: usdcReserve, yt: ytReserve },
    spotPriceWad: spotPriceWad(usdcReserve, ytReserve),
    feePips: Number(feePips),
    maturity: Number(maturity),
    configured: keyHash !== `0x${'0'.repeat(64)}`,
  };
}

async function allowanceOf(chain: 'eth' | 'arb', owner: Address, spender: Address, token: Address) {
  const c = chain === 'eth' ? sepoliaClient() : arbClient();
  return (await c.readContract({ address: token, abi: demoUsdAbi, functionName: 'allowance', args: [owner, spender] })) as bigint;
}

function approveStep(chainId: number, token: Address, spender: Address, label = 'Approve dUSD'): TxPlan[number] {
  return { label, chainId, request: call(token, demoUsdAbi as Abi, 'approve', [spender, maxUint256]) };
}

export const v1: Protocol = {
  kind: 'v1',
  dusd: eth.DemoUSD,

  async listPublished() {
    // reportCount is the source for ids 1..n; Published logs carry the same ids but most public
    // RPCs reject an unbounded getLogs range (NOTES.md).
    const n = (await sepoliaClient().readContract({
      address: req(eth.ReportRegistry, 'ReportRegistry'),
      abi: reportRegistryAbi,
      functionName: 'reportCount',
    })) as bigint;
    return Array.from({ length: Number(n) }, (_, i) => BigInt(i + 1));
  },

  async chainTime() {
    return Number((await sepoliaClient().getBlock()).timestamp);
  },

  async getMarket(id) {
    const c = sepoliaClient();
    const block = await c.getBlock();
    const at = { blockNumber: block.number } as const;
    const registry = req(eth.ReportRegistry, 'ReportRegistry');
    const market = req(eth.VoteMarket, 'VoteMarket');
    const settlement = req(eth.Settlement, 'Settlement');
    const res = await c.multicall({
      ...at,
      allowFailure: false,
      contracts: [
        { address: registry, abi: reportRegistryAbi, functionName: 'getReport', args: [id] },
        { address: market, abi: voteMarketAbi, functionName: 'total', args: [id, true] },
        { address: market, abi: voteMarketAbi, functionName: 'total', args: [id, false] },
        { address: market, abi: voteMarketAbi, functionName: 'locked', args: [id] },
        { address: settlement, abi: settlementAbi, functionName: 'decisions', args: [id] },
      ],
    });
    const r = res[0] as unknown as ReportTuple;
    if (r.lockTime === 0n) throw new ProtocolRevert(`Report #${id} is not published onchain`);
    const [proposed, finalOutcome, evidenceHash, proposedAt, finalizedAt, challenged] = res[4] as unknown as [
      number, number, Hex, bigint, bigint, boolean,
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
    if (arb.CCIPStakeSender) {
      try {
        remoteCutoff = Number(
          await arbClient().readContract({
            address: arb.CCIPStakeSender,
            abi: ccipStakeSenderAbi,
            functionName: 'reportCutoff',
            args: [id],
          }),
        );
      } catch {
        remoteCutoff = undefined;
      }
    }
    const ytAddr = await ytOf(id).catch(() => undefined);
    const pool = ytAddr ? await poolOf(ytAddr).catch(() => undefined) : undefined;

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
      maturity: lockTime + THIRTY_DAYS,
      totals: { yes: res[1] as bigint, no: res[2] as bigint },
      locked: res[3] as boolean,
      phase: derivePhase({ now, lockTime, crossChainCutoff, decision }),
      chainTime: now,
      blockNumber: block.number,
      decision,
      yt: ytAddr ? { address: ytAddr } : undefined,
      market: pool,
      remoteCutoff,
    } satisfies MarketView;
  },

  async getPosition(id, account) {
    const c = sepoliaClient();
    const positions = req(eth.VotingPositionToken, 'VotingPositionToken');
    const dusd = req(eth.DemoUSD, 'DemoUSD');
    const [yesId, noId] = (await Promise.all([
      c.readContract({ address: positions, abi: votingPositionTokenAbi, functionName: 'tokenId', args: [id, true] }),
      c.readContract({ address: positions, abi: votingPositionTokenAbi, functionName: 'tokenId', args: [id, false] }),
    ])) as [bigint, bigint];
    const base = await c.multicall({
      allowFailure: false,
      contracts: [
        { address: positions, abi: votingPositionTokenAbi, functionName: 'balanceOf', args: [account, yesId] },
        { address: positions, abi: votingPositionTokenAbi, functionName: 'balanceOf', args: [account, noId] },
        { address: dusd, abi: demoUsdAbi, functionName: 'balanceOf', args: [account] },
        { address: dusd, abi: demoUsdAbi, functionName: 'allowance', args: [account, req(eth.VoteMarket, 'VoteMarket')] },
      ],
    });
    const [yes, no, dusdBalance, allowance] = base as unknown as bigint[];

    let yt = 0n;
    let ytClaimable = 0n;
    let lpShares = 0n;
    let lpClaimable = 0n;
    const ytAddr = await ytOf(id).catch(() => undefined);
    if (ytAddr) {
      const [bal, idx, paid, unclaimed] = (await c.multicall({
        allowFailure: false,
        contracts: [
          { address: ytAddr, abi: yieldTokenAbi, functionName: 'balanceOf', args: [account] },
          { address: ytAddr, abi: yieldTokenAbi, functionName: 'globalIndex' },
          { address: ytAddr, abi: yieldTokenAbi, functionName: 'paidIndex', args: [account] },
          { address: ytAddr, abi: yieldTokenAbi, functionName: 'unclaimedUSDC', args: [account] },
        ],
      })) as unknown as bigint[];
      yt = bal;
      // YieldToken._checkpoint: unclaimed + balance * (globalIndex - paidIndex) / 1e18
      ytClaimable = unclaimed + (bal * (idx - paid)) / 10n ** 18n;
      const hook = await hookOf(ytAddr);
      if (hook) {
        const shares = (await c.readContract({ address: hook, abi: yieldMarketHookAbi, functionName: 'shares' })) as Address;
        const [s, perShare, paidLp, unclaimedLp] = (await c.multicall({
          allowFailure: false,
          contracts: [
            { address: shares, abi: yieldLpShareAbi, functionName: 'balanceOf', args: [account] },
            { address: hook, abi: yieldMarketHookAbi, functionName: 'lpYieldPerShare' },
            { address: hook, abi: yieldMarketHookAbi, functionName: 'paidLPIndex', args: [account] },
            { address: hook, abi: yieldMarketHookAbi, functionName: 'unclaimedLPYield', args: [account] },
          ],
        })) as unknown as bigint[];
        lpShares = s;
        lpClaimable = unclaimedLp + (s * (perShare - paidLp)) / 10n ** 18n;
      }
    }

    let reputationBadge = false;
    if (eth.Reputation) {
      reputationBadge = (await c.readContract({
        address: eth.Reputation,
        abi: reputationAbi,
        functionName: 'hasBadge',
        args: [id, account],
      })) as boolean;
    }

    const m = await v1.getMarket(id);
    const outcome = m.decision?.outcome;
    const redeemable = outcome
      ? payoutFor(outcome, 'yes', yes, m.totals) + payoutFor(outcome, 'no', no, m.totals)
      : undefined;

    let remote: PositionView['remote'];
    if (arb.DemoUSD && arb.CCIPStakeSender) {
      try {
        const a = arbClient();
        const [bal, alw] = (await a.multicall({
          allowFailure: false,
          contracts: [
            { address: arb.DemoUSD, abi: demoUsdAbi, functionName: 'balanceOf', args: [account] },
            { address: arb.DemoUSD, abi: demoUsdAbi, functionName: 'allowance', args: [account, arb.CCIPStakeSender] },
          ],
        })) as unknown as bigint[];
        remote = { dusdBalance: bal, allowance: alw, ethBalance: await a.getBalance({ address: account }) };
      } catch {
        remote = undefined;
      }
    }

    const tracked = loadTracked().filter((t) => t.reportId === id.toString());
    const pendingCcip = (await Promise.all(tracked.map((t) => v1.trackCcip(t.messageId).catch(() => undefined)))).filter(
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
      redeemable,
      reputationBadge,
      repReceipt: 0n,
      dusdBalance,
      allowance,
      remote,
      transferable: true,
    };
  },

  async stakeLocal(id, yes, amount, account) {
    const dusd = req(eth.DemoUSD, 'DemoUSD');
    const market = req(eth.VoteMarket, 'VoteMarket');
    const plan: TxPlan = [];
    if ((await allowanceOf('eth', account, market, dusd)) < amount) plan.push(approveStep(SEPOLIA_ID, dusd, market));
    plan.push({
      label: `Stake ${yes ? 'Yes' : 'No'}`,
      chainId: SEPOLIA_ID,
      request: call(market, voteMarketAbi as Abi, 'stakeLocal', [id, yes, amount, account]),
    });
    return plan;
  },

  async quoteRemote(id, yes, amount, account) {
    const sender = req(arb.CCIPStakeSender, 'CCIPStakeSender');
    const m = await v1.getMarket(id);
    const intent = buildIntentV1({ reportId: id, yes, recipient: account, amount, lockTime: m.lockTime, nonce: 1n });
    const fee = (await arbClient().readContract({
      address: sender,
      abi: ccipStakeSenderAbi,
      functionName: 'quoteFee',
      args: [intent, amount, basicExtraArgsV3()],
    })) as bigint;
    return { fee, deadline: Number(intent.deadline), cutoff: m.remoteCutoff ?? m.crossChainCutoff };
  },

  async stakeRemote(id, yes, amount, account) {
    const sender = req(arb.CCIPStakeSender, 'CCIPStakeSender');
    const dusd = req(arb.DemoUSD, 'DemoUSD (Arbitrum Sepolia)');
    const m = await v1.getMarket(id);
    const intent = buildIntentV1({ reportId: id, yes, recipient: account, amount, lockTime: m.lockTime });
    const extraArgs = basicExtraArgsV3();
    const fee = (await arbClient().readContract({
      address: sender,
      abi: ccipStakeSenderAbi,
      functionName: 'quoteFee',
      args: [intent, amount, extraArgs],
    })) as bigint;
    const plan: TxPlan = [];
    if ((await allowanceOf('arb', account, sender, dusd)) < amount)
      plan.push(approveStep(ARB_SEPOLIA_ID, dusd, sender, 'Approve dUSD on Arbitrum Sepolia'));
    plan.push({
      label: `Send ${yes ? 'Yes' : 'No'} stake via CCIP`,
      chainId: ARB_SEPOLIA_ID,
      request: call(sender, ccipStakeSenderAbi as Abi, 'stakeRemote', [intent, amount, extraArgs], withFeeBuffer(fee)),
    });
    return plan;
  },

  async quoteYT(id, dir, amount) {
    const ytAddr = await ytOf(id);
    const pool = ytAddr ? await poolOf(ytAddr) : undefined;
    if (!pool?.reserves || !pool.configured) throw new ProtocolRevert('Market not deployed yet');
    const [rin, rout] = dir === 'buy' ? [pool.reserves.usdc, pool.reserves.yt] : [pool.reserves.yt, pool.reserves.usdc];
    return { out: constantProductOut(amount, rin, rout, pool.feePips ?? 0), price: pool.spotPriceWad };
  },

  async swapYT(id, dir, amount, minOut, deadline, account) {
    const usdc = req(eth.DemoUSD, 'DemoUSD');
    const ytAddr = req(await ytOf(id), 'Yield token');
    const pool = await poolOf(ytAddr);
    if (!pool?.poolKey) throw new ProtocolRevert('Market not deployed yet');
    const router = req(pool.router, 'YieldSwapRouter');
    const input = dir === 'buy' ? usdc : ytAddr;
    const plan: TxPlan = [];
    // YieldSwapRouter.unlockCallback pulls the input with transferFrom(payer → manager).
    if ((await allowanceOf('eth', account, router, input)) < amount)
      plan.push(approveStep(SEPOLIA_ID, input, router, dir === 'buy' ? 'Approve dUSD' : 'Approve YT'));
    plan.push({
      label: dir === 'buy' ? 'Buy YT' : 'Sell YT',
      chainId: SEPOLIA_ID,
      request: call(router, yieldSwapRouterAbi as Abi, 'swapExactInput', [
        pool.poolKey,
        zeroForOneFor(pool.poolKey, dir, usdc),
        amount,
        minOut,
        BigInt(deadline),
      ]),
    });
    return plan;
  },

  async challenge(id, evidenceHash) {
    return [{ label: 'Challenge the proposal', chainId: SEPOLIA_ID, request: call(req(eth.Settlement, 'Settlement'), settlementAbi as Abi, 'challenge', [id, evidenceHash]) }];
  },

  async finalize(id) {
    return [{ label: 'Finalize', chainId: SEPOLIA_ID, request: call(req(eth.Settlement, 'Settlement'), settlementAbi as Abi, 'finalize', [id]) }];
  },

  async redeem(id, yes, amount) {
    return [
      {
        label: `Redeem ${yes ? 'Yes' : 'No'} position`,
        chainId: SEPOLIA_ID,
        request: call(req(eth.Settlement, 'Settlement'), settlementAbi as Abi, 'redeemVPT', [id, yes, amount]),
      },
    ];
  },

  async claimYield(id) {
    const ytAddr = req(await ytOf(id), 'Yield token');
    const plan: TxPlan = [];
    // Vault yield reaches YT holders only after YieldSplitter.checkpointYield (public).
    if (eth.YieldSplitter && eth.YieldVaultAdapter) {
      const c = sepoliaClient();
      const [pending, prepared] = (await Promise.all([
        c.readContract({ address: eth.YieldVaultAdapter, abi: yieldVaultAdapterAbi, functionName: 'positiveYield' }),
        c.readContract({ address: eth.YieldSplitter, abi: yieldSplitterAbi, functionName: 'prepared', args: [id] }),
      ])) as [bigint, boolean];
      if (pending > 0n && !prepared)
        plan.push({ label: 'Checkpoint vault yield', chainId: SEPOLIA_ID, request: call(eth.YieldSplitter, yieldSplitterAbi as Abi, 'checkpointYield', [id]) });
    }
    plan.push({ label: 'Claim yield', chainId: SEPOLIA_ID, request: call(ytAddr, yieldTokenAbi as Abi, 'claimYield') });
    return plan;
  },

  async claimLPYield(id) {
    const ytAddr = req(await ytOf(id), 'Yield token');
    const hook = req(await hookOf(ytAddr), 'YieldMarketHook');
    return [{ label: 'Claim LP yield', chainId: SEPOLIA_ID, request: call(hook, yieldMarketHookAbi as Abi, 'claimLPYield') }];
  },

  async claimReputationBadge(a: ReputationBadgeAuthorization) {
    return [
      {
        label: 'Claim reputation badge (World ID, V1)',
        chainId: SEPOLIA_ID,
        request: call(req(eth.Reputation, 'Reputation'), reputationAbi as Abi, 'claimWinnerREP', [
          BigInt(a.reportId),
          a.recipient,
          a.scopedNullifier,
          BigInt(a.nonce),
          BigInt(a.expiry),
          a.signature,
        ]),
      },
    ];
  },

  async recoverCcip(messageId, to) {
    return [
      {
        label: 'Recover held dUSD',
        chainId: SEPOLIA_ID,
        request: call(req(eth.CCIPStakeReceiver, 'CCIPStakeReceiver'), ccipStakeReceiverAbi as Abi, 'recover', [messageId, to]),
      },
    ];
  },

  async ytVolume() {
    const id = (await v1.listPublished()).at(-1);
    const yt = id ? await ytOf(id).catch(() => undefined) : undefined;
    const hook = yt ? await hookOf(yt) : undefined;
    if (!hook) return undefined;
    const c = sepoliaClient();
    const logs = await c.getContractEvents({ address: hook, abi: yieldMarketHookAbi, eventName: 'Swapped', fromBlock: await recentFrom(c, 500_000n) });
    // Swapped(usdcIn, amountIn, amountOut): the YT leg is amountOut when buying, amountIn when selling.
    return logs.reduce((sum, l) => {
      const a = l.args as { usdcIn: boolean; amountIn: bigint; amountOut: bigint };
      return sum + (a.usdcIn ? a.amountOut : a.amountIn);
    }, 0n);
  },

  async trackCcip(messageId) {
    const receiver = req(eth.CCIPStakeReceiver, 'CCIPStakeReceiver');
    const market = req(eth.VoteMarket, 'VoteMarket');
    const c = sepoliaClient();
    const logs: CcipLogs = {};
    const tracked = loadTracked().find((t) => t.messageId.toLowerCase() === messageId.toLowerCase());

    // Source: the Sent event in the source tx receipt (or a bounded log search).
    let sent: { reportId: bigint; recipient: Address; yes: boolean; amount: bigint } | undefined;
    if (arb.CCIPStakeSender) {
      const a = arbClient();
      try {
        const ev = await a.getContractEvents({
          address: arb.CCIPStakeSender,
          abi: ccipStakeSenderAbi,
          eventName: 'Sent',
          args: { messageId },
          fromBlock: await recentFrom(a, 2_000_000n),
        });
        const e = ev.at(-1);
        if (e) {
          const args = e.args as { reportId: bigint; recipient: Address; yes: boolean; amount: bigint };
          sent = args;
          const blk = await a.getBlock({ blockNumber: e.blockNumber });
          logs.sent = { tx: e.transactionHash, at: Number(blk.timestamp) };
        }
      } catch {
        if (tracked?.sourceTx) logs.sent = { tx: tracked.sourceTx, at: tracked.savedAt };
      }
    }

    // Destination: VoteMarket.creditedMessage and CCIPStakeReceiver.{delivered,recoverable,recoveryRecipient}.
    const [delivered, credited, recoverable, recoveryRecipient] = (await c.multicall({
      allowFailure: false,
      contracts: [
        { address: receiver, abi: ccipStakeReceiverAbi, functionName: 'delivered', args: [messageId] },
        { address: market, abi: voteMarketAbi, functionName: 'creditedMessage', args: [messageId] },
        { address: receiver, abi: ccipStakeReceiverAbi, functionName: 'recoverable', args: [messageId] },
        { address: receiver, abi: ccipStakeReceiverAbi, functionName: 'recoveryRecipient', args: [messageId] },
      ],
    })) as unknown as [boolean, boolean, bigint, Address];
    let destTx: Hex | undefined;
    if (delivered) {
      try {
        const from = await recentFrom(c, 200_000n);
        const name = credited ? 'Credited' : recoverable > 0n ? 'Held' : 'Recovered';
        const ev = await c.getContractEvents({ address: receiver, abi: ccipStakeReceiverAbi, eventName: name, args: { messageId }, fromBlock: from });
        destTx = ev.at(-1)?.transactionHash;
      } catch {
        destTx = undefined;
      }
      if (credited) logs.credited = { tx: destTx ?? '0x' };
      else {
        logs.held = { tx: destTx ?? '0x' };
        if (recoverable === 0n) logs.recovered = { tx: destTx ?? '0x' };
      }
    }
    if (!logs.sent && !delivered && !tracked) return undefined;
    if (!logs.sent && tracked) logs.sent = { tx: tracked.sourceTx ?? '0x', at: tracked.savedAt };

    return {
      messageId,
      reportId: sent?.reportId ?? BigInt(tracked?.reportId ?? 0),
      yes: sent?.yes ?? tracked?.side === 'yes',
      amount: sent?.amount ?? BigInt(tracked?.amount ?? 0),
      recipient: sent?.recipient ?? recoveryRecipient,
      sourceTx: logs.sent?.tx,
      sentAt: logs.sent?.at,
      status: ccipStatus(logs),
      destTx,
      recoveryRecipient: delivered && !credited ? recoveryRecipient : undefined,
      recoverable: delivered && !credited ? recoverable : undefined,
    };
  },
};
