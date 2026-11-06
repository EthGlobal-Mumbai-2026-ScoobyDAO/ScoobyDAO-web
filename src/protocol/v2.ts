import { formatEther, formatUnits, isAddressEqual, zeroAddress, type Address, type Hex, type Log, type PublicClient } from 'viem';
import { ARB_SEPOLIA_ID, SEPOLIA_ID, v2 as defaultBundle, v2Flexible as flexibleBundle, type V2Bundle } from '@/contracts/v2';
import { env } from '@/lib/env';
import { estimatePaid } from '@/lib/payout';
import { approvalStep, type Token } from './approvals';
import {
  basicExtraArgsV3,
  buildIntentV2,
  decodeReceiverOutcome,
  decodeSent,
  deriveV2CcipStatus,
  loadTracked,
  newRemoteAttempt,
  unusedNonce,
  withFeeBuffer,
  type ReceiverOutcome,
  type SentEvent,
} from './ccip';
import { fetchCcipMessage, type CcipApiResult } from './ccipApi';
import { arbClient, estimateBlockAt, getLogsChunked, LOG_WINDOW, multicallLoose, sepoliaClient, type ReadCall, type ReadResult } from './clients';
import { lpSharesFor, pendingLpYield, pendingYtYield, SWAP_DEADLINE_SECONDS, zeroForOneFor } from './market';
import { derivePhase, outcomeFromEnum, outcomeToEnum } from './phase';
import {
  ProtocolRevert,
  type ApproveOpts,
  type CcipStake,
  type ContractCall,
  type Decision,
  type MarketPool,
  type MarketView,
  type Outcome,
  type PositionView,
  type Protocol,
  type RemoteAttempt,
  type Trade,
  type TxEffect,
  type TxStep,
} from './types';
import { dusdReceived as defaultDusdReceived, eventTopic as defaultEventTopic, logsOf as defaultLogsOf, makeV2Handles, read as defaultRead, write as defaultWrite, type V2Event, type V2Fn, type V2Handle } from './v2contracts';

// Live adapter for the deployed V2 demo (Ethereum Sepolia + Arbitrum Sepolia). Every address,
// ABI and the pool key come from the handoff bundle via ./v2contracts. One vault serves one report
// (vault.reportId()); a report published in the registry without a vault has no market.
// Writes simulate first, then estimate gas with a margin (src/lib/tx.tsx); quotes, fees and CCIP
// nonces are re-read in `prepare` right before the wallet prompt.

export interface V2Deps {
  eth: () => PublicClient;
  arb: () => PublicClient;
  fetchCcip: (messageId: Hex) => Promise<CcipApiResult>;
  bundle?: V2Bundle;
}

