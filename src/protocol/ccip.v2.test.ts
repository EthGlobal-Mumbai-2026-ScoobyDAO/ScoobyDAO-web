import { decodeAbiParameters, decodeFunctionData, encodeAbiParameters, encodeEventTopics, encodeFunctionData, getAddress, type Hex, type Log } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { v2 } from '@/contracts/v2';
import apiMessage from '@/test/recorded/ccip-example/api-message.json';
import destReceipt from '@/test/recorded/ccip-example/dest-receipt.json';
import sourceReceipt from '@/test/recorded/ccip-example/source-receipt.json';
import { DEPLOYER, liveWorld, ME, OTHER, setBalance, setPosition, v2For, type World } from '@/test/v2world';
import {
  basicExtraArgsV3,
  buildIntentV2,
  decodeReceiverOutcome,
  decodeSent,
  deriveV2CcipStatus,
  intentDeadline,
  newRemoteAttempt,
  STAKE_INTENT_V2_FIELDS,
  unusedNonce,
  withFeeBuffer,
} from './ccip';
import { fetchCcipMessage, parseCcipMessage } from './ccipApi';
import type { ContractCall } from './types';
import { V2 } from './v2contracts';

const U = 1_000_000n;
const EX = v2.exampleCCIP;
const rawLogs = (r: { logs: unknown[] }) => r.logs as unknown as Log[];

describe('StakeIntentV2: exactly the ABI tuple order', () => {
  const intent = buildIntentV2({ reportId: 1n, yes: true, sourceAccount: ME, recipient: OTHER, nonce: 42n, deadline: 1_794_210_239n, amount: 2n * U });

  it('fields in tuple order, protocolVersion 2, minAmount = amount, sourceAccount = sender', () => {
    expect(Object.keys(intent)).toEqual([...STAKE_INTENT_V2_FIELDS]);
    expect(intent).toMatchObject({ protocolVersion: 2, sourceAccount: ME, recipient: OTHER, minAmount: 2n * U });
  });

  it('encodes for quoteFee/stakeRemote and decodes as the receiver does (decodeIntent)', () => {
    const extraArgs = basicExtraArgsV3();
    // Encoded through the sender ABI, so the test fails if the tuple shape drifts.
    const data = encodeFunctionData({ abi: V2.sender.abi, functionName: 'quoteFee', args: [intent, 2n * U, extraArgs] });
    const decoded = decodeFunctionData({ abi: V2.sender.abi, data });
    expect(decoded.functionName).toBe('quoteFee');
    expect(decoded.args).toEqual([intent, 2n * U, extraArgs]);
    // The receiver abi.decodes the same tuple from the message data.
    const decodeIntent = (V2.receiver.abi as unknown as { name?: string; outputs?: never[] }[]).find((i) => i.name === 'decodeIntent')!;
    const encoded = encodeAbiParameters(decodeIntent.outputs!, [intent]);
    const [back] = decodeAbiParameters(decodeIntent.outputs!, encoded) as unknown as [Record<string, unknown>];
    expect(Object.values(back)).toEqual([2, 1n, true, ME, OTHER, 42n, 1_794_210_239n, 2n * U]);
  });

  it('one attempt keeps its nonce and deadline (last second before lock)', () => {
    const a = newRemoteAttempt({ lockTime: v2.report.lockTime, recipient: ME, nonce: 9n });
    expect(a).toEqual({ nonce: 9n, deadline: BigInt(v2.report.lockTime - 1), recipient: ME });
    expect(intentDeadline(100)).toBe(99n);
  });
});

describe('nonces (sender.usedNonce(account, nonce) on Arbitrum Sepolia)', () => {
  it('keeps the attempt nonce when unused, regenerates when used', async () => {
    const used = new Set([7n, 8n]);
    const gen = vi.fn().mockReturnValueOnce(8n).mockReturnValueOnce(11n);
    expect(await unusedNonce(async (n) => used.has(n), 5n, gen)).toBe(5n);
    expect(gen).not.toHaveBeenCalled();
    expect(await unusedNonce(async (n) => used.has(n), 7n, gen)).toBe(11n);
    await expect(unusedNonce(async () => true, 1n, () => 2n, 3)).rejects.toThrow(/unused CCIP nonce/);
  });
});

