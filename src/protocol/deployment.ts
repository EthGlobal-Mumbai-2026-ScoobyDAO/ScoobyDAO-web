import { encodeAbiParameters, isAddressEqual, keccak256, type Address, type Hex } from 'viem';
import { allContracts, ARB_SEPOLIA_ID, SEPOLIA_ID, v2, v2Flexible, type V2ChainId, type V2Bundle } from '@/contracts/v2';
import { clientFor, multicallLoose, type ReadCall, type ReadResult } from './clients';
import { read } from './v2contracts';
import { makeV2Handles } from './v2contracts';
import { migrateStorageKey } from '@/lib/storageKeys';

// Once-per-session check that the chain matches the handoff bundle before any V2 write is allowed:
// code at every bundle address, and the wiring between vault, hook, routers, receiver and sender.

export interface DeploymentCheckItem {
  id: string;
  label: string;
  chainId: V2ChainId;
  ok: boolean;
  /** Present on failure: what was read (or why the read failed) and what the bundle expects. */
  actual?: string;
  expected?: string;
}

export interface DeploymentReport {
  ok: boolean;
  bundle: string;
  checkedAt: number;
  checks: DeploymentCheckItem[];
}

/** Reads the check needs; production wraps viem clients, tests pass a mocked multicall. */
export interface DeploymentReads {
  code(chainId: V2ChainId, address: Address): Promise<Hex | undefined>;
  multicall(chainId: V2ChainId, calls: ReadCall[]): Promise<ReadResult[]>;
}

const S = v2.sepolia;
const A = v2.arbitrumSepolia;

type Expect = { id: string; label: string; chainId: V2ChainId; call: ReadCall; expect: Address | bigint | boolean | Hex };

/** The wiring the bundle promises, as (call → expected value) pairs. */
export const WIRING: Expect[] = [
  { id: 'vault.reportId', label: 'vault.reportId() = bundle reportId', chainId: SEPOLIA_ID, call: read('vault', 'reportId'), expect: v2.reportId },
  { id: 'vault.yt', label: 'vault.yt() = StakerYieldToken', chainId: SEPOLIA_ID, call: read('vault', 'yt'), expect: S.StakerYieldToken },
  { id: 'vault.rep', label: 'vault.rep() = StakeReceiptREP', chainId: SEPOLIA_ID, call: read('vault', 'rep'), expect: S.StakeReceiptREP },
  { id: 'vault.registry', label: 'vault.registry() = ReportRegistry (V2)', chainId: SEPOLIA_ID, call: read('vault', 'registry'), expect: S.ReportRegistry },
  { id: 'vault.usdc', label: 'vault.usdc() = DemoUSD', chainId: SEPOLIA_ID, call: read('vault', 'usdc'), expect: S.DemoUSD },
  { id: 'hook.poolKeyHash', label: 'hook.poolKeyHash() = bundle poolKeyHash', chainId: SEPOLIA_ID, call: read('hook', 'poolKeyHash'), expect: v2.poolKeyHash },
  { id: 'hook.shares', label: 'hook.shares() = YieldLPShare', chainId: SEPOLIA_ID, call: read('hook', 'shares'), expect: S.YieldLPShare },
  { id: 'hook.yt', label: 'hook.yt() = StakerYieldToken', chainId: SEPOLIA_ID, call: read('hook', 'yt'), expect: S.StakerYieldToken },
  { id: 'hook.usdc', label: 'hook.usdc() = DemoUSD', chainId: SEPOLIA_ID, call: read('hook', 'usdc'), expect: S.DemoUSD },
  { id: 'hook.manager', label: 'hook.manager() = PoolManager', chainId: SEPOLIA_ID, call: read('hook', 'manager'), expect: S.PoolManager },
  { id: 'swapRouter.manager', label: 'YieldSwapRouter.manager() = PoolManager', chainId: SEPOLIA_ID, call: read('swapRouter', 'manager'), expect: S.PoolManager },
  { id: 'stakeAndSell.vault', label: 'stakeAndSell.vault() = vault', chainId: SEPOLIA_ID, call: read('stakeAndSell', 'vault'), expect: S.RiskFiStakeVaultV2 },
  { id: 'stakeAndSell.hook', label: 'stakeAndSell.hook() = YieldCurveHookV2', chainId: SEPOLIA_ID, call: read('stakeAndSell', 'hook'), expect: S.YieldCurveHookV2 },
  { id: 'stakeAndSell.swapRouter', label: 'stakeAndSell.swapRouter() = YieldSwapRouter', chainId: SEPOLIA_ID, call: read('stakeAndSell', 'swapRouter'), expect: S.YieldSwapRouter },
  { id: 'stakeAndSell.yt', label: 'stakeAndSell.yt() = StakerYieldToken', chainId: SEPOLIA_ID, call: read('stakeAndSell', 'yt'), expect: S.StakerYieldToken },
  { id: 'stakeAndSell.usdc', label: 'stakeAndSell.usdc() = DemoUSD', chainId: SEPOLIA_ID, call: read('stakeAndSell', 'usdc'), expect: S.DemoUSD },
  {
    id: 'stakeAndSell.ytIsCurrency0',
    label: 'stakeAndSell.ytIsCurrency0() matches the sorted pool key',
    chainId: SEPOLIA_ID,
    call: read('stakeAndSell', 'ytIsCurrency0'),
    expect: isAddressEqual(v2.poolKey.currency0, S.StakerYieldToken),
  },
  { id: 'receiver.vault', label: 'receiver.vault() = vault', chainId: SEPOLIA_ID, call: read('receiver', 'vault'), expect: S.RiskFiStakeVaultV2 },
  {
    id: 'receiver.sourceSender',
    label: 'receiver.sourceSender() = CCIPStakeSenderV2 (Arbitrum Sepolia)',
    chainId: SEPOLIA_ID,
    call: read('receiver', 'sourceSender'),
    expect: A.CCIPStakeSenderV2,
  },
  {
    id: 'receiver.sourceSelector',
    label: 'receiver.sourceSelector() = Arbitrum Sepolia selector',
    chainId: SEPOLIA_ID,
    call: read('receiver', 'sourceSelector'),
    expect: v2.selectors.arbitrumSepolia,
  },
  { id: 'receiver.usdc', label: 'receiver.usdc() = DemoUSD', chainId: SEPOLIA_ID, call: read('receiver', 'usdc'), expect: S.DemoUSD },
  {
    id: 'sender.destinationReceiver',
    label: 'sender.destinationReceiver() = CCIPStakeReceiverV2 (Ethereum Sepolia)',
    chainId: ARB_SEPOLIA_ID,
    call: read('sender', 'destinationReceiver'),
    expect: S.CCIPStakeReceiverV2,
  },
  {
    id: 'sender.destinationSelector',
    label: 'sender.destinationSelector() = Ethereum Sepolia selector',
    chainId: ARB_SEPOLIA_ID,
    call: read('sender', 'destinationSelector'),
    expect: v2.selectors.sepolia,
  },
  { id: 'sender.sourceUSD', label: 'sender.sourceUSD() = DemoUSD (Arbitrum Sepolia)', chainId: ARB_SEPOLIA_ID, call: read('sender', 'sourceUSD'), expect: A.DemoUSD },
];

