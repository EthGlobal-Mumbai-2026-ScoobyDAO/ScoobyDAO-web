'use client';

import { CircleCheck, CircleMinus, CircleX, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { HashText } from '@/components/HashText';
import { matchClaimHash, sameHash, sha256Hex, toBytes32, type ClaimHashAlg } from '@/lib/hash';
import type { ClaimManifest, Hex } from '@/lib/types';

type Verdict = boolean | undefined;

/**
 * Recomputes both hashes in this browser and compares them with the backend values and, once a
 * publication is verified, with ReportRegistry.getReport(onchainReportId).
 *   reportHash = SHA-256 of the exact report.json bytes (GET /reports/:id/raw)
 *   claimHash  = keccak256 or SHA-256 of the canonical claim manifest: the backend's declared
 *                claimHashAlg, else keccak256 first, then SHA-256 (the result says which matched)
 */
export function HashCheck({
  raw,
  reportSha256,
  claimManifest,
  claimHash,
  claimHashAlg,
  onchain,
}: {
  raw?: Uint8Array;
  reportSha256: string;
  claimManifest: ClaimManifest;
  claimHash: Hex;
  claimHashAlg?: ClaimHashAlg;
  onchain?: { reportHash: Hex; claimHash: Hex };
}) {
  const q = useQuery({
    queryKey: ['hashcheck', reportSha256, claimHash, claimHashAlg, raw?.length],
    queryFn: async () => {
      try {
        return { report: raw ? await sha256Hex(raw) : undefined, claim: await matchClaimHash(claimManifest, claimHash, claimHashAlg) };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
    staleTime: Infinity,
  });
  const computed = q.data ?? null;
  const claim = computed && 'claim' in computed ? computed.claim : undefined;
  const report = computed && 'report' in computed ? computed.report : undefined;
  const run = () => void q.refetch();

  const rows: { label: string; value: string; vsBackend: Verdict; vsChain: Verdict }[] = [
    {
      label: 'Report hash (SHA-256 of report.json bytes)',
      value: toBytes32(reportSha256),
      vsBackend: report ? sameHash(report, reportSha256) : undefined,
      vsChain: onchain ? sameHash(onchain.reportHash, reportSha256) && (!report || sameHash(report, onchain.reportHash)) : undefined,
    },
    {
      label: `Claim hash (${claim ? claim.alg : claimHashAlg ?? 'keccak256 or SHA-256'} of the canonical claim manifest)`,
      value: claimHash,
      vsBackend: claim ? claim.match : undefined,
      vsChain: onchain ? sameHash(onchain.claimHash, claimHash) && (!claim || claim.match) : undefined,
    },
  ];

  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <caption className="sr-only">Hash checks</caption>
        <thead className="text-muted text-left">
          <tr>
            <th className="pb-2 font-normal">Value</th>
            <th className="pb-2 font-normal">Recomputed here</th>
            <th className="pb-2 font-normal">Onchain</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-line border-t align-top">
              <td className="py-2 pr-3">
                <p className="text-muted text-xs">{r.label}</p>
                <HashText value={r.value} label={r.label} />
              </td>
              <td className="py-2 pr-3">
                <Mark ok={r.vsBackend} pending={!computed} />
              </td>
              <td className="py-2">{onchain ? <Mark ok={r.vsChain} /> : <span className="text-muted text-xs">not linked onchain</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {claim && (
        <p className="text-muted text-xs">
          {claim.declared
            ? `The backend states the claim-hash algorithm: ${claim.alg}.`
            : claim.match
              ? `The backend didn't state the algorithm; ${claim.alg} matched (keccak256 is tried first, then SHA-256).`
              : 'The backend didn’t state the algorithm, and neither keccak256 nor SHA-256 of this manifest matches its claim hash.'}
        </p>
      )}
      {computed && 'error' in computed && <p className="text-mask-ink text-sm">Couldn&apos;t recompute: {computed.error}</p>}
      {!raw && <p className="text-muted text-xs">The raw report bytes weren&apos;t available, so the report hash can&apos;t be recomputed.</p>}
      <button
        type="button"
        onClick={() => void run()}
        className="border-line inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold hover:border-[var(--fog-400)]"
      >
        <RefreshCw size={15} aria-hidden /> Recompute hashes
      </button>
    </div>
  );
}

function Mark({ ok, pending }: { ok: Verdict; pending?: boolean }) {
  if (ok === undefined)
    return (
      <span className="text-muted inline-flex items-center gap-1">
        <CircleMinus size={16} aria-hidden /> {pending ? 'checking…' : '—'}
      </span>
    );
  return ok ? (
    <span className="text-clue-ink inline-flex items-center gap-1 font-semibold">
      <CircleCheck size={16} aria-hidden /> ✓ match
    </span>
  ) : (
    <span className="text-mask-ink inline-flex items-center gap-1 font-semibold">
      <CircleX size={16} aria-hidden /> ✗ mismatch
    </span>
  );
}
