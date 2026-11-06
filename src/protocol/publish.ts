import { encodeAbiParameters, hashMessage, isAddressEqual, keccak256, parseEventLogs, type Abi, type Address, type Hex } from 'viem';
import { getAccount, getPublicClient, signMessage, simulateContract, switchChain, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import flexibleAbi from '@/contracts/accelerated/ReportRegistry.json';
import { reportRegistryAbi, v2, v2Flexible } from '@/contracts/v2';
import { wagmiConfig } from '@/lib/wagmi';

export type RegistryKind = 'original' | 'flexible';
export interface PublicationInput {
  registry: RegistryKind;
  reportHash: Hex;
  claimHash: Hex;
  reviewer: Address;
  resolver: Address;
  adjudicator: Address;
  remoteCutoff: bigint;
  lockTime: bigint;
  maturity: bigint;
  resultDeadline: bigint;
  challengePeriod: bigint;
}

const reportTuple = { type: 'tuple', components: [
  { name: 'reportHash', type: 'bytes32' }, { name: 'claimHash', type: 'bytes32' },
  { name: 'reviewer', type: 'address' }, { name: 'resolver', type: 'address' },
  { name: 'adjudicator', type: 'address' }, { name: 'lockTime', type: 'uint64' },
  { name: 'crossChainCutoff', type: 'uint64' }, { name: 'resultDeadline', type: 'uint64' },
  { name: 'challengePeriod', type: 'uint64' },
] } as const;

export async function publishReport(input: PublicationInput): Promise<{ reportId: bigint; txHash: Hex }> {
  const account = getAccount(wagmiConfig).address;
  if (!account) throw new Error('Connect the publisher wallet first.');
  if (!isAddressEqual(account, input.reviewer)) throw new Error('The connected wallet must be the reviewer to sign this publication.');
  if (getAccount(wagmiConfig).chainId !== 11155111) await switchChain(wagmiConfig, { chainId: 11155111 });
  const client = getPublicClient(wagmiConfig, { chainId: 11155111 });
  if (!client) throw new Error('Ethereum Sepolia RPC unavailable.');
  const bundle = input.registry === 'flexible' ? v2Flexible : v2;
  const address = bundle.sepolia.ReportRegistry;
  const abi = (input.registry === 'flexible' ? flexibleAbi : reportRegistryAbi) as Abi;
  const publisher = await client.readContract({ address, abi, functionName: 'publisher' }) as Address;
  if (!isAddressEqual(account, publisher)) throw new Error(`Only the registry publisher (${publisher}) can publish this report.`);
  const now = (await client.getBlock()).timestamp;
  if (input.remoteCutoff <= now || input.remoteCutoff >= input.lockTime || input.lockTime >= input.maturity || input.maturity >= input.resultDeadline)
    throw new Error('Set cutoff < vote lock < maturity < result deadline, all in the future.');
  if (input.registry === 'original' && (input.maturity !== input.lockTime + 30n * 86400n || input.resultDeadline <= input.maturity))
    throw new Error('The original registry fixes maturity at 30 days after the vote lock.');
  if (input.challengePeriod <= 0n || input.maturity + input.challengePeriod >= input.resultDeadline)
    throw new Error('The result window must exceed the challenge period.');
  const report = {
    reportHash: input.reportHash, claimHash: input.claimHash, reviewer: input.reviewer,
    resolver: input.resolver, adjudicator: input.adjudicator, lockTime: input.lockTime,
    crossChainCutoff: input.remoteCutoff, resultDeadline: input.resultDeadline,
    challengePeriod: input.challengePeriod,
  };
  const nonce = (await client.readContract({ address, abi, functionName: 'reportCount' }) as bigint) + 1n;
  const expiry = now + 600n;
  const hashParams = input.registry === 'flexible'
    ? [{ type: 'uint256' }, { type: 'address' }, reportTuple, { type: 'uint64' }, { type: 'uint256' }, { type: 'uint64' }] as const
    : [{ type: 'uint256' }, { type: 'address' }, reportTuple, { type: 'uint256' }, { type: 'uint64' }] as const;
  const values = input.registry === 'flexible'
    ? [11155111n, address, report, input.maturity, nonce, expiry]
    : [11155111n, address, report, nonce, expiry];
  const rawHash = keccak256(encodeAbiParameters(hashParams as never, values as never));
  const expected = await client.readContract({ address, abi, functionName: 'approvalDigest', args: input.registry === 'flexible' ? [report, input.maturity, nonce, expiry] : [report, nonce, expiry] }) as Hex;
  if (hashMessage({ raw: rawHash }).toLowerCase() !== expected.toLowerCase()) throw new Error('The reviewer approval digest did not match the registry.');
  const signature = await signMessage(wagmiConfig, { account, message: { raw: rawHash } });
  const args = input.registry === 'flexible' ? [report, input.maturity, nonce, expiry, signature] : [report, nonce, expiry, signature];
  const call = { address, abi, functionName: 'publish', args, account, chainId: 11155111 };
  const { request } = await simulateContract(wagmiConfig, call as never);
  const gas = await client.estimateContractGas(call as never);
  const txHash = await writeContract(wagmiConfig, { ...request, gas: gas + gas / 5n } as never);
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: txHash, chainId: 11155111 });
  if (receipt.status !== 'success') throw new Error('Publication transaction reverted.');
  const events = parseEventLogs({ abi, logs: receipt.logs, eventName: 'Published', strict: true });
  const published = events.find(event => isAddressEqual(event.address, address));
  if (!published) throw new Error('Publication confirmed, but the Published event was not found. Check the transaction.');
  return { reportId: (published.args as { reportId: bigint }).reportId, txHash };
}