const POOL_KEY_PARAMS = [
  {
    type: 'tuple',
    components: [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' },
    ],
  },
] as const;

/** keccak256(abi.encode(PoolKey)), exactly as YieldCurveHookV2.configurePool stores it. */
export const poolKeyHashOf = (key: typeof v2.poolKey): Hex => keccak256(encodeAbiParameters(POOL_KEY_PARAMS, [key]));

const show = (v: unknown) => (typeof v === 'bigint' ? v.toString() : String(v));

function same(actual: unknown, expected: Expect['expect']): boolean {
  if (typeof expected === 'bigint') return typeof actual === 'bigint' && actual === expected;
  if (typeof expected === 'boolean') return actual === expected;
  if (typeof actual !== 'string') return false;
  return expected.length === 42 ? /^0x[0-9a-fA-F]{40}$/.test(actual) && isAddressEqual(actual as Address, expected as Address) : actual.toLowerCase() === expected.toLowerCase();
}

/** Bundle-internal consistency (no RPC): the pool key hashes to the bundle hash and is sorted. */
export function staticChecks(): DeploymentCheckItem[] {
  const k = v2.poolKey;
  const sorted = BigInt(k.currency0) < BigInt(k.currency1);
  const tokens = [k.currency0, k.currency1].map((x) => x.toLowerCase()).sort().join();
  const expectedTokens = [S.DemoUSD, S.StakerYieldToken].map((x) => x.toLowerCase()).sort().join();
  return [
    { id: 'poolKey.hash', label: 'keccak256(abi.encode(poolKey)) = bundle poolKeyHash', chainId: SEPOLIA_ID, ok: poolKeyHashOf(k) === v2.poolKeyHash.toLowerCase(), actual: poolKeyHashOf(k), expected: v2.poolKeyHash },
    {
      id: 'poolKey.shape',
      label: 'pool key: sorted dUSD/YT, fee 0, tick spacing 1, hooks = YieldCurveHookV2',
      chainId: SEPOLIA_ID,
      ok: sorted && tokens === expectedTokens && k.fee === 0 && k.tickSpacing === 1 && isAddressEqual(k.hooks, S.YieldCurveHookV2),
    },
    {
      id: 'selectors',
      label: 'sender destination selector in the bundle = Ethereum Sepolia selector',
      chainId: ARB_SEPOLIA_ID,
      ok: v2.selectors.senderDestination === v2.selectors.sepolia,
    },
  ];
}

