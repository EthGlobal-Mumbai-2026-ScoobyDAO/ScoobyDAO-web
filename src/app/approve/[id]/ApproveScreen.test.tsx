import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Approval } from '@/lib/types';
import { CodePanel, Result } from './ApproveScreen';

const base: Approval = {
  id: 'att-1',
  reportId: 'shib@v1',
  status: 'pending',
  expiresAt: 1_900_000_000,
  claimHash: `0x${'aa'.repeat(32)}`,
  userCode: 'ABCD-1234',
  verificationUri: 'https://world.org/device',
  verificationUriComplete: 'https://world.org/device?user_code=ABCD1234',
};
const html = (a: Partial<Approval>) => renderToStaticMarkup(<Result approval={{ ...base, ...a }} />);

describe('approve screen states', () => {
  it('pending: large code, QR of verificationUriComplete, the World App note', () => {
    const h = renderToStaticMarkup(<CodePanel approval={base} />);
    expect(h).toContain('ABCD-1234');
    expect(h).toContain('World App shows only the requester and this code. Check the claim above before approving.');
    expect(h).toContain('href="https://world.org/device"');
    expect(h).toContain('<svg'); // QR
  });
  it('approved → "Approved — publishing…"', () => expect(html({ status: 'approved' })).toContain('Approved — publishing…'));
  it('spent → "Published onchain" with tx link; in live V2 the button opens the case file, which verifies the onchain record', () => {
    const h = html({ status: 'spent', publishTxHash: `0x${'bb'.repeat(32)}`, onchainReportId: '6' });
    expect(h).toContain('Published onchain');
    expect(h).toContain('https://sepolia.etherscan.io/tx/0x' + 'bb'.repeat(32));
    expect(h).toContain('href="/cases/shib%40v1"');
    expect(h).not.toContain('href="/case/6"');
  });
  it('denied → red banner, no case opened', () => {
    const h = html({ status: 'denied' });
    expect(h).toContain('Denied — no case opened.');
    expect(h).toContain('Draft only, no market opened.');
    expect(h).toContain('role="alert"');
  });
  it('expired → "Expired — no case opened."', () => expect(html({ status: 'expired' })).toContain('Expired — no case opened.'));
  it('rejected_not_reviewer → not an enrolled reviewer', () =>
    expect(html({ status: 'rejected_not_reviewer' })).toContain('isn&#x27;t an enrolled reviewer — nothing published.'));
  it('error → World verification unavailable', () => expect(html({ status: 'error' })).toContain('World verification unavailable — nothing published.'));
});
