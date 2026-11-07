'use client';

import { useQueries } from '@tanstack/react-query';
import { matchClaimHash, sameHash } from '@/lib/hash';
import { useReports } from '@/lib/queries';
import type { WebReport } from '@/lib/types';

export interface LinkTarget {
  key: string;
  id: string;
  /** The registry's claimHash for this report. */
  claimHash?: string;
  /** Catalog markets only. Pre-catalog demo reports (#1 of each bundle) are never linked (CLAUDE.md rule 11). */
  linkable: boolean;
}

/** Backend report that claims this onchain id AND declares the registry's claim hash. Still needs the recompute below. */
export function linkCandidate(reports: WebReport[] | undefined, t: LinkTarget): WebReport | undefined {
  if (!t.linkable || !t.claimHash || !reports) return undefined;
  return reports.find((r) => r.onchainReportId === t.id && !r.revoked && sameHash(r.claimHash, t.claimHash));
}

/**
 * Backend reports linked to onchain markets, keyed by target key. A link needs the backend's onchainReportId to match,
 * its declared claim hash to equal the registry's, and the claim hash recomputed in this browser from the manifest to
 * match too. Anything less shows the market as a demo claim. A failing backend just means no links.
 */
export function useLinkedReports(targets: LinkTarget[], enabled = true): Map<string, WebReport> {
  const anyLinkable = enabled && targets.some((t) => t.linkable && t.claimHash);
  const reports = useReports({ enabled: anyLinkable });
  const candidates = targets.flatMap((t) => {
    const r = anyLinkable ? linkCandidate(reports.data, t) : undefined;
    return r ? [{ t, r }] : [];
  });
  const checks = useQueries({
    queries: candidates.map(({ t, r }) => ({
      queryKey: ['linked-report', r.id, t.claimHash],
      queryFn: () => matchClaimHash(r.claimManifest, t.claimHash!, r.claimHashAlg),
      staleTime: Infinity,
    })),
  });
  const out = new Map<string, WebReport>();
  candidates.forEach(({ t, r }, i) => {
    if (checks[i]?.data?.match) out.set(t.key, r);
  });
  return out;
}
