'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatUnits, parseUnits, type Abi, type Address, type Hex, type PublicClient } from 'viem';
import { useAccount } from 'wagmi';
import { getPublicClient, simulateContract, switchChain, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { accelerated as a } from '@/protocol/accelerated';
import { wagmiConfig } from '@/lib/wagmi';

const CHAIN = 11155111;
const client = getPublicClient(wagmiConfig, { chainId: CHAIN }) as PublicClient;
const link = (address: string) => `https://sepolia.etherscan.io/address/${address}`;
const date = (s: number) => new Date(s * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
type Call = { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] };

export default function AcceleratedPage() {
  const { address, chainId } = useAccount();
  const [stakeAmount, setStakeAmount] = useState('10');
  const [tradeAmount, setTradeAmount] = useState('0.0001');
  const [side, setSide] = useState(true);
  const [trade, setTrade] = useState<'buy' | 'sell'>('buy');
  const [quote, setQuote] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const [balance, setBalance] = useState('');
  const [yes, setYes] = useState(0n);
  const [no, setNo] = useState(0n);
  const [outcome, setOutcome] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [lastTx, setLastTx] = useState<Hex>();

  const refresh = useCallback(async () => {
    try {
      const calls: Promise<unknown>[] = [
        client.readContract({ address: a.vault, abi: a.vaultAbi, functionName: 'finalOutcome' }),
      ];
      if (address) {
        calls.push(client.readContract({ address: a.token, abi: a.tokenAbi, functionName: 'balanceOf', args: [address] }));
        calls.push(client.readContract({ address: a.vault, abi: a.vaultAbi, functionName: 'positionOf', args: [address, true] }));
        calls.push(client.readContract({ address: a.vault, abi: a.vaultAbi, functionName: 'positionOf', args: [address, false] }));
      }
      const values = await Promise.all(calls);
      setOutcome(Number(values[0]));
      if (address) {
        setBalance(formatUnits(values[1] as bigint, 6));
        setYes(values[2] as bigint);
        setNo(values[3] as bigint);
      }
    } catch (e) { setMessage(String(e)); }
  }, [address]);

  useEffect(() => { const first = setTimeout(() => void refresh(), 0); const timer = setInterval(() => void refresh(), 15000); return () => { clearTimeout(first); clearInterval(timer); }; }, [refresh]);

  async function send(call: Call) {
    if (!address) throw new Error('Connect your wallet first.');
    if (chainId !== CHAIN) await switchChain(wagmiConfig, { chainId: CHAIN });
    const request = { ...call, chainId: CHAIN, account: address };
    const simulation = await simulateContract(wagmiConfig, request as never);
    const gas = await client.estimateContractGas(request as never);
    const hash = await writeContract(wagmiConfig, { ...simulation.request, gas: gas + gas / 5n } as never);
    const receipt = await waitForTransactionReceipt(wagmiConfig, { chainId: CHAIN, hash });
    if (receipt.status !== 'success') throw new Error('Transaction reverted.');
    setLastTx(hash);
    await refresh();
  }

  async function execute(action: () => Promise<void>) {
    setBusy(true); setMessage('Confirm in your wallet…');
    try { await action(); setMessage('Transaction confirmed.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function approve(token: Address, abi: Abi, spender: Address, value: bigint) {
    if (!address) throw new Error('Connect your wallet first.');
    const allowance = await client.readContract({ address: token, abi, functionName: 'allowance', args: [address, spender] }) as bigint;
    if (allowance < value) await send({ address: token, abi, functionName: 'approve', args: [spender, value] });
  }

  async function stake() {
    if (!address) throw new Error('Connect your wallet first.');
    const value = parseUnits(stakeAmount, 6);
    if (value <= 0n) throw new Error('Enter an amount above zero.');
    if (Date.now() >= a.times.lockTime * 1000) throw new Error('Voting has locked.');
    await approve(a.token, a.tokenAbi, a.vault, value);
    await send({ address: a.vault, abi: a.vaultAbi, functionName: 'stake', args: [a.reportId, side, value, address, address] });
  }

  async function updateQuote() {
    setQuoteError('');
    try {
      const value = parseUnits(tradeAmount, 6);
      if (value <= 0n) throw new Error('Enter an amount above zero.');
      const result = await client.readContract({ address: a.hook, abi: a.hookAbi, functionName: trade === 'buy' ? 'quoteBuy' : 'quoteSell', args: [value] }) as bigint;
      setQuote(formatUnits(result, 6));
    } catch (error) {
      setQuote('');
      const reason = error instanceof Error ? error.message : String(error);
      const hint = reason.includes('YT_RESERVE') ? 'That buy exceeds the pool’s 100 YT reserve. Try 0.0001 dUSD or less.'
        : reason.includes('BUY_DUST') ? 'That buy is too small for the curve. Try a slightly larger amount.'
          : reason.includes('RATE_BOUND') ? 'That trade exceeds the rate curve’s bounds. Try a smaller amount.'
            : reason.includes('USDC_RESERVE') ? 'That sale exceeds the pool’s dUSD reserve. Try a smaller amount.' : reason;
      setQuoteError(hint);
    }
  }

  async function swap() {
    if (Date.now() >= a.times.maturity * 1000) throw new Error('Trading has ended at maturity.');
    const value = parseUnits(tradeAmount, 6);
    if (value <= 0n) throw new Error('Enter an amount above zero.');
    const buying = trade === 'buy';
    const token = buying ? a.token : a.yt;
    const tokenAbi = buying ? a.tokenAbi : a.tokenAbi;
    const fresh = await client.readContract({ address: a.hook, abi: a.hookAbi, functionName: buying ? 'quoteBuy' : 'quoteSell', args: [value] }) as bigint;
    setQuote(formatUnits(fresh, 6));
    await approve(token, tokenAbi, a.router, value);
    const minOut = fresh * 95n / 100n;
    const zeroForOne = token.toLowerCase() === a.poolKey.currency0.toLowerCase();
    await send({ address: a.router, abi: a.routerAbi, functionName: 'swapExactInput', args: [a.poolKey, zeroForOne, value, minOut, BigInt(Math.floor(Date.now() / 1000) + 600)] });
  }

  async function claim(yesSide: boolean, value: bigint) {
    if (value <= 0n) throw new Error('No position on this side.');
    await send({ address: a.vault, abi: a.vaultAbi, functionName: 'claimPrincipal', args: [yesSide, value] });
  }

  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
    <div className="space-y-3"><p className="text-beam-ink text-sm font-semibold uppercase">V2 accelerated demo · Ethereum Sepolia</p>
      <h1 className="font-display text-4xl">One-hour report</h1>
      <p className="text-muted">Synthetic demo report on a separate V2 registry. It is not linked to a backend research case or World ID approval.</p>
      <Link className="text-beam-ink underline" href="/onchain/1">Open the previous report →</Link>
    </div>
    {message && <p role="status" className="border-line rounded-lg border p-3 text-sm">{message}</p>}
    <div className="grid gap-4 md:grid-cols-3">
      <section className="glass p-5"><h2 className="font-semibold">Voting locks</h2><p>{date(a.times.lockTime)}</p><p className="text-muted text-sm">10 minute vote window</p></section>
      <section className="glass p-5"><h2 className="font-semibold">Market matures</h2><p>{date(a.times.maturity)}</p><p className="text-muted text-sm">Trading ends</p></section>
      <section className="glass p-5"><h2 className="font-semibold">Result deadline</h2><p>{date(a.resultDeadline)}</p><p className="text-muted text-sm">Resolution must be proposed by then</p></section>
    </div>
    <div className="glass space-y-3 p-5"><h2 className="text-xl font-semibold">Wallet and test funds</h2><ConnectButton /><p>dUSD balance: {balance || 'Connect wallet'}</p>
      <button disabled={busy} className="bg-beam text-on-beam rounded-lg px-4 py-2 disabled:opacity-50" onClick={() => void execute(() => send({ address: a.faucet, abi: a.faucetAbi as Abi, functionName: 'claim' }))}>Mint 100 demo dUSD</button>
      <p className="text-muted text-sm">Public faucet: one claim per wallet per 60 seconds. Sepolia ETH is needed for gas.</p></div>
    <div className="grid gap-4 md:grid-cols-2">
      <section className="glass space-y-3 p-5"><h2 className="text-xl font-semibold">Vote with dUSD</h2><p>Yes: {formatUnits(yes, 6)} · No: {formatUnits(no, 6)}</p>
        <label className="block">Stake amount (dUSD)<input aria-label="Stake amount in dUSD" inputMode="decimal" className="border-line bg-surface mt-1 w-full rounded-lg border p-2" value={stakeAmount} onChange={e => setStakeAmount(e.target.value)} /></label>
        <div className="flex gap-2"><button type="button" onClick={() => setSide(true)} aria-pressed={side} className={`rounded-lg border px-3 py-2 ${side ? 'border-beam bg-beam text-on-beam' : 'border-line'}`}>Yes</button><button type="button" onClick={() => setSide(false)} aria-pressed={!side} className={`rounded-lg border px-3 py-2 ${!side ? 'border-beam bg-beam text-on-beam' : 'border-line'}`}>No</button></div>
        <button disabled={busy} className="bg-beam text-on-beam rounded-lg px-4 py-2 disabled:opacity-50" onClick={() => void execute(stake)}>Approve and stake</button></section>
      <section className="glass space-y-3 p-5"><h2 className="text-xl font-semibold">Trade YT</h2><p>Trade until {date(a.times.maturity)}.</p>
        <div className="flex gap-2"><button type="button" onClick={() => { setTrade('buy'); setTradeAmount('0.0001'); setQuote(''); setQuoteError(''); }} aria-pressed={trade === 'buy'} className={`rounded-lg border px-3 py-2 ${trade === 'buy' ? 'border-beam bg-beam text-on-beam' : 'border-line'}`}>Buy YT with dUSD</button><button type="button" onClick={() => { setTrade('sell'); setTradeAmount('10'); setQuote(''); setQuoteError(''); }} aria-pressed={trade === 'sell'} className={`rounded-lg border px-3 py-2 ${trade === 'sell' ? 'border-beam bg-beam text-on-beam' : 'border-line'}`}>Sell YT for dUSD</button></div>
        <label className="block">Trade amount ({trade === 'buy' ? 'dUSD' : 'YT'})<input aria-label={`Trade amount in ${trade === 'buy' ? 'dUSD' : 'YT'}`} inputMode="decimal" className="border-line bg-surface mt-1 w-full rounded-lg border p-2" value={tradeAmount} onChange={e => { setTradeAmount(e.target.value); setQuote(''); setQuoteError(''); }} /></label>
        <p>Quote: {quote ? `${quote} ${trade === 'buy' ? 'YT' : 'dUSD'}` : '—'}</p>
        {quoteError && <p role="alert" className="text-mask-ink text-sm">{quoteError}</p>}
        <button disabled={busy} className="border-line mr-2 rounded-lg border px-4 py-2" onClick={() => void updateQuote()}>Refresh quote</button>
        <button disabled={busy} className="bg-beam text-on-beam rounded-lg px-4 py-2 disabled:opacity-50" onClick={() => void execute(swap)}>Approve and trade</button><p className="text-muted text-sm">This one-hour curve makes YT very cheap. The pool holds 100 YT, so buys must be tiny. Minimum received uses a 5% quote tolerance; the quote is refreshed before approval.</p></section>
    </div>
    <section className="glass space-y-3 p-5"><h2 className="text-xl font-semibold">Settlement</h2><p>Outcome: {['Pending', 'Yes', 'No', 'Void'][outcome] ?? outcome}. Claims open after onchain finalization.</p>
      <button disabled={busy || outcome === 0 || yes === 0n} className="border-line mr-2 rounded-lg border px-4 py-2 disabled:opacity-50" onClick={() => void execute(() => claim(true, yes))}>Claim Yes principal</button>
      <button disabled={busy || outcome === 0 || no === 0n} className="border-line rounded-lg border px-4 py-2 disabled:opacity-50" onClick={() => void execute(() => claim(false, no))}>Claim No principal</button></section>
    <section className="glass space-y-2 p-5"><h2 className="text-xl font-semibold">Onchain contracts</h2>
      <p><a className="text-beam-ink underline" href={link(a.registry)} target="_blank" rel="noreferrer">Flexible registry</a> · <a className="text-beam-ink underline" href={link(a.vault)} target="_blank" rel="noreferrer">Vault</a> · <a className="text-beam-ink underline" href={link(a.hook)} target="_blank" rel="noreferrer">Uniswap v4 hook</a></p>
      <p className="text-muted text-sm">Arbitrum Sepolia CCIP sender: {a.sender}. Ethereum Sepolia receiver: {a.receiver}. Cross-chain stake cutoff: {date(a.times.crossChainCutoff)}.</p><p className="text-muted text-sm">Report hash: {a.reportHash}. Claim hash: {a.claimHash}.</p></section>
    {lastTx && <a className="text-beam-ink underline" href={`https://sepolia.etherscan.io/tx/${lastTx}`} target="_blank" rel="noreferrer">View last transaction ↗</a>}
  </main>;
}
