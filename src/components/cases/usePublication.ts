'use client';

import { useQuery } from '@tanstack/react-query';
import { matchClaimHash, type ClaimHashMatch } from '@/lib/hash';
import type { Hex, WebReport } from '@/lib/types';
import type { MarketView } from '@/protocol';
import { useMarket } from '@/protocol/hooks';

export type Publication =
  /** The backend reports no onchain id and publish tx: no onchain link. */
  | { state: 'none' }
  | { state: 'checking'; id: bigint }
  /** The registry couldn't be read for that id (or nothing is published there). */
  | { state: 'unreadable'; id: bigint; error: string }
  /** The registry's claim hash isn't the recomputed claim hash of this manifest. */
  | { state: 'mismatch'; id: bigint; market: MarketView; check: ClaimHashMatch }
  | { state: 'verified'; id: bigint; market: MarketView; check: ClaimHashMatch; tx: Hex };

/** The onchain id a backend report claims, only when it also carries the publish tx. */
export function publicationTarget(r: Pick<WebReport, 'onchainReportId' | 'txHash'> | undefined): bigint | undefined {
  return r?.onchainReportId && /^\d+$/.test(r.onchainReportId) && r.txHash ? BigInt(r.onchainReportId) : undefined;
}

/**
 * V2: a backend report links onchain only when its DTO carries onchainReportId and a publish tx AND
 * ReportRegistry.getReport(id).claimHash equals the claim hash recomputed in this browser
 * (backend-declared algorithm, else keccak256 then SHA-256). Everything else shows no onchain link.
 */
export function useVerifiedPublication(r: WebReport | undefined): Publication {
  const id = publicationTarget(r);
  const market = useMarket(id);
  const check = useQuery({
    queryKey: ['claimHashMatch', r?.id, r?.claimHash, market.data?.claimHash],
    queryFn: () => matchClaimHash(r!.claimManifest, market.data!.claimHash, r!.claimHashAlg),
    enabled: !!r && !!market.data,
    staleTime: Infinity,
  });
  if (id === undefined || !r) return { state: 'none' };
  if (market.isError) return { state: 'unreadable', id, error: market.error.message };
  if (check.isError) return { state: 'unreadable', id, error: check.error.message };
  if (!market.data || !check.data) return { state: 'checking', id };
  if (!check.data.match) return { state: 'mismatch', id, market: market.data, check: check.data };
  return { state: 'verified', id, market: market.data, check: check.data, tx: r.txHash! };
}