describe('remote stake plan (§E)', () => {
  function world(): World {
    const w = liveWorld();
    setBalance(w.dusdArb.balances, ME, 10n * U);
    w.ethBalances[ME.toLowerCase()] = 10n ** 16n;
    return w;
  }

  it('quote and send use the same intent; the fee is requoted right before sending with value = fee + 10%', async () => {
    const w = world();
    const p = v2For(w).protocol;
    const attempt = newRemoteAttempt({ lockTime: v2.report.lockTime, recipient: OTHER, nonce: 77n });
    const quote = await p.quoteRemote!(1n, false, 2n * U, ME, attempt);
    expect(quote).toMatchObject({ fee: w.sender.fee, nonceUsed: false, cutoff: v2.report.crossChainCutoff, deadline: v2.report.lockTime - 1 });
    const plan = await p.stakeRemote!(1n, false, 2n * U, ME, attempt);
    expect(plan.map((s) => `${s.chainId}:${s.request?.functionName ?? 'prepare'}`)).toEqual(['421614:approve', '421614:prepare']);
    expect(plan[0].request).toMatchObject({ address: V2.dusdArb.address, args: [V2.sender.address, 2n * U] });
    w.sender.fee = 800_000_000_000_000n; // the fee moved since the quote
    const send = (await plan[1].prepare!()) as ContractCall;
    expect(send).toMatchObject({ address: V2.sender.address, functionName: 'stakeRemote', value: withFeeBuffer(800_000_000_000_000n) });
    expect(send.args).toEqual([w.sender.quoted.at(-1), 2n * U, basicExtraArgsV3()]);
    expect(send.args![0]).toEqual(buildIntentV2({ reportId: 1n, yes: false, sourceAccount: ME, recipient: OTHER, nonce: 77n, deadline: attempt.deadline, amount: 2n * U }));
  });

  it('a nonce used meanwhile is replaced before sending (same deadline and recipient)', async () => {
    const w = world();
    const p = v2For(w).protocol;
    const attempt = newRemoteAttempt({ lockTime: v2.report.lockTime, recipient: ME, nonce: 5n });
    const plan = await p.stakeRemote!(1n, true, U, ME, attempt);
    w.sender.used[`${ME.toLowerCase()}:5`] = true;
    const send = (await plan[1].prepare!()) as ContractCall;
    const intent = send.args![0] as ReturnType<typeof buildIntentV2>;
    expect(intent.nonce).not.toBe(5n);
    expect(intent).toMatchObject({ deadline: attempt.deadline, recipient: ME, sourceAccount: ME });
  });

  it('closed at the cutoff, short of ETH, short of dUSD, or for a report without a vault', async () => {
    const w = world();
    const p = v2For(w).protocol;
    const plan = await p.stakeRemote!(1n, true, U, ME, newRemoteAttempt({ lockTime: v2.report.lockTime, recipient: ME, nonce: 1n }));
    w.arbNow = BigInt(v2.report.crossChainCutoff);
    await expect(plan[1].prepare!()).rejects.toThrow(/Cross-chain stakes for this report are closed/);
    w.arbNow = BigInt(v2.report.crossChainCutoff) - 1n;
    w.ethBalances[ME.toLowerCase()] = 1n;
    await expect(plan[1].prepare!()).rejects.toThrow(/Not enough Arbitrum Sepolia ETH/);
    await expect(p.stakeRemote!(1n, true, 50n * U, ME)).rejects.toThrow(/Insufficient dUSD on Arbitrum Sepolia/);
    await expect(p.stakeRemote!(2n, true, U, ME)).rejects.toThrow(/No market is deployed for report #2/);
  });

  it('decodes Sent from the recorded source receipt (wallet writes return no value)', async () => {
    const plan = await v2For(world()).protocol.stakeRemote!(1n, false, U, ME);
    const effect = plan[1].decode!(rawLogs(sourceReceipt));
    expect(effect).toEqual({
      messageId: EX.messageId,
      sent: { messageId: EX.messageId, sourceAccount: DEPLOYER, reportId: 1n, recipient: DEPLOYER, yes: false, amount: 5n * U },
    });
    expect(decodeSent(rawLogs(sourceReceipt), V2.sender.address, EX.messageId)?.tx).toBe(EX.sourceTx);
    expect(decodeSent(rawLogs(sourceReceipt), getAddress(V2.vault.address))).toBeUndefined(); // only the sender's own event
  });
});

describe('tracker states (§3.6)', () => {
  it('derives each state; delivery alone is never a vote', () => {
    const base = { sourceConfirmed: true, delivered: false };
    expect(deriveV2CcipStatus({ ...base, api: 'SENT' })).toBe('sent');
    expect(deriveV2CcipStatus({ ...base, api: 'unavailable' })).toBe('sent');
    expect(deriveV2CcipStatus({ ...base, api: 'VERIFYING' })).toBe('in_transit');
    expect(deriveV2CcipStatus({ ...base, api: 'SUCCESS' })).toBe('in_transit'); // receiver not read yet
    expect(deriveV2CcipStatus({ ...base, api: 'FAILED' })).toBe('failed');
    expect(deriveV2CcipStatus({ ...base, delivered: true, api: 'SUCCESS' })).toBe('delivered');
    expect(deriveV2CcipStatus({ ...base, delivered: true, outcome: 'credited' })).toBe('credited');
    expect(deriveV2CcipStatus({ ...base, delivered: true, outcome: 'deferred' })).toBe('deferred_as_rep');
    expect(deriveV2CcipStatus({ ...base, delivered: true, outcome: 'held', recoverable: 3n })).toBe('held');
    expect(deriveV2CcipStatus({ ...base, delivered: true, recoverable: 3n })).toBe('held');
    expect(deriveV2CcipStatus({ ...base, delivered: true, outcome: 'held', recoverable: 0n })).toBe('recovered');
    expect(deriveV2CcipStatus({ ...base, delivered: true, recoverySourceAccount: ME, recoverable: 0n })).toBe('recovered');
  });

  it('decodes Credited for the example from the recorded destination receipt', () => {
    expect(decodeReceiverOutcome(rawLogs(destReceipt), V2.receiver.address, EX.messageId).outcome).toEqual({
      kind: 'credited',
      reportId: 1n,
      recipient: DEPLOYER,
      amount: 5n * U,
      tx: EX.destinationTx,
    });
    expect(decodeReceiverOutcome(rawLogs(destReceipt), V2.receiver.address, `0x${'00'.repeat(32)}`).outcome).toBeUndefined();
  });

  function exampleWorld() {
    const w = liveWorld();
    w.receipts.arb[EX.sourceTx] = sourceReceipt;
    w.receipts.eth[EX.destinationTx] = destReceipt;
    w.receiver.delivered[EX.messageId.toLowerCase()] = true;
    setPosition(w, DEPLOYER, false, 15n * U);
    setBalance(w.yt.balances, DEPLOYER, 5_000_232n);
    return w;
  }

  it('exampleCCIP (recorded API + receipts): credited, then "Voted" with the refreshed position and YT', async () => {
    const w = exampleWorld();
    w.ccipApi = { ok: true, message: parseCcipMessage(apiMessage) };
    const s = await v2For(w).protocol.trackCcip(EX.messageId);
    expect(s).toMatchObject({
      status: 'credited',
      ccipApiStatus: 'SUCCESS',
      delivered: true,
      reportId: 1n,
      yes: false,
      amount: 5n * U,
      recipient: DEPLOYER,
      sourceAccount: DEPLOYER,
      sourceTx: EX.sourceTx,
      destTx: EX.destinationTx,
      refreshed: { position: 15n * U, yt: 5_000_232n, blockNumber: w.blockNumber },
    });
  });

  it('exampleCCIP without the API (CORS/network): bundle hashes and chain state still prove the credit', async () => {
    const w = exampleWorld();
    w.ccipApi = { ok: false, error: 'Failed to fetch' };
    const s = await v2For(w).protocol.trackCcip(EX.messageId);
    expect(s).toMatchObject({ status: 'credited', ccipApiUnavailable: true, destTx: EX.destinationTx });
  });

  it('a late delivery found by a bounded log scan: DeferredAsREP for the source payer, with their REP balance', async () => {
    const w = liveWorld();
    const id = `0x${'de'.repeat(32)}` as Hex;
    w.receiver.delivered[id] = true;
    setBalance(w.rep.balances, ME, 2n * U);
    w.ccipApi = { ok: false, error: 'Failed to fetch' };
    w.logs.push({
      address: V2.receiver.address.toLowerCase(),
      topics: encodeEventTopics({ abi: V2.receiver.abi, eventName: 'DeferredAsREP', args: { messageId: id, sourceAccount: ME } }) as string[],
      data: encodeAbiParameters([{ type: 'uint256' }], [2n * U]),
      blockNumber: `0x${(w.blockNumber - 300n).toString(16)}`,
      transactionHash: `0x${'77'.repeat(32)}`,
      logIndex: '0x0',
      blockHash: `0x${'00'.repeat(32)}`,
      transactionIndex: '0x0',
      removed: false,
    });
    const s = await v2For(w).protocol.trackCcip(id);
    expect(s).toMatchObject({ status: 'deferred_as_rep', sourceAccount: ME, amount: 2n * U, repBalance: 2n * U, destTx: `0x${'77'.repeat(32)}` });
  });

  it('held: recoverable funds and who may recover them; recovered once recoverable is back to 0', async () => {
    const w = liveWorld();
    const id = `0x${'ab'.repeat(32)}` as Hex;
    w.receiver.delivered[id] = true;
    w.receiver.recoverable[id] = 3n * U;
    w.receiver.recoverySource[id] = ME;
    w.ccipApi = { ok: true, message: { status: 'SUCCESS' } };
    const p = v2For(w).protocol;
    expect(await p.trackCcip(id)).toMatchObject({ status: 'held', recoverable: 3n * U, recoveryRecipient: ME, recoveryOperator: DEPLOYER });
    w.receiver.recoverable[id] = 0n;
    expect((await p.trackCcip(id))?.status).toBe('recovered');
  });

  it('failed on the CCIP side, in transit, and unknown', async () => {
    const w = liveWorld();
    const id = `0x${'cc'.repeat(32)}` as Hex;
    const p = v2For(w).protocol;
    w.ccipApi = { ok: true, message: { status: 'FAILED', readyForManualExecution: true } };
    expect(await p.trackCcip(id)).toMatchObject({ status: 'failed', delivered: false, readyForManualExecution: true });
    w.ccipApi = { ok: true, message: { status: 'VERIFYING' } };
    expect((await p.trackCcip(id))?.status).toBe('in_transit');
    w.ccipApi = { ok: true };
    expect(await p.trackCcip(id)).toBeUndefined();
  });
});

describe('CCIP API client', () => {
  it('parses the recorded message and ignores unknown fields', () => {
    expect(parseCcipMessage(apiMessage)).toEqual({
      status: 'SUCCESS',
      sendTransactionHash: EX.sourceTx,
      receiptTransactionHash: EX.destinationTx,
      receiptBlockNumber: 12_075_381,
      readyForManualExecution: false,
      sendTimestamp: '2026-11-06T08:01:31.000Z',
    });
    expect(parseCcipMessage({ status: '<script>' })).toBeUndefined();
  });

  it('404 = not indexed yet; network/CORS failure = unavailable (explorer link only)', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify(apiMessage), { status: 200 }));
    expect(await fetchCcipMessage(EX.messageId, { base: 'https://api.ccip.chain.link', fetchFn: ok as never })).toMatchObject({ ok: true, message: { status: 'SUCCESS' } });
    expect(ok).toHaveBeenCalledWith(`https://api.ccip.chain.link/v2/messages/${EX.messageId}`, expect.objectContaining({ credentials: 'omit' }));
    const missing = vi.fn(async () => new Response('{"error":"NOT_FOUND"}', { status: 404 }));
    expect(await fetchCcipMessage(EX.messageId, { base: 'x', fetchFn: missing as never })).toEqual({ ok: true });
    const blocked = vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')));
    expect(await fetchCcipMessage(EX.messageId, { base: 'x', fetchFn: blocked as never })).toEqual({ ok: false, error: 'Failed to fetch' });
  });
});