export async function runDeploymentCheck(reads: DeploymentReads, now = Date.now()): Promise<DeploymentReport> {
  const contracts = allContracts();
  const codes = await Promise.all(contracts.map((x) => reads.code(x.chainId, x.address).catch((e: unknown) => e as Error)));
  const checks: DeploymentCheckItem[] = contracts.map((x, i) => {
    const code = codes[i];
    const has = typeof code === 'string' && code !== '0x' && code.length > 2;
    return {
      id: `code.${x.chainId}.${x.name}`,
      label: `${x.name} has code on ${x.chainId === SEPOLIA_ID ? 'Ethereum Sepolia' : 'Arbitrum Sepolia'}`,
      chainId: x.chainId,
      ok: has,
      actual: has ? undefined : code instanceof Error ? code.message : 'no code at this address',
      expected: has ? undefined : x.address,
    };
  });

  for (const chainId of [SEPOLIA_ID, ARB_SEPOLIA_ID] as const) {
    const rows = WIRING.filter((w) => w.chainId === chainId);
    const results = await reads.multicall(chainId, rows.map((w) => w.call));
    rows.forEach((w, i) => {
      const r = results[i];
      const ok = !!r && r.ok && same(r.result, w.expect);
      checks.push({
        id: w.id,
        label: w.label,
        chainId,
        ok,
        actual: ok ? undefined : !r ? 'no result' : r.ok ? show(r.result) : `read failed: ${r.error}`,
        expected: ok ? undefined : show(w.expect),
      });
    });
  }

  checks.push(...staticChecks());
  return { ok: checks.every((x) => x.ok), bundle: v2.version, checkedAt: now, checks };
}

/** Production reads: eth_getCode and Multicall3 through the public clients for each chain. */
export const liveDeploymentReads = (): DeploymentReads => ({
  code: (chainId, address) => clientFor(chainId).getCode({ address }),
  multicall: (chainId, calls) => multicallLoose(clientFor(chainId), calls),
});

// A passing report is remembered for the browser session (per bundle version), so the check runs
// once per session. Failures are never cached: a reload checks again.
const CACHE_KEY = 'scoobydao:v2-deployment';

function cachedReport(): DeploymentReport | undefined {
  migrateStorageKey('session', 'unmasked:v2-deployment', CACHE_KEY);
  try {
    const r = JSON.parse(window.sessionStorage.getItem(CACHE_KEY) ?? 'null') as DeploymentReport | null;
    return r && r.ok && r.bundle === v2.version ? r : undefined;
  } catch {
    return undefined;
  }
}

function remember(r: DeploymentReport): DeploymentReport {
  if (r.ok)
    try {
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(r));
    } catch {
      /* storage unavailable: the check simply runs again next load */
    }
  return r;
}

/** Shared by useDeploymentCheck() and the write gate in TxProvider (which awaits it before sending). */
export const deploymentQuery = {
  queryKey: ['deployment', v2.version] as const,
  queryFn: async (): Promise<DeploymentReport> => cachedReport() ?? remember(await runDeploymentCheck(liveDeploymentReads())),
  staleTime: Infinity,
  gcTime: Infinity,
  retry: 1,
};

/** The accelerated deployment has different addresses and a separate registry. */
export const flexibleDeploymentQuery = {
  queryKey: ['deployment', v2Flexible.version] as const,
  queryFn: async (): Promise<DeploymentReport> => {
    const eth = clientFor(SEPOLIA_ID);
    const arb = clientFor(ARB_SEPOLIA_ID);
    const h = makeV2Handles(v2Flexible);
    const checks: DeploymentCheckItem[] = [];
    for (const [name, contract] of Object.entries(h)) {
      const client = contract.chainId === SEPOLIA_ID ? eth : arb;
      const code = await client.getCode({ address: contract.address }).catch(() => undefined);
      checks.push({ id: `code.${name}`, label: `${name} has deployed code`, chainId: contract.chainId, ok: !!code && code !== '0x' });
    }
    const readEqual = async (id: string, name: keyof typeof h, fn: string, expected: string | bigint) => {
      const contract = h[name];
      const client = contract.chainId === SEPOLIA_ID ? eth : arb;
      try {
        const actual = await client.readContract({ address: contract.address, abi: contract.abi, functionName: fn } as never);
        const ok = String(actual).toLowerCase() === String(expected).toLowerCase();
        checks.push({ id, label: id, chainId: contract.chainId, ok, actual: ok ? undefined : String(actual), expected: ok ? undefined : String(expected) });
      } catch (e) {
        checks.push({ id, label: id, chainId: contract.chainId, ok: false, actual: e instanceof Error ? e.message : String(e), expected: String(expected) });
      }
    };
    await readEqual('vault.reportId', 'vault', 'reportId', v2Flexible.reportId);
    await readEqual('vault.registry', 'vault', 'registry', v2Flexible.sepolia.ReportRegistry);
    await readEqual('vault.yt', 'vault', 'yt', v2Flexible.sepolia.StakerYieldToken);
    await readEqual('hook.yt', 'hook', 'yt', v2Flexible.sepolia.StakerYieldToken);
    await readEqual('hook.poolKeyHash', 'hook', 'poolKeyHash', v2Flexible.poolKeyHash);
    await readEqual('receiver.vault', 'receiver', 'vault', v2Flexible.sepolia.RiskFiStakeVaultV2);
    await readEqual('sender.destinationReceiver', 'sender', 'destinationReceiver', v2Flexible.sepolia.CCIPStakeReceiverV2);
    return { ok: checks.every(c => c.ok), bundle: v2Flexible.version, checkedAt: Date.now(), checks };
  },
  staleTime: Infinity,
  gcTime: Infinity,
  retry: 1,
};

