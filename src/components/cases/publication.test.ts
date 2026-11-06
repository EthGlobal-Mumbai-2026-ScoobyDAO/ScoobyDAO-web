import { describe, expect, it } from 'vitest';
import { parseReport } from '@/lib/guards';
import { matchClaimHash } from '@/lib/hash';
import vector from '@/test/recorded/claim-hash-vector.json';
import { liveWorld, v2For } from '@/test/v2world';
import { publicationTarget } from './usePublication';

const TX = `0x${'5e'.repeat(32)}` as const;
const dto = (extra: Record<string, unknown>) => ({
  id: 'ray@v1',
  status: 'published',
  manifest: vector.manifest,
  manifestHash: vector.keccak256,
  createdAt: 1_700_000_000,
  reportSha256: vector.manifest.reportSha256,
  ...extra,
});

describe('backend DTO fields for onchain links', () => {
  it('accepts claimHashAlg, publishTxHash and onchainReportId; unknown algorithms are ignored', () => {
    const r = parseReport(dto({ claimHashAlg: 'keccak256', publishTxHash: TX, onchainReportId: '2' }));
    expect(r).toMatchObject({ claimHashAlg: 'keccak256', txHash: TX, onchainReportId: '2', claimHash: vector.keccak256 });
    expect(parseReport(dto({ claimHashAlg: 'md5' })).claimHashAlg).toBeUndefined();
    expect(parseReport(dto({ txHash: TX, claimId: '3' }))).toMatchObject({ txHash: TX, onchainReportId: '3' }); // today's field names
  });

  it('an onchain link needs both the onchain id and the publish tx', () => {
    expect(publicationTarget({ onchainReportId: '2', txHash: TX })).toBe(2n);
    expect(publicationTarget({ onchainReportId: '2' })).toBeUndefined();
    expect(publicationTarget({ txHash: TX })).toBeUndefined();
    expect(publicationTarget({ onchainReportId: 'two', txHash: TX })).toBeUndefined();
    expect(publicationTarget(undefined)).toBeUndefined();
  });
});

describe('verification against the V2 registry (mocked chain)', () => {
  it('a backend report published as #2 verifies, but has no market (the vault serves #1 only)', async () => {
    const w = liveWorld();
    w.extraReports['2'] = { ...w.report, reportHash: `0x${vector.manifest.reportSha256}`, claimHash: vector.keccak256 as `0x${string}` };
    const m = await v2For(w).protocol.getMarket(2n);
    expect(await matchClaimHash(vector.manifest, m.claimHash)).toMatchObject({ match: true, alg: 'keccak256' });
    expect(m.series).toBe(false); // "Published onchain — no market deployed for this report yet"
  });

  it('report #1 (demo hashes) never verifies against a backend manifest', async () => {
    const m = await v2For(liveWorld()).protocol.getMarket(1n);
    expect(m.demoReport).toBe(true);
    expect((await matchClaimHash(vector.manifest, m.claimHash)).match).toBe(false);
  });
});