type Report = {
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

const ZERO32 = `0x${'0'.repeat(64)}` as Hex;
const DECIMALS = 6;
const fmt = (v: bigint) => formatUnits(v, DECIMALS);
const side = (yes: boolean) => (yes ? 'Yes' : 'No');

async function readOne<T>(client: PublicClient, call: ReadCall): Promise<T> {
  return (await client.readContract(call as never)) as T;
}

async function readNamed<K extends string>(client: PublicClient, calls: Record<K, ReadCall>, blockNumber?: bigint): Promise<Record<K, ReadResult>> {
  const keys = Object.keys(calls) as K[];
  const res = await multicallLoose(client, keys.map((k) => calls[k]), blockNumber);
  return Object.fromEntries(keys.map((k, i) => [k, res[i]])) as Record<K, ReadResult>;
}

const need = <T>(r: ReadResult, what: string): T => {
  if (!r.ok) throw new ProtocolRevert(`Couldn't read ${what} on Ethereum Sepolia: ${r.error}`);
  return r.result as T;
};
const maybe = <T>(r: ReadResult): T | undefined => (r.ok ? (r.result as T) : undefined);

export function createV2(deps: V2Deps): Protocol & { kind: 'v2'; deploymentKey: string; deploymentBundle: V2Bundle } {
  const bundle = deps.bundle ?? defaultBundle;
  const V2 = makeV2Handles(bundle);
  const read = <H extends V2Handle>(h: H, fn: V2Fn<H>, args: readonly unknown[] = []) => defaultRead(h, fn, args, V2);
  const write = <H extends V2Handle>(h: H, fn: V2Fn<H>, args: readonly unknown[] = [], value?: bigint) => defaultWrite(h, fn, args, value, V2);
  const logsOf = <H extends V2Handle>(h: H, event: V2Event<H>, logs: Log[]) => defaultLogsOf(h, event, logs, V2);
  const eventTopic = <H extends V2Handle>(h: H, event: V2Event<H>) => defaultEventTopic(h, event, V2);
  const dusdReceived = (logs: Log[], from: Address, to: Address) => defaultDusdReceived(logs, from, to, V2);
  const DUSD: Token = { address: V2.dusd.address, abi: V2.dusd.abi, symbol: 'dUSD', decimals: DECIMALS };
  const DUSD_ARB: Token = { address: V2.dusdArb.address, abi: V2.dusdArb.abi, symbol: 'dUSD', decimals: DECIMALS };
  const YT: Token = { address: V2.yt.address, abi: V2.yt.abi, symbol: 'YT', decimals: DECIMALS };
  const REP_TOKEN: Token = { address: V2.rep.address, abi: V2.rep.abi, symbol: 'REP', decimals: DECIMALS };
  const LP_TOKEN: Token = { address: V2.lp.address, abi: V2.lp.abi, symbol: 'RF-YLP', decimals: DECIMALS };
  const eth = () => deps.eth();
  const arb = () => deps.arb();

  async function seriesId(): Promise<bigint> {
    return readOne<bigint>(eth(), read('vault', 'reportId'));
  }

  /** Never send a stake or claim for an id the vault doesn't serve (vault.reportId()). */
  async function assertSeries(id: bigint) {
    const served = await seriesId();
    if (served !== id) throw new ProtocolRevert(`No market is deployed for report #${id}: the V2 vault serves report #${served} only.`);
  }

  async function requireBalance(client: PublicClient, token: Token, owner: Address, amount: bigint, where: string) {
    if (amount <= 0n) throw new ProtocolRevert('Enter an amount above 0.');
    const bal = await readOne<bigint>(client, { address: token.address, abi: token.abi, functionName: 'balanceOf', args: [owner] });
    if (bal < amount) throw new ProtocolRevert(`Insufficient ${token.symbol} on ${where}: you have ${fmt(bal)}, this needs ${fmt(amount)}.`);
  }

  const approve = (token: Token, owner: Address, spender: Address, spenderLabel: string, amount: bigint, opts?: ApproveOpts, chainId: number = SEPOLIA_ID) =>
    approvalStep({ client: chainId === ARB_SEPOLIA_ID ? arb() : eth(), chainId, token, owner, spender, spenderLabel, amount, opts });

  const step = (label: string, request: ContractCall, extra: Partial<TxStep> = {}, chainId: number = SEPOLIA_ID): TxStep => ({ label, chainId, request, ...extra });

  async function latestTime(client: PublicClient): Promise<bigint> {
    return (await client.getBlock()).timestamp;
  }

  async function lpPool() {
    const r = await readNamed(eth(), { supply: read('lp', 'totalSupply'), usdcReserve: read('hook', 'usdcReserve'), ytReserve: read('hook', 'ytReserve') });
    return {
      supply: need<bigint>(r.supply, 'RF-YLP totalSupply'),
      usdcReserve: need<bigint>(r.usdcReserve, 'hook.usdcReserve'),
      ytReserve: need<bigint>(r.ytReserve, 'hook.ytReserve'),
    };
  }

  async function quoteHook(dir: 'buy' | 'sell', amount: bigint): Promise<bigint> {
    return readOne<bigint>(eth(), read('hook', dir === 'buy' ? 'quoteBuy' : 'quoteSell', [amount]));
  }

  // ------------------------------------------------------------------------------ CCIP tracker

  async function trackCcip(messageId: Hex): Promise<CcipStake | undefined> {
    const c = eth();
    const key = messageId.toLowerCase();
    const isExample = key === bundle.exampleCCIP.messageId.toLowerCase();
    const tracked = loadTracked().find((t) => t.messageId.toLowerCase() === key);
    const api = await deps.fetchCcip(messageId);
    const apiMsg = api.ok ? api.message : undefined;

    // Source: decode Sent from the Arbitrum Sepolia receipt (the authoritative intent details).
    const sourceTx = tracked?.sourceTx ?? apiMsg?.sendTransactionHash ?? (isExample ? bundle.exampleCCIP.sourceTx : undefined);
    let sent: SentEvent | undefined;
    let sourceConfirmed = false;
    if (sourceTx) {
      const rcpt = await arb()
        .getTransactionReceipt({ hash: sourceTx })
        .catch(() => undefined);
      if (rcpt?.status === 'success') {
        sourceConfirmed = true;
        sent = decodeSent(rcpt.logs, V2.sender.address, messageId);
      }
    }
    let sentAt = tracked?.savedAt;
    if (!sentAt && apiMsg?.sendTimestamp) {
      const t = Math.floor(Date.parse(apiMsg.sendTimestamp) / 1000);
      if (Number.isFinite(t)) sentAt = t;
    }

    // Destination: the receiver's own state, then the outcome event for this message id.
    const views = await readNamed(c, {
      delivered: read('receiver', 'delivered', [messageId]),
      recoverable: read('receiver', 'recoverable', [messageId]),
      recoverySource: read('receiver', 'recoverySourceAccount', [messageId]),
      operator: read('receiver', 'recoveryOperator'),
    });
    const delivered = need<boolean>(views.delivered, 'receiver.delivered');
    const recoverable = need<bigint>(views.recoverable, 'receiver.recoverable');
    const recoverySource = need<Address>(views.recoverySource, 'receiver.recoverySourceAccount');
    const operator = maybe<Address>(views.operator);

    if (!delivered && !sourceConfirmed && !apiMsg && !tracked) return undefined;

    let outcome: ReceiverOutcome | undefined;
    let destTx = apiMsg?.receiptTransactionHash ?? (isExample ? bundle.exampleCCIP.destinationTx : undefined);
    let outcomeUnknown = false;
    if (delivered) {
      if (destTx) {
        const rcpt = await c.getTransactionReceipt({ hash: destTx }).catch(() => undefined);
        if (rcpt) outcome = decodeReceiverOutcome(rcpt.logs, V2.receiver.address, messageId).outcome;
      }
      if (!outcome) {
        // Bounded scan (≤ 8 × 1,000 blocks) from about when the message was sent.
        const latest = await c.getBlock();
        const from = apiMsg?.receiptBlockNumber
          ? BigInt(apiMsg.receiptBlockNumber)
          : sentAt
            ? estimateBlockAt(latest, sentAt)
            : latest.number > LOG_WINDOW
              ? latest.number - LOG_WINDOW
              : 0n;
        const topics = [[eventTopic('receiver', 'Credited'), eventTopic('receiver', 'DeferredAsREP'), eventTopic('receiver', 'Held')], messageId];
        const scan = await getLogsChunked(c, { address: V2.receiver.address, topics }, { fromBlock: from, toBlock: latest.number, maxChunks: 8, stop: (l) => l.length > 0 }).catch(
          () => ({ logs: [] as Log[] }),
        );
        outcome = decodeReceiverOutcome(scan.logs, V2.receiver.address, messageId).outcome;
        if (outcome?.tx) destTx = outcome.tx;
        outcomeUnknown = !outcome;
      }
    }

    const status = deriveV2CcipStatus({
      sourceConfirmed,
      api: api.ok ? apiMsg?.status : 'unavailable',
      delivered,
      outcome: outcome?.kind,
      recoverable,
      recoverySourceAccount: recoverySource,
    });

    const recipient = sent?.recipient ?? (outcome?.kind === 'credited' ? outcome.recipient : undefined) ?? tracked?.recipient ?? zeroAddress;
    const yesSide = sent ? sent.yes : tracked ? tracked.side === 'yes' : undefined;
    const sourceAccount =
      sent?.sourceAccount ??
      (outcome && outcome.kind !== 'credited' ? outcome.sourceAccount : undefined) ??
      (recoverySource !== zeroAddress ? recoverySource : undefined) ??
      tracked?.sourceAccount;

    // "Voted" needs Credited plus a fresh position/YT read for the recipient.
    let refreshed: CcipStake['refreshed'];
    if (status === 'credited' && recipient !== zeroAddress && yesSide !== undefined) {
      const block = await c.getBlock();
      const r = await readNamed(c, { position: read('vault', 'positionOf', [recipient, yesSide]), yt: read('yt', 'balanceOf', [recipient]) }, block.number);
      if (r.position.ok && r.yt.ok) refreshed = { position: r.position.result as bigint, yt: r.yt.result as bigint, blockNumber: block.number };
    }
    let repBalance: bigint | undefined;
    if (status === 'deferred_as_rep' && sourceAccount) repBalance = await readOne<bigint>(c, read('rep', 'balanceOf', [sourceAccount])).catch(() => undefined);

    return {
      messageId,
      reportId: sent?.reportId ?? (outcome?.kind === 'credited' ? outcome.reportId : undefined) ?? BigInt(tracked?.reportId ?? 0),
      yes: yesSide ?? false,
      amount: sent?.amount ?? outcome?.amount ?? BigInt(tracked?.amount ?? 0),
      recipient,
      sourceAccount,
      sourceTx,
      sentAt,
      status,
      destTx,
      delivered,
      recoveryRecipient: status === 'held' || status === 'recovered' ? recoverySource : undefined,
      recoverable: status === 'held' || status === 'recovered' ? recoverable : undefined,
      recoveryOperator: operator,
      ccipApiStatus: apiMsg?.status,
      ccipApiUnavailable: !api.ok,
      readyForManualExecution: apiMsg?.readyForManualExecution,
      refreshed,
      repBalance,
      outcomeUnknown,
    };
  }

  // ---------------------------------------------------------------------------- the protocol

  const api: Protocol & { kind: 'v2'; deploymentKey: string; deploymentBundle: V2Bundle } = {
    kind: 'v2',
    deploymentKey: bundle.version,
    deploymentBundle: bundle,
    dusd: V2.dusd.address,

    async listPublished() {
      const id = await seriesId();
      return id > 0n ? [id] : [];
    },

    async chainTime() {
      return Number(await latestTime(eth()));
    },

    async getMarket(id) {
      const c = eth();
      const block = await c.getBlock();
      const r = await readNamed(
        c,
        {
          report: read('registry', 'getReport', [id]),
          maturity: read('registry', 'maturity', [id]),
          series: read('vault', 'reportId'),
          yt: read('vault', 'yt'),
          rep: read('vault', 'rep'),
          totalYes: read('vault', 'totalYes'),
          totalNo: read('vault', 'totalNo'),
          proposed: read('vault', 'proposed'),
          proposedAt: read('vault', 'proposedAt'),
          challenged: read('vault', 'challenged'),
          finalOutcome: read('vault', 'finalOutcome'),
          finalizedAt: read('vault', 'finalizedAt'),
          evidenceHash: read('vault', 'evidenceHash'),
          principalAvailable: read('vault', 'principalAvailable'),
          vaultMaturity: read('vault', 'maturity'),
          feeClaimed: read('vault', 'feeClaimed'),
          treasury: read('vault', 'treasury'),
          vaultDusd: read('dusd', 'balanceOf', [V2.vault.address]),
          repSupply: read('rep', 'totalSupply'),
          ytSupply: read('yt', 'totalSupply'),
          recoveryOperator: read('receiver', 'recoveryOperator'),
          poolKeyHash: read('hook', 'poolKeyHash'),
          shares: read('hook', 'shares'),
          usdcReserve: read('hook', 'usdcReserve'),
          ytReserve: read('hook', 'ytReserve'),
          spotPriceWad: read('hook', 'spotPriceWad'),
          impliedRateWad: read('hook', 'impliedRateWad'),
          timeRemainingWad: read('hook', 'timeRemainingWad'),
          feePips: read('hook', 'feePips'),
          hookMaturity: read('hook', 'maturity'),
          lpYieldPerShare: read('hook', 'lpYieldPerShare'),
          sharesSupply: read('lp', 'totalSupply'),
        },
        block.number,
      );
      const report = need<Report>(r.report, `ReportRegistry.getReport(${id})`);
      if (report.reportHash === ZERO32 && report.lockTime === 0n) throw new ProtocolRevert(`Report #${id} is not published in the V2 ReportRegistry.`);
      const series = need<bigint>(r.series, 'vault.reportId') === id;
      const now = Number(block.timestamp);
      const lockTime = Number(report.lockTime);
      const crossChainCutoff = Number(report.crossChainCutoff);

      let decision: Decision | undefined;
      let totals = { yes: 0n, no: 0n };
      let market: MarketPool | undefined;
      let projectedPrincipal: bigint | undefined;
      if (series) {
        totals = { yes: need<bigint>(r.totalYes, 'vault.totalYes'), no: need<bigint>(r.totalNo, 'vault.totalNo') };
        const proposedAt = need<bigint>(r.proposedAt, 'vault.proposedAt');
        const finalizedAt = need<bigint>(r.finalizedAt, 'vault.finalizedAt');
        if (proposedAt > 0n || finalizedAt > 0n)
          decision = {
            proposed: outcomeFromEnum(need<number>(r.proposed, 'vault.proposed')),
            outcome: outcomeFromEnum(need<number>(r.finalOutcome, 'vault.finalOutcome')),
            evidenceHash: need<Hex>(r.evidenceHash, 'vault.evidenceHash'),
            proposedAt: Number(proposedAt),
            challenged: need<boolean>(r.challenged, 'vault.challenged'),
            finalizedAt: finalizedAt > 0n ? Number(finalizedAt) : undefined,
          };
        const held = need<bigint>(r.vaultDusd, 'dUSD held by the vault') - need<bigint>(r.repSupply, 'REP totalSupply');
        const total = totals.yes + totals.no;
        projectedPrincipal = held < 0n ? 0n : held < total ? held : total;
        const keyHash = maybe<Hex>(r.poolKeyHash);
        if (keyHash && keyHash !== ZERO32)
          market = {
            hook: V2.hook.address,
            router: V2.swapRouter.address,
            poolKey: bundle.poolKey,
            spotPriceWad: maybe<bigint>(r.spotPriceWad),
            impliedRateWad: maybe<bigint>(r.impliedRateWad),
            timeRemainingWad: maybe<bigint>(r.timeRemainingWad),
            reserves: { usdc: maybe<bigint>(r.usdcReserve) ?? 0n, yt: maybe<bigint>(r.ytReserve) ?? 0n },
            feePips: Number(maybe<number>(r.feePips) ?? 0),
            maturity: Number(maybe<bigint>(r.hookMaturity) ?? need<bigint>(r.vaultMaturity, 'vault.maturity')),
            configured: keyHash.toLowerCase() === bundle.poolKeyHash.toLowerCase(),
            shares: maybe<Address>(r.shares),
            sharesSupply: maybe<bigint>(r.sharesSupply),
            lpYieldPerShare: maybe<bigint>(r.lpYieldPerShare),
          };
      }

      let remoteCutoff: number | undefined;
      let remoteChainTime: number | undefined;
      let remoteError: string | undefined;
      try {
        const a = arb();
        const [ab, cutoff] = await Promise.all([a.getBlock(), readOne<bigint>(a, read('sender', 'reportCutoff', [id]))]);
        remoteCutoff = Number(cutoff);
        remoteChainTime = Number(ab.timestamp);
      } catch (e) {
        remoteError = e instanceof Error ? e.message.split('\n')[0] : String(e);
      }

      const ytAddr = maybe<Address>(r.yt);
      return {
        reportId: id,
        reportHash: report.reportHash,
        claimHash: report.claimHash,
        reviewer: report.reviewer,
        resolver: report.resolver,
        adjudicator: report.adjudicator,
        lockTime,
        crossChainCutoff,
        resultDeadline: Number(report.resultDeadline),
        challengePeriod: Number(report.challengePeriod),
        maturity: series ? Number(need<bigint>(r.vaultMaturity, 'vault.maturity')) : Number(need<bigint>(r.maturity, 'ReportRegistry.maturity')),
        totals,
        locked: now >= lockTime,
        phase: derivePhase({ now, lockTime, crossChainCutoff, decision }),
        chainTime: now,
        blockNumber: block.number,
        decision,
        yt: series && ytAddr && ytAddr !== zeroAddress ? { address: ytAddr, totalSupply: maybe<bigint>(r.ytSupply) } : undefined,
        market,
        remoteCutoff,
        remoteChainTime,
        remoteError,
        series,
        rep: maybe<Address>(r.rep),
        principalAvailable: series ? maybe<bigint>(r.principalAvailable) : undefined,
        projectedPrincipal,
        feeClaimed: maybe<boolean>(r.feeClaimed),
        treasury: maybe<Address>(r.treasury),
        recoveryOperator: maybe<Address>(r.recoveryOperator),
        demoReport:
          id === bundle.report.reportId &&
          report.reportHash.toLowerCase() === bundle.report.reportHash.toLowerCase() &&
          report.claimHash.toLowerCase() === bundle.report.claimHash.toLowerCase(),
      } satisfies MarketView;
    },

    async getPosition(id, account) {
      const c = eth();
      const r = await readNamed(c, {
        series: read('vault', 'reportId'),
        yes: read('vault', 'positionOf', [account, true]),
        no: read('vault', 'positionOf', [account, false]),
        totalYes: read('vault', 'totalYes'),
        totalNo: read('vault', 'totalNo'),
        finalOutcome: read('vault', 'finalOutcome'),
        principalAvailable: read('vault', 'principalAvailable'),
        dusd: read('dusd', 'balanceOf', [account]),
        allowance: read('dusd', 'allowance', [account, V2.vault.address]),
        rep: read('rep', 'balanceOf', [account]),
        yt: read('yt', 'balanceOf', [account]),
        globalIndex: read('yt', 'globalIndex'),
        paidIndex: read('yt', 'paidIndex', [account]),
        unclaimed: read('yt', 'unclaimedUSDC', [account]),
        hookYt: read('yt', 'balanceOf', [V2.hook.address]),
        hookPaidIndex: read('yt', 'paidIndex', [V2.hook.address]),
        hookUnclaimed: read('yt', 'unclaimedUSDC', [V2.hook.address]),
        lpShares: read('lp', 'balanceOf', [account]),
        lpSupply: read('lp', 'totalSupply'),
        lpYieldPerShare: read('hook', 'lpYieldPerShare'),
        paidLPIndex: read('hook', 'paidLPIndex', [account]),
        unclaimedLP: read('hook', 'unclaimedLPYield', [account]),
      });
      const series = need<bigint>(r.series, 'vault.reportId') === id;
      const yes = series ? need<bigint>(r.yes, 'vault.positionOf') : 0n;
      const no = series ? need<bigint>(r.no, 'vault.positionOf') : 0n;
      const globalIndex = need<bigint>(r.globalIndex, 'yt.globalIndex');
      const yt = need<bigint>(r.yt, 'YT balance');
      const lpShares = need<bigint>(r.lpShares, 'RF-YLP balance');
      const lpSupply = need<bigint>(r.lpSupply, 'RF-YLP totalSupply');
      const hookYtPending = pendingYtYield({
        unclaimed: need<bigint>(r.hookUnclaimed, 'yt.unclaimedUSDC(hook)'),
        balance: need<bigint>(r.hookYt, 'yt.balanceOf(hook)'),
        globalIndex,
        paidIndex: need<bigint>(r.hookPaidIndex, 'yt.paidIndex(hook)'),
      });
      const outcome = series ? outcomeFromEnum(need<number>(r.finalOutcome, 'vault.finalOutcome')) : undefined;
      const totals = { yes: need<bigint>(r.totalYes, 'vault.totalYes'), no: need<bigint>(r.totalNo, 'vault.totalNo') };
      const principal = need<bigint>(r.principalAvailable, 'vault.principalAvailable');

      // Arbitrum Sepolia balances for the CCIP source; undefined (shown as unavailable) if any read fails.
      let remote: PositionView['remote'];
      try {
        const a = arb();
        const [rr, ethBalance] = await Promise.all([
          readNamed(a, { dusd: read('dusdArb', 'balanceOf', [account]), allowance: read('dusdArb', 'allowance', [account, V2.sender.address]) }),
          a.getBalance({ address: account }),
        ]);
        remote = { dusdBalance: need<bigint>(rr.dusd, 'dUSD balance'), allowance: need<bigint>(rr.allowance, 'dUSD allowance'), ethBalance };
      } catch {
        remote = undefined;
      }

      return {
        yes,
        no,
        yt,
        ytClaimable: pendingYtYield({ unclaimed: need<bigint>(r.unclaimed, 'yt.unclaimedUSDC'), balance: yt, globalIndex, paidIndex: need<bigint>(r.paidIndex, 'yt.paidIndex') }),
        lpShares,
        lpClaimable: pendingLpYield({
          unclaimed: need<bigint>(r.unclaimedLP, 'hook.unclaimedLPYield'),
          shares: lpShares,
          supply: lpSupply,
          lpYieldPerShare: need<bigint>(r.lpYieldPerShare, 'hook.lpYieldPerShare'),
          paidLPIndex: need<bigint>(r.paidLPIndex, 'hook.paidLPIndex'),
          hookYtPending,
        }),
        lpSupply,
        // Cross-chain messages are tracked from local storage + chain state by the CCIP views.
        pendingCcip: [],
        redeemable: outcome ? estimatePaid(outcome, 'yes', yes, totals, principal) + estimatePaid(outcome, 'no', no, totals, principal) : undefined,
        reputationBadge: false,
        repReceipt: need<bigint>(r.rep, 'REP balance'),
        dusdBalance: need<bigint>(r.dusd, 'dUSD balance'),
        allowance: need<bigint>(r.allowance, 'dUSD allowance'),
        remote,
        transferable: false,
      };
    },

    // ------------------------------------------------------------------------ stake (§B, §C)

    async stakeLocal(id, yes, amount, account, opts) {
      await assertSeries(id);
      await requireBalance(eth(), DUSD, account, amount, 'Ethereum Sepolia');
      return [
        ...(await approve(DUSD, account, V2.vault.address, 'the vault', amount, opts)),
        step(`Stake ${fmt(amount)} dUSD on ${side(yes)}`, write('vault', 'stake', [id, yes, amount, account, account])),
      ];
    },

    async depositRep(amount, account, opts) {
      await requireBalance(eth(), DUSD, account, amount, 'Ethereum Sepolia');
      return [
        ...(await approve(DUSD, account, V2.vault.address, 'the vault', amount, opts)),
        step(`Deposit ${fmt(amount)} dUSD for REP`, write('vault', 'deposit', [amount, account])),
      ];
    },

    async stakeFromRep(id, yes, amount, account) {
      await assertSeries(id);
      await requireBalance(eth(), REP_TOKEN, account, amount, 'Ethereum Sepolia');
      // stakeFromREP burns the caller's own REP: no REP approval.
      return [step(`Stake ${fmt(amount)} REP on ${side(yes)}`, write('vault', 'stakeFromREP', [id, yes, amount, account, account]))];
    },

    async withdrawRep(amount, account) {
      await requireBalance(eth(), REP_TOKEN, account, amount, 'Ethereum Sepolia');
      return [step(`Withdraw ${fmt(amount)} dUSD (burns REP)`, write('vault', 'withdraw', [amount]))];
    },

    async transferRep(to, amount, account) {
      await requireBalance(eth(), REP_TOKEN, account, amount, 'Ethereum Sepolia');
      return [step(`Transfer ${fmt(amount)} REP`, write('rep', 'transfer', [to, amount]))];
    },

    async transferYt(to, amount, account) {
      await requireBalance(eth(), YT, account, amount, 'Ethereum Sepolia');
      return [step(`Transfer ${fmt(amount)} YT`, write('yt', 'transfer', [to, amount]))];
    },

    async quoteStakeAndSell(amount) {
      return readOne<bigint>(eth(), read('stakeAndSell', 'quoteSell', [amount]));
    },

    async stakeAndSell(id, yes, amount, minUsdcOut, deadline, account, opts) {
      await assertSeries(id);
      await requireBalance(eth(), DUSD, account, amount, 'Ethereum Sepolia');
      const request = write('stakeAndSell', 'stakeAndSellYield', [yes, amount, minUsdcOut, BigInt(deadline)]);
      return [
        ...(await approve(DUSD, account, V2.stakeAndSell.address, 'the stake-and-sell router', amount, opts)),
        step(`Stake ${fmt(amount)} dUSD on ${side(yes)} and sell the new YT`, request, {
          prepare: async () => {
            const [quote, now] = await Promise.all([readOne<bigint>(eth(), read('stakeAndSell', 'quoteSell', [amount])), latestTime(eth())]);
            if (quote < minUsdcOut)
              throw new ProtocolRevert(`The YT sale now quotes ${fmt(quote)} dUSD, below your minimum of ${fmt(minUsdcOut)}. Nothing was sent; review the new quote.`);
            return write('stakeAndSell', 'stakeAndSellYield', [yes, amount, minUsdcOut, now + BigInt(SWAP_DEADLINE_SECONDS)]);
          },
        }),
      ];
    },

    // ------------------------------------------------------------------------ market (§D)

    async quoteYT(_id, dir, amount) {
      const [out, price] = await Promise.all([quoteHook(dir, amount), readOne<bigint>(eth(), read('hook', 'spotPriceWad')).catch(() => undefined)]);
      return { out, price };
    },

    async swapYT(_id, dir, amount, minOut, deadline, account, opts) {
      const input = dir === 'buy' ? DUSD : YT;
      await requireBalance(eth(), input, account, amount, 'Ethereum Sepolia');
      // dUSD/YT are sorted in the bundle's pool key; derive the direction instead of assuming it.
      const zeroForOne = zeroForOneFor(bundle.poolKey, dir, V2.dusd.address);
      const request = write('swapRouter', 'swapExactInput', [bundle.poolKey, zeroForOne, amount, minOut, BigInt(deadline)]);
      return [
        ...(await approve(input, account, V2.swapRouter.address, 'the YT swap router', amount, opts)),
        step(dir === 'buy' ? `Buy YT with ${fmt(amount)} dUSD` : `Sell ${fmt(amount)} YT`, request, {
          prepare: async () => {
            const [fresh, now] = await Promise.all([quoteHook(dir, amount), latestTime(eth())]);
            if (fresh < minOut)
              throw new ProtocolRevert(
                `The pool now quotes ${fmt(fresh)} ${dir === 'buy' ? 'YT' : 'dUSD'}, below your minimum of ${fmt(minOut)}. Nothing was sent; review the new quote.`,
              );
            return write('swapRouter', 'swapExactInput', [bundle.poolKey, zeroForOne, amount, minOut, now + BigInt(SWAP_DEADLINE_SECONDS)]);
          },
        }),
      ];
    },

    async addLiquidity(usdcAmount, ytAmount, minShares, account, opts) {
      const pool = await lpPool();
      const shares = lpSharesFor(usdcAmount, ytAmount, pool);
      if (shares === undefined)
        throw new ProtocolRevert("These amounts don't match the pool's reserves exactly (the hook requires dUSD and YT in the same share ratio). Use the paired amount.");
      if (shares < minShares) throw new ProtocolRevert(`This deposit mints ${fmt(shares)} RF-YLP, below your minimum of ${fmt(minShares)}.`);
      await requireBalance(eth(), DUSD, account, usdcAmount, 'Ethereum Sepolia');
      await requireBalance(eth(), YT, account, ytAmount, 'Ethereum Sepolia');
      const request = write('hook', 'addLiquidity', [usdcAmount, ytAmount, minShares]);
      return [
        ...(await approve(DUSD, account, V2.hook.address, 'the LP hook', usdcAmount, opts)),
        ...(await approve(YT, account, V2.hook.address, 'the LP hook', ytAmount, opts)),
        step(`Add ${fmt(usdcAmount)} dUSD + ${fmt(ytAmount)} YT liquidity`, request, {
          prepare: async () => {
            if (lpSharesFor(usdcAmount, ytAmount, await lpPool()) === undefined)
              throw new ProtocolRevert('The reserves moved since you entered the amounts, so the ratio no longer matches exactly. Nothing was sent; recompute the paired amount.');
            return request;
          },
        }),
      ];
    },

    async removeLiquidity(shares, minUsdc, minYt, account) {
      await requireBalance(eth(), LP_TOKEN, account, shares, 'Ethereum Sepolia');
      // The hook burns the caller's own shares: no approval.
      return [step(`Remove ${fmt(shares)} RF-YLP liquidity`, write('hook', 'removeLiquidity', [shares, minUsdc, minYt]))];
    },

    async claimLPYield(_id, account) {
      return [
        step('Claim LP yield', write('hook', 'claimLPYield'), {
          decode: (logs): TxEffect => (account ? { paid: dusdReceived(logs, V2.hook.address, account) } : {}),
        }),
      ];
    },

    async claimYield(_id, account) {
      return [step('Claim YT yield', write('yt', 'claimYield'), { decode: (logs): TxEffect => ({ paid: dusdReceived(logs, V2.yt.address, account) }) })];
    },

    async recentTrades() {
      const c = eth();
      const latest = await c.getBlockNumber();
      const window = 5n * 1_000n;
      const { logs } = await getLogsChunked(
        c,
        { address: V2.hook.address, topics: [[eventTopic('hook', 'Swapped'), eventTopic('hook', 'RateObserved')]] },
        { fromBlock: latest > window ? latest - window + 1n : 0n, toBlock: latest, maxChunks: 5 },
      );
      const rates = logsOf('hook', 'RateObserved', logs);
      return logsOf('hook', 'Swapped', logs)
        .map((s): Trade => {
          const rate = rates.find((x) => x.transactionHash === s.transactionHash && (x.logIndex ?? 0) > (s.logIndex ?? 0));
          return {
            usdcIn: s.args.usdcIn as boolean,
            amountIn: s.args.amountIn as bigint,
            amountOut: s.args.amountOut as bigint,
            rateWad: rate?.args.rateWad as bigint | undefined,
            timestamp: rate ? Number(rate.args.timestamp as bigint) : undefined,
            blockNumber: s.blockNumber ?? 0n,
            tx: s.transactionHash ?? ZERO32,
          };
        })
        .reverse();
    },

    async ytVolume() {
      const trades = await api.recentTrades!();
      return trades.reduce((sum, t) => sum + (t.usdcIn ? t.amountOut : t.amountIn), 0n);
    },

    // ------------------------------------------------------------------------ settlement (§F)

    async challenge(id, evidenceHash) {
      await assertSeries(id);
      if (!/^0x[0-9a-fA-F]{64}$/.test(evidenceHash) || evidenceHash === ZERO32) throw new ProtocolRevert('The evidence hash must be a nonzero bytes32.');
      return [step('Challenge the proposal', write('vault', 'challenge', [evidenceHash]))];
    },

    async finalize(id) {
      await assertSeries(id);
      return [step('Finalize', write('vault', 'finalize'))];
    },

    async redeem(id, yes, amount) {
      await assertSeries(id);
      return [step(`Claim ${side(yes)} principal`, write('vault', 'claimPrincipal', [yes, amount]))];
    },

    async propose(id, outcome: Outcome, evidenceHash) {
      await assertSeries(id);
      if (evidenceHash === ZERO32) throw new ProtocolRevert('The evidence hash must be nonzero.');
      return [step(`Propose ${outcome === 'void' ? 'Void' : side(outcome === 'yes')}`, write('vault', 'propose', [outcomeToEnum(outcome), evidenceHash]))];
    },

    async adjudicate(id, outcome: Outcome, evidenceHash) {
      await assertSeries(id);
      if (evidenceHash === ZERO32) throw new ProtocolRevert('The evidence hash must be nonzero.');
      return [step(`Adjudicate ${outcome === 'void' ? 'Void' : side(outcome === 'yes')}`, write('vault', 'adjudicate', [outcomeToEnum(outcome), evidenceHash]))];
    },

    async injectYield(id, amount, account, opts) {
      await assertSeries(id);
      await requireBalance(eth(), DUSD, account, amount, 'Ethereum Sepolia');
      return [
        ...(await approve(DUSD, account, V2.vault.address, 'the vault', amount, opts)),
        step(`Inject ${fmt(amount)} dUSD of simulated yield`, write('vault', 'injectYield', [amount])),
      ];
    },

    async claimFee(id) {
      await assertSeries(id);
      return [step('Claim the protocol fee (paid to the treasury)', write('vault', 'claimFee'))];
    },

    async recoverCcip(messageId, to) {
      return [step('Recover held dUSD', write('receiver', 'recover', [messageId, to]))];
    },

    // ------------------------------------------------------------------------ CCIP (§E)

    async quoteRemote(id, yes, amount, account, attempt?: RemoteAttempt) {
      const a = arb();
      const report = await readOne<Report>(eth(), read('registry', 'getReport', [id]));
      const att = attempt ?? newRemoteAttempt({ lockTime: Number(report.lockTime), recipient: account });
      const intent = buildIntentV2({ reportId: id, yes, sourceAccount: account, recipient: att.recipient, nonce: att.nonce, deadline: att.deadline, amount });
      const extraArgs = basicExtraArgsV3();
      const [block, cutoff, nonceUsed, fee] = await Promise.all([
        a.getBlock(),
        readOne<bigint>(a, read('sender', 'reportCutoff', [id])),
        readOne<boolean>(a, read('sender', 'usedNonce', [account, att.nonce])),
        readOne<bigint>(a, read('sender', 'quoteFee', [intent, amount, extraArgs])),
      ]);
      const registryCutoff = Number(report.crossChainCutoff);
      return {
        fee,
        deadline: Number(att.deadline),
        cutoff: cutoff > 0n ? Math.min(Number(cutoff), registryCutoff) : 0,
        intent,
        nonceUsed,
        remoteChainTime: Number(block.timestamp),
      };
    },

    async stakeRemote(id, yes, amount, account, attempt?: RemoteAttempt, opts?: ApproveOpts) {
      // The receiver credits only vault.reportId(); anything else would come back as REP.
      await assertSeries(id);
      const a = arb();
      await requireBalance(a, DUSD_ARB, account, amount, 'Arbitrum Sepolia');
      const report = await readOne<Report>(eth(), read('registry', 'getReport', [id]));
      const att = attempt ?? newRemoteAttempt({ lockTime: Number(report.lockTime), recipient: account });
      const extraArgs = basicExtraArgsV3();

      const send = async (): Promise<ContractCall> => {
        // Same intent as the quote: same deadline, and the same nonce unless it's been used meanwhile.
        const nonce = await unusedNonce((n) => readOne<boolean>(a, read('sender', 'usedNonce', [account, n])), att.nonce);
        const intent = buildIntentV2({ reportId: id, yes, sourceAccount: account, recipient: att.recipient, nonce, deadline: att.deadline, amount });
        const [block, cutoff] = await Promise.all([a.getBlock(), readOne<bigint>(a, read('sender', 'reportCutoff', [id]))]);
        const close = cutoff > 0n ? (cutoff < report.crossChainCutoff ? cutoff : report.crossChainCutoff) : 0n;
        if (close === 0n || block.timestamp >= close) throw new ProtocolRevert('Cross-chain stakes for this report are closed (past the cutoff). Nothing was sent.');
        const fee = await readOne<bigint>(a, read('sender', 'quoteFee', [intent, amount, extraArgs]));
        const value = withFeeBuffer(fee);
        const ethBalance = await a.getBalance({ address: account });
        if (ethBalance < value)
          throw new ProtocolRevert(
            `Not enough Arbitrum Sepolia ETH for the CCIP fee: this sends ${formatEther(value)} ETH (fee + 10%, the excess is refunded), you have ${formatEther(ethBalance)}.`,
          );
        return write('sender', 'stakeRemote', [intent, amount, extraArgs], value);
      };

      return [
        ...(await approve(DUSD_ARB, account, V2.sender.address, 'the CCIP sender', amount, opts, ARB_SEPOLIA_ID)),
        {
          label: `Requote the fee and send ${fmt(amount)} dUSD on ${side(yes)} via CCIP`,
          chainId: ARB_SEPOLIA_ID,
          prepare: send,
          decode: (logs): TxEffect => {
            const s = decodeSent(logs, V2.sender.address);
            return s ? { messageId: s.messageId, sent: { messageId: s.messageId, sourceAccount: s.sourceAccount, reportId: s.reportId, recipient: s.recipient, yes: s.yes, amount: s.amount } } : {};
          },
        },
      ];
    },

    trackCcip,
  };
  return api;
}

export const v2 = createV2({
  eth: sepoliaClient,
  arb: arbClient,
  fetchCcip: (messageId) => fetchCcipMessage(messageId, { base: env.ccipApiUrl }),
});

export const v2Flexible = createV2({
  eth: sepoliaClient,
  arb: arbClient,
  fetchCcip: (messageId) => fetchCcipMessage(messageId, { base: env.ccipApiUrl }),
  bundle: flexibleBundle,
});

export function v2ForBundle(bundle: V2Bundle) {
  return createV2({ eth: sepoliaClient, arb: arbClient, fetchCcip: (messageId) => fetchCcipMessage(messageId, { base: env.ccipApiUrl }), bundle });
}

/** Public bundle facts the UI may show (addresses, pool key, the delivered example message). */
export const V2_INFO = {
  version: defaultBundle.version,
  chainIds: defaultBundle.chainIds,
  sepolia: defaultBundle.sepolia,
  arbitrumSepolia: defaultBundle.arbitrumSepolia,
  poolKey: defaultBundle.poolKey,
  poolKeyHash: defaultBundle.poolKeyHash,
  reportId: defaultBundle.reportId,
  deployer: defaultBundle.report.reviewer,
  exampleCCIP: defaultBundle.exampleCCIP,
} as const;
export const V2_FLEX_INFO = {
  version: flexibleBundle.version,
  chainIds: flexibleBundle.chainIds,
  sepolia: flexibleBundle.sepolia,
  arbitrumSepolia: flexibleBundle.arbitrumSepolia,
  poolKey: flexibleBundle.poolKey,
  poolKeyHash: flexibleBundle.poolKeyHash,
  reportId: flexibleBundle.reportId,
  deployer: flexibleBundle.report.reviewer,
  exampleCCIP: flexibleBundle.exampleCCIP,
} as const;

export const isV2Example = (messageId: string) => messageId.toLowerCase() === defaultBundle.exampleCCIP.messageId.toLowerCase();

export const isSameAddress = (a?: string, b?: string) => !!a && !!b && /^0x[0-9a-fA-F]{40}$/.test(a) && /^0x[0-9a-fA-F]{40}$/.test(b) && isAddressEqual(a as Address, b as Address);
