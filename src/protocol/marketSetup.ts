import { isAddressEqual, zeroAddress, type Abi, type Address, type Hex } from 'viem';
import { getAccount, getPublicClient, simulateContract, switchChain, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { wagmiConfig } from '@/lib/wagmi';
import seriesAbi from '@/contracts/market-infrastructure/V2SeriesFactory.json';
import catalogAbi from '@/contracts/market-infrastructure/V2PoolCatalog.json';
import finderAbi from '@/contracts/market-infrastructure/V2HookSaltFinder.json';
import hookFactoryAbi from '@/contracts/v2/abis/YieldCurveFactoryV2.json';
import senderFactoryAbi from '@/contracts/market-infrastructure/V2CCIPSenderFactory.json';
import receiverAbi from '@/contracts/v2/abis/CCIPStakeReceiverV2.json';
import infra from '@/contracts/market-infrastructure/addresses.json';
import { registryFor, type ReportChoice } from './reportDiscovery';

const chainId = 11155111 as const;
const seriesFactory = infra.seriesFactory as Address;
const poolCatalog = infra.poolCatalog as Address;
const finder = infra.hookSaltFinder as Address;
const hookFactory = infra.hookFactory as Address;
const manager = infra.poolManager as Address;
const usd = infra.usd as Address;
const series = seriesAbi as Abi;
const catalog = catalogAbi as Abi;
const findAbi = finderAbi as Abi;
const factoryAbi = hookFactoryAbi as Abi;
const arbFactory = infra.arbSenderFactory as Address;

function client() {
  const c = getPublicClient(wagmiConfig, { chainId });
  if (!c) throw new Error('Ethereum Sepolia RPC unavailable.');
  return c;
}

async function publisher(registry: Address) {
  const account = getAccount(wagmiConfig).address;
  if (!account) throw new Error('Connect the report publisher wallet.');
  if (getAccount(wagmiConfig).chainId !== chainId) await switchChain(wagmiConfig, { chainId });
  const owner = await client().readContract({ address: registry, abi: [{ type: 'function', name: 'publisher', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }], functionName: 'publisher' }) as Address;
  if (!isAddressEqual(account, owner)) throw new Error(`Connect the registry publisher ${owner}.`);
  return account;
}

async function send(address: Address, abi: Abi, functionName: string, args: unknown[], account: Address) {
  const call = { address, abi, functionName, args, account, chainId };
  const { request } = await simulateContract(wagmiConfig, call as never);
  const gas = await client().estimateContractGas(call as never);
  const hash = await writeContract(wagmiConfig, { ...request, gas: gas + gas / 5n } as never);
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId });
  if (receipt.status !== 'success') throw new Error(`${functionName} reverted: ${hash}`);
  return hash;
}

export type SetupState = { series: { vault: Address; yt: Address; rep: Address }; market: { hook: Address } };
export async function setupState(choice: ReportChoice): Promise<SetupState> {
  const registry = registryFor(choice.deployment);
  const reportId = BigInt(choice.id);
  const [s, m] = await Promise.all([
    client().readContract({ address: seriesFactory, abi: series, functionName: 'getSeries', args: [registry, reportId] }),
    client().readContract({ address: poolCatalog, abi: catalog, functionName: 'getMarket', args: [registry, reportId] }),
  ]);
  return { series: s as SetupState['series'], market: m as SetupState['market'] };
}

export async function prepareMarket(choice: ReportChoice, treasury: Address): Promise<Hex> {
  const registry = registryFor(choice.deployment);
  const account = await publisher(registry);
  if (Math.floor(Date.now() / 1000) >= choice.lockTime) throw new Error('The vote lock has passed. Publish a report with a later lock time.');
  return send(seriesFactory, series, 'prepare', [registry, BigInt(choice.id), treasury], account);
}

export async function deployMarketHook(choice: ReportChoice): Promise<{ hash: Hex; hook: Address }> {
  const registry = registryFor(choice.deployment);
  const account = await publisher(registry);
  const owner = await client().readContract({ address: hookFactory, abi: factoryAbi, functionName: 'owner' }) as Address;
  if (!isAddressEqual(owner, account)) throw new Error(`The v4 hook factory owner ${owner} must deploy the pool.`);
  const s = (await setupState(choice)).series;
  if (s.yt === zeroAddress) throw new Error('Prepare the vault and YT first.');
  let salt: Hex | undefined;
  let hook: Address | undefined;
  for (let start = 0n; start < 1_000_000n; start += 10_000n) {
    const result = await client().readContract({ address: finder, abi: findAbi, functionName: 'find', args: [hookFactory, manager, usd, s.yt, BigInt(choice.maturity), start, 10_000n] }) as [Hex, Address, boolean];
    if (result[2]) { [salt, hook] = result; break; }
  }
  if (!salt || !hook) throw new Error('Could not find a valid v4 hook salt within one million attempts.');
  const hash = await send(hookFactory, factoryAbi, 'deployAndInitialize', [manager, usd, s.yt, BigInt(choice.maturity), 3000, 10n ** 17n, 5_000_000n, 5n * 10n ** 16n, 2n * 10n ** 17n, salt], account);
  return { hash, hook };
}

export async function activateMarket(choice: ReportChoice, hook: Address): Promise<Hex> {
  const registry = registryFor(choice.deployment);
  const account = await publisher(registry);
  if (hook === zeroAddress) throw new Error('Deploy the v4 hook first.');
  return send(poolCatalog, catalog, 'activate', [registry, BigInt(choice.id), hook], account);
}

export async function deployCcipSender(choice: ReportChoice): Promise<Hex> {
  const registry = registryFor(choice.deployment);
  const account = await publisher(registry);
  if (!choice.market) throw new Error('Activate the market first.');
  if (getAccount(wagmiConfig).chainId !== 421614) await switchChain(wagmiConfig, { chainId: 421614 });
  const arb = getPublicClient(wagmiConfig, { chainId: 421614 });
  if (!arb) throw new Error('Arbitrum Sepolia RPC unavailable.');
  const abi = senderFactoryAbi as Abi;
  const owner = await arb.readContract({ address: arbFactory, abi, functionName: 'owner' }) as Address;
  if (!isAddressEqual(owner, account)) throw new Error(`Connect the CCIP factory owner ${owner}.`);
  const call = { address: arbFactory, abi, functionName: 'deploy', args: [choice.market.ccipReceiver, BigInt(choice.id), BigInt(choice.report?.crossChainCutoff ?? 0)], account, chainId: 421614 };
  const { request } = await simulateContract(wagmiConfig, call as never);
  const gas = await arb.estimateContractGas(call as never);
  const hash = await writeContract(wagmiConfig, { ...request, gas: gas + gas / 5n } as never);
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: 421614 });
  if (receipt.status !== 'success') throw new Error('CCIP sender deployment reverted.');
  return hash;
}

export async function configureCcipReceiver(choice: ReportChoice): Promise<Hex> {
  const registry = registryFor(choice.deployment);
  const account = await publisher(registry);
  if (!choice.market) throw new Error('Activate the market first.');
  const arb = getPublicClient(wagmiConfig, { chainId: 421614 });
  if (!arb) throw new Error('Arbitrum Sepolia RPC unavailable.');
  const sender = await arb.readContract({ address: arbFactory, abi: senderFactoryAbi as Abi, functionName: 'senderForReceiver', args: [choice.market.ccipReceiver] }) as Address;
  if (sender === zeroAddress) throw new Error('Deploy the Arbitrum CCIP sender first.');
  return send(choice.market.ccipReceiver as Address, receiverAbi as Abi, 'configureSourceSender', [sender], account);
}