/** Validate each activated report's local contracts before its write plans run. */
/** The deployment check for a bundle. No bundle (fixture or V1 protocol, where the check is disabled) → the default. */
export function deploymentQueryFor(bundle: V2Bundle | undefined) {
  if (!bundle || bundle.version === v2.version) return deploymentQuery;
  if (bundle.version === v2Flexible.version) return flexibleDeploymentQuery;
  return {
    queryKey: ['deployment', bundle.version] as const,
    queryFn: async (): Promise<DeploymentReport> => {
      const client = clientFor(SEPOLIA_ID);
      const checks: DeploymentCheckItem[] = [];
      for (const [name, address] of Object.entries(bundle.sepolia)) {
        const code = await client.getCode({ address });
        checks.push({ id: `code.${name}`, label: `${name} has deployed code`, chainId: SEPOLIA_ID, ok: !!code && code !== '0x' });
      }
      if (bundle.arbitrumSepolia.CCIPStakeSenderV2 !== '0x0000000000000000000000000000000000000000') {
        const sender = bundle.arbitrumSepolia.CCIPStakeSenderV2;
        const code = await clientFor(ARB_SEPOLIA_ID).getCode({ address: sender });
        checks.push({ id: 'code.sender', label: 'Arbitrum CCIP sender has deployed code', chainId: ARB_SEPOLIA_ID, ok: !!code && code !== '0x' });
      }
      const h = makeV2Handles(bundle);
      for (const [name, fn, expected] of [
        ['vault', 'reportId', bundle.reportId], ['vault', 'registry', bundle.sepolia.ReportRegistry],
        ['vault', 'yt', bundle.sepolia.StakerYieldToken], ['hook', 'yt', bundle.sepolia.StakerYieldToken],
        ['hook', 'poolKeyHash', bundle.poolKeyHash], ['receiver', 'vault', bundle.sepolia.RiskFiStakeVaultV2],
        ...(bundle.arbitrumSepolia.CCIPStakeSenderV2 !== '0x0000000000000000000000000000000000000000' ? [['receiver', 'sourceSender', bundle.arbitrumSepolia.CCIPStakeSenderV2] as const] : []),
      ] as const) {
        try {
          const contract = h[name];
          const actual = await client.readContract({ address: contract.address, abi: contract.abi, functionName: fn } as never);
          checks.push({ id: `${name}.${fn}`, label: `${name}.${fn}`, chainId: SEPOLIA_ID, ok: String(actual).toLowerCase() === String(expected).toLowerCase() });
        } catch { checks.push({ id: `${name}.${fn}`, label: `${name}.${fn}`, chainId: SEPOLIA_ID, ok: false }); }
      }
      return { ok: checks.every(x => x.ok), bundle: bundle.version, checkedAt: Date.now(), checks };
    }, staleTime: Infinity, gcTime: Infinity, retry: 1,
  };
}

/** Why V2 writes are blocked for this report, or undefined when the deployment check passed. */
export function writeBlockReason(report: DeploymentReport | undefined, error?: unknown): string | undefined {
  if (report?.ok) return undefined;
  if (report) {
    const failed = report.checks.filter((c) => !c.ok);
    return `Deployment mismatch: writes are disabled (${failed.length} check${failed.length === 1 ? '' : 's'} failed: ${failed
      .slice(0, 3)
      .map((c) => c.label)
      .join('; ')}${failed.length > 3 ? '; …' : ''}).`;
  }
  if (error) return `Couldn't verify the V2 deployment, so writes are paused: ${error instanceof Error ? error.message : String(error)}`;
  return 'Checking the V2 deployment before allowing writes…';
}
