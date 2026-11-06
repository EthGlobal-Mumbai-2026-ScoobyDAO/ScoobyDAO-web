'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { isAddress, isHex, type Address, type Hex } from 'viem';
import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { useReports } from '@/lib/queries';
import { defaultReportAdapter } from '@/lib/reports';
import { publishReport, type RegistryKind } from '@/protocol/publish';

const ZERO = `0x${'0'.repeat(64)}`;
const bytes32 = (value: string): value is Hex => isHex(value) && value.length === 66 && value !== ZERO;
const minutes = (value: string, name: string) => {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a positive whole number of minutes.`);
  return BigInt(n) * 60n;
};

export function PublishReportScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const { address } = useAccount();
  const reports = useReports();
  const research = useQuery({ queryKey: ['research-reports', 'publish'], queryFn: () => defaultReportAdapter.list(), retry: false });
  const [registry, setRegistry] = useState<RegistryKind>('flexible');
  const [selected, setSelected] = useState(search.get('research') ? `research:${search.get('research')}` : search.get('report') ?? '');
  const [reportHash, setReportHash] = useState('');
  const [claimHash, setClaimHash] = useState('');
  const [resolver, setResolver] = useState('');
  const [adjudicator, setAdjudicator] = useState('');
  const [remoteMinutes, setRemoteMinutes] = useState('5');
  const [voteMinutes, setVoteMinutes] = useState('10');
  const [tradeMinutes, setTradeMinutes] = useState('60');
  const [resultMinutes, setResultMinutes] = useState('70');
  const [challengeMinutes, setChallengeMinutes] = useState('5');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState<Hex>();
  const chosen = reports.data?.find(x => x.id === selected);
  const researchChoice = research.data?.find(x => `research:${x.id}` === selected);
  const chosenReportHash = chosen ? `0x${chosen.reportSha256.replace(/^0x/, '')}` : researchChoice ? `0x${researchChoice.digest}` : '';
  const chosenClaimHash = chosen?.claimHash ?? '';
  const effectiveReportHash = reportHash || chosenReportHash;
  const effectiveClaimHash = claimHash || chosenClaimHash;

  async function publish() {
    setError(''); setBusy(true);
    try {
      if (!address) throw new Error('Connect the publisher wallet first.');
      if (!bytes32(effectiveReportHash) || !bytes32(effectiveClaimHash)) throw new Error('Report hash and claim hash must be nonzero bytes32 values.');
      const resolverAddress = resolver || address;
      const adjudicatorAddress = adjudicator || address;
      if (!isAddress(resolverAddress) || !isAddress(adjudicatorAddress)) throw new Error('Resolver and adjudicator must be valid wallet addresses.');
      const start = BigInt(Math.floor(Date.now() / 1000) + 30);
      const lockTime = start + minutes(voteMinutes, 'Vote duration');
      const maturity = registry === 'original' ? lockTime + 30n * 86400n : start + minutes(tradeMinutes, 'Trade duration');
      const resultDeadline = start + minutes(resultMinutes, 'Result deadline');
      const result = await publishReport({ registry, reportHash: effectiveReportHash, claimHash: effectiveClaimHash, reviewer: address,
        resolver: resolverAddress as Address, adjudicator: adjudicatorAddress as Address, remoteCutoff: start + minutes(remoteMinutes, 'CCIP cutoff'),
        lockTime, maturity, resultDeadline, challengePeriod: minutes(challengeMinutes, 'Challenge period') });
      setTxHash(result.txHash);
      router.push(`/markets/${registry}/${result.reportId}`);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  const field = 'border-line bg-surface mt-1 w-full rounded-lg border p-2';
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
    <div><p className="text-beam-ink text-sm font-semibold uppercase">Publisher wallet · Ethereum Sepolia</p><h1 className="font-display text-4xl">Publish report onchain</h1>
      <p className="text-muted mt-3">The registry stores report and claim hashes, roles, and clocks. Only its publisher can submit, and the connected reviewer signs the exact parameters. A new market needs its own vault, YT, and pool setup before staking or trading opens.</p></div>
    <ConnectButton />
    <section className="glass space-y-4 p-5">
      <label className="block">Registry<select className={field} value={registry} onChange={e => { const next = e.target.value as RegistryKind; setRegistry(next); if (next === 'original') { setVoteMinutes('1440'); setTradeMinutes('44640'); setResultMinutes('46080'); setChallengeMinutes('60'); } else { setVoteMinutes('10'); setTradeMinutes('60'); setResultMinutes('70'); setChallengeMinutes('5'); } }}><option value="flexible">FlexibleReportRegistry (custom maturity)</option><option value="original">ReportRegistry (maturity = vote lock + 30 days)</option></select></label>
      <label className="block">Backend report (optional)<select className={field} value={selected} onChange={e => { setSelected(e.target.value); setReportHash(''); setClaimHash(''); }}><option value="">Enter hashes manually</option>{reports.data?.map(r => <option key={r.id} value={r.id}>{r.id} · {r.status}</option>)}{research.data?.map(r => <option key={`research:${r.id}`} value={`research:${r.id}`}>{r.title} · {r.id}</option>)}</select></label>
      {reports.isError && research.isError && <p className="text-muted text-sm">Backend reports unavailable; enter hashes manually.</p>}
      {researchChoice && <p className="text-muted text-sm">Research API provides the report SHA-256 but no onchain claim manifest hash. Enter and verify the claim hash before publication.</p>}
      <label className="block">Report SHA-256 hash<input className={field} value={effectiveReportHash} onChange={e => setReportHash(e.target.value)} placeholder="0x…" /></label>
      <label className="block">Claim manifest hash<input className={field} value={effectiveClaimHash} onChange={e => setClaimHash(e.target.value)} placeholder="0x…" /></label>
      <p className="text-muted text-sm">Reviewer and publisher: {address ?? 'Connect wallet'}. Optional role addresses default to this wallet.</p>
      <div className="grid gap-4 sm:grid-cols-2"><label>Resolver (optional)<input className={field} value={resolver} onChange={e => setResolver(e.target.value)} placeholder={address ?? '0x…'} /></label><label>Adjudicator (optional)<input className={field} value={adjudicator} onChange={e => setAdjudicator(e.target.value)} placeholder={address ?? '0x…'} /></label></div>
      <div className="grid gap-4 sm:grid-cols-2"><label>CCIP cutoff (minutes)<input inputMode="numeric" className={field} value={remoteMinutes} onChange={e => setRemoteMinutes(e.target.value)} /></label><label>Vote lock (minutes)<input inputMode="numeric" className={field} value={voteMinutes} onChange={e => setVoteMinutes(e.target.value)} /></label><label>Market maturity (minutes)<input inputMode="numeric" disabled={registry === 'original'} className={field} value={tradeMinutes} onChange={e => setTradeMinutes(e.target.value)} /></label><label>Result deadline (minutes)<input inputMode="numeric" className={field} value={resultMinutes} onChange={e => setResultMinutes(e.target.value)} /></label><label>Challenge period (minutes)<input inputMode="numeric" className={field} value={challengeMinutes} onChange={e => setChallengeMinutes(e.target.value)} /></label></div>
      {error && <p role="alert" className="text-mask-ink text-sm">{error}</p>}
      <button type="button" disabled={busy || !address} className="bg-beam text-on-beam rounded-lg px-5 py-2.5 font-semibold disabled:opacity-50" onClick={() => void publish()}>{busy ? 'Signing and publishing…' : 'Sign and publish onchain'}</button>
      {txHash && <p>Published: <a className="text-beam-ink underline" href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">View transaction</a></p>}
    </section>
    <Link href="/markets" className="text-beam-ink underline">Back to live markets</Link>
  </main>;
}
