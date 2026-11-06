import { describe, expect, it } from 'vitest';
import { parseApproval, parseReport, ShapeError } from './guards';

const H = `0x${'aa'.repeat(32)}`;
// Shape returned by ScoobyDAO-backend/publication/web_adapter.py today.
const backendApproval = { id: 'att-1', reportId: 'shib@v1', manifestHash: H, status: 'pending', expiresAt: 1_900_000_000, userCode: 'ABCD-1234', verificationUri: 'https://world.org/device?code=x' };
const backendReport = {
  id: 'shib@v1', token: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', chainId: 1, status: 'published',
  manifest: { title: 't', token: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', claimText: 'c', chainId: 1, reportSha256: 'ab', excludedWallets: [] },
  manifestHash: H, createdAt: 1, reportSha256: 'ab', targetDigest: 'cd', publicationState: 'confirmed', revoked: false,
  approvalId: 'att-1', txHash: H, claimId: '3', onchainReportId: '3',
};

describe('API shape guards', () => {
  it('maps the backend approval (manifestHash → claimHash)', () => {
    expect(parseApproval(backendApproval)).toMatchObject({ claimHash: H, status: 'pending', userCode: 'ABCD-1234' });
  });
  it('maps the backend report (manifest → claimManifest, id → reportId@version)', () => {
    expect(parseReport(backendReport)).toMatchObject({ reportId: 'shib', version: 'v1', claimHash: H, onchainReportId: '3' });
  });
  for (const k of ['device_code', 'deviceCode', 'access_token', 'id_token', 'tokens', 'refresh_token', 'client_secret'])
    it(`rejects a secret-looking field: ${k}`, () => {
      expect(() => parseApproval({ ...backendApproval, [k]: 'x' })).toThrow(ShapeError);
    });
  it('rejects unknown fields', () => {
    expect(() => parseApproval({ ...backendApproval, surprise: 1 })).toThrow(/unexpected field/);
    expect(() => parseReport({ ...backendReport, surprise: 1 })).toThrow(/unexpected field/);
  });
  it('rejects a device code hidden inside the claim manifest', () => {
    expect(() => parseReport({ ...backendReport, manifest: { ...backendReport.manifest, device_code: 'x' } })).toThrow(ShapeError);
  });
  it('rejects unknown statuses and non-https verification links', () => {
    expect(() => parseApproval({ ...backendApproval, status: 'maybe' })).toThrow(/unknown approval status/);
    expect(() => parseApproval({ ...backendApproval, verificationUri: 'javascript:alert(1)' })).toThrow(/https/);
  });
  it('accepts the error status', () => {
    expect(parseApproval({ ...backendApproval, status: 'error', detail: 'Sign-off could not be verified; nothing was approved.' }).status).toBe('error');
  });
});
