import {
  createPublicClient,
  custom,
  decodeFunctionData,
  encodeErrorResult,
  encodeFunctionResult,
  multicall3Abi,
  numberToHex,
  type Abi,
  type Chain,
  type Hex,
  type PublicClient,
} from 'viem';

// A mocked EIP-1193 transport for viem public clients in tests: contract reads (direct eth_call and
// Multicall3 aggregate3), blocks, balances, code, recorded receipts and bounded eth_getLogs. Calls
// are decoded and results encoded with the real ABIs, so a wrong function name or argument shape
// fails just like it would against a node. Nothing touches the network.

export class MockRevert extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

type Handler = (args: readonly unknown[]) => unknown;
export interface MockContract {
  abi: Abi | readonly unknown[];
  fns: Record<string, Handler>;
}

export interface MockChainState {
  chain: Chain;
  block: { number: bigint; timestamp: bigint };
  contracts: Record<string, MockContract>;
  balances?: Record<string, bigint>;
  code?: Record<string, Hex>;
  /** Raw JSON-RPC receipts by lowercase tx hash. */
  receipts?: Record<string, unknown>;
  /** Raw JSON-RPC logs served by eth_getLogs (filtered by address, topics and block range). */
  logs?: { address: string; topics: string[]; blockNumber: string; [k: string]: unknown }[];
  /** Every decoded contract call, for assertions. */
  calls?: { to: string; fn: string; args: readonly unknown[] }[];
  /** Every JSON-RPC method seen. */
  methods?: string[];
}

const ERROR_ABI = [{ type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] }] as const;
const revertData = (reason: string) => encodeErrorResult({ abi: ERROR_ABI, errorName: 'Error', args: [reason] });

function callOne(s: MockChainState, to: string, data: Hex): Hex {
  const c = s.contracts[to.toLowerCase()];
  if (!c) throw new MockRevert(`no contract at ${to}`);
  const { functionName, args } = decodeFunctionData({ abi: c.abi as Abi, data });
  s.calls?.push({ to: to.toLowerCase(), fn: functionName, args: args ?? [] });
  const h = c.fns[functionName];
  if (!h) throw new Error(`mockRpc: ${to}.${functionName} is not stubbed`);
  return encodeFunctionResult({ abi: c.abi as Abi, functionName, result: h(args ?? []) } as never);
}

function block(s: MockChainState) {
  const z32 = `0x${'00'.repeat(32)}`;
  return {
    number: numberToHex(s.block.number),
    hash: `0x${s.block.number.toString(16).padStart(64, '0')}`,
    parentHash: z32,
    timestamp: numberToHex(s.block.timestamp),
    nonce: '0x0000000000000000',
    difficulty: '0x0',
    totalDifficulty: '0x0',
    gasLimit: '0x1c9c380',
    gasUsed: '0x0',
    baseFeePerGas: '0x1',
    miner: `0x${'00'.repeat(20)}`,
    extraData: '0x',
    logsBloom: `0x${'00'.repeat(256)}`,
    mixHash: z32,
    receiptsRoot: z32,
    sha3Uncles: z32,
    stateRoot: z32,
    transactionsRoot: z32,
    size: '0x1',
    transactions: [],
    uncles: [],
  };
}

function topicMatches(filter: unknown, topic: string | undefined) {
  if (filter === null || filter === undefined) return true;
  if (Array.isArray(filter)) return filter.some((f) => typeof f === 'string' && f.toLowerCase() === topic?.toLowerCase());
  return typeof filter === 'string' && filter.toLowerCase() === topic?.toLowerCase();
}

export function mockClient(s: MockChainState): PublicClient {
  s.calls ??= [];
  s.methods ??= [];
  const transport = custom({
    async request({ method, params }: { method: string; params?: unknown }) {
      s.methods!.push(method);
      const p = (params ?? []) as unknown[];
      switch (method) {
        case 'eth_chainId':
          return numberToHex(s.chain.id);
        case 'eth_blockNumber':
          return numberToHex(s.block.number);
        case 'eth_getBlockByNumber':
          return block(s);
        case 'eth_getBalance':
          return numberToHex(s.balances?.[(p[0] as string).toLowerCase()] ?? 0n);
        case 'eth_getCode':
          return s.code?.[(p[0] as string).toLowerCase()] ?? '0x';
        case 'eth_getTransactionReceipt':
          return s.receipts?.[(p[0] as string).toLowerCase()] ?? null;
        case 'eth_getLogs': {
          const f = p[0] as { address?: string; topics?: unknown[]; fromBlock: string; toBlock: string };
          const from = BigInt(f.fromBlock);
          const to = BigInt(f.toBlock);
          return (s.logs ?? []).filter(
            (l) =>
              (!f.address || l.address.toLowerCase() === f.address.toLowerCase()) &&
              BigInt(l.blockNumber) >= from &&
              BigInt(l.blockNumber) <= to &&
              (f.topics ?? []).every((t, i) => topicMatches(t, l.topics[i])),
          );
        }
        case 'eth_call': {
          const { to, data } = p[0] as { to: string; data: Hex };
          const multicall3 = s.chain.contracts?.multicall3?.address;
          try {
            if (multicall3 && to.toLowerCase() === multicall3.toLowerCase()) {
              const { args } = decodeFunctionData({ abi: multicall3Abi, data });
              const calls = args[0] as readonly { target: string; allowFailure: boolean; callData: Hex }[];
              const results = calls.map((c) => {
                try {
                  return { success: true, returnData: callOne(s, c.target, c.callData) };
                } catch (e) {
                  if (e instanceof MockRevert) return { success: false, returnData: revertData(e.reason) };
                  throw e;
                }
              });
              return encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: results });
            }
            return callOne(s, to, data);
          } catch (e) {
            if (e instanceof MockRevert) throw { code: 3, message: `execution reverted: ${e.reason}`, data: revertData(e.reason) };
            throw e;
          }
        }
        default:
          throw new Error(`mockRpc: ${method} not supported`);
      }
    },
  });
  return createPublicClient({ chain: s.chain, transport }) as PublicClient;
}
