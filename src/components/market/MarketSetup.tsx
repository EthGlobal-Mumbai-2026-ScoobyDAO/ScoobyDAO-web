'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isAddress, zeroAddress, type Address, type Hex } from 'viem';
import { useAccount } from 'wagmi';
import { Disclosure } from '@/components/ui';
import type { ReportChoice } from '@/protocol/reportDiscovery';
import { activateMarket, configureCcipReceiver, deployCcipSender, deployMarketHook, prepareMarket, setupState, type SetupState } from '@/protocol/marketSetup';

export function MarketSetup({ choice }: { choice: ReportChoice }) {
  const router = useRouter();
  const { address } = useAccount();
  const [state, setState] = useState<SetupState>();
  const [treasury, setTreasury] = useState('');
  const [hook, setHook] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastTx, setLastTx] = useState<Hex>();
  useEffect(() => { let live = true; void setupState(choice).then(s => { if (live) setState(s); }).catch(e => { if (live) setError(String(e)); }); return () => { live = false; }; }, [choice]);
  const prepared = !!state && state.series.vault !== zeroAddress;
  const activated = !!state && state.market.hook !== zeroAddress;
  const senderDeployed = !!choice.sender && choice.sender !== zeroAddress;
  async function run(fn: () => Promise<Hex>) {
    setBusy(true); setError('');
    try { const tx = await fn(); setLastTx(tx); setState(await setupState(choice)); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <section className="border-line space-y-3 rounded-[14px] border border-dashed p-5" aria-labelledby="setup-h">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="setup-h" className="text-lg font-semibold">Market setup <span className="text-muted text-sm font-normal">· publisher only</span></h2>
      <span className="text-muted text-[13px]">{!choice.tradable ? 'No market deployed yet' : 'Cross-chain staking not set up yet'}</span>
    </div>
    <p className="text-muted text-sm">{!choice.tradable ? 'The report is published. Its publisher can deploy the stake vault and yield market here before the lock.' : 'Local staking and trading work. The publisher can still connect Arbitrum Sepolia staking via Chainlink CCIP.'}</p>
    <Disclosure summary="Show setup steps">
    <div className="space-y-4">
    <ConnectButton />
    <ol className="list-inside list-decimal space-y-3 text-sm">
      <li>{prepared ? 'Vault and YT prepared' : 'Prepare vault and YT'}
        {!prepared && <div className="mt-2 flex flex-wrap gap-2"><input aria-label="Treasury address" className="border-line bg-surface min-w-72 rounded-lg border p-2" placeholder="Treasury address (defaults to publisher)" value={treasury} onChange={e => setTreasury(e.target.value)} /><button type="button" disabled={busy || !address} className="bg-beam text-on-beam rounded-lg px-3 py-2 disabled:opacity-50" onClick={() => void run(() => prepareMarket(choice, (isAddress(treasury) ? treasury : address!) as Address))}>Prepare</button></div>}
      </li>
      <li>Deploy and initialize the YT/dUSD Uniswap v4 pool
        {prepared && !activated && <div className="mt-2"><button type="button" disabled={busy || !address} className="bg-beam text-on-beam rounded-lg px-3 py-2 disabled:opacity-50" onClick={() => void (async () => { setBusy(true); setError(''); try { const result = await deployMarketHook(choice); setHook(result.hook); setLastTx(result.hash); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } })()}>Find salt and deploy pool</button></div>}
      </li>
      <li>Activate the market and create the local stake router and CCIP receiver
        {prepared && !activated && <div className="mt-2 flex flex-wrap gap-2"><input aria-label="Deployed hook address" className="border-line bg-surface min-w-72 rounded-lg border p-2" placeholder="Deployed v4 hook address" value={hook} onChange={e => setHook(e.target.value)} /><button type="button" disabled={busy || !isAddress(hook)} className="bg-beam text-on-beam rounded-lg px-3 py-2 disabled:opacity-50" onClick={() => void run(() => activateMarket(choice, hook as Address))}>Activate</button></div>}
      </li>
      {activated && <li>{senderDeployed ? 'Arbitrum CCIP sender deployed' : 'Deploy the Arbitrum CCIP sender'}
        {!senderDeployed && <div className="mt-2"><button type="button" disabled={busy || !address} className="bg-beam text-on-beam rounded-lg px-3 py-2 disabled:opacity-50" onClick={() => void run(() => deployCcipSender(choice))}>Deploy CCIP sender</button></div>}
      </li>}
      {activated && <li>{choice.ccipReady ? 'Sepolia receiver trusts this sender' : 'Configure the Sepolia receiver to trust the sender'}
        {senderDeployed && !choice.ccipReady && <div className="mt-2"><button type="button" disabled={busy || !address} className="bg-beam text-on-beam rounded-lg px-3 py-2 disabled:opacity-50" onClick={() => void run(() => configureCcipReceiver(choice))}>Configure receiver</button></div>}
      </li>}
    </ol>
    <p className="text-muted text-sm">After activation, stake dUSD to mint YT, then add dUSD and YT liquidity on Trade YT so swaps can execute. Complete CCIP setup before the remote cutoff.</p>
    {busy && <p role="status">Waiting for wallet or Sepolia confirmation…</p>}
    {error && <p role="alert" className="text-mask-ink text-sm">{error}</p>}
    {lastTx && <a className="text-beam-ink underline" href={`https://sepolia.etherscan.io/tx/${lastTx}`} target="_blank" rel="noreferrer">View latest setup transaction</a>}
    </div>
    </Disclosure>
  </section>;
}
