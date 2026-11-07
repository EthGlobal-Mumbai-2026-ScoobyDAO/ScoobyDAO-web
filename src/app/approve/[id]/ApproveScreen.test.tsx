import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Approval } from '@/lib/types';
import { CodePanel, journey, Result } from './ApproveScreen';

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
  it('pending: what you publish first, then the large code, QR, World App link and the code warning', () => {
    const h = renderToStaticMarkup(<CodePanel approval={base} />);
    expect(h).toContain('Publish onchain');
    expect(h).toContain("ScoobyDAO report registry on Ethereum Sepolia");
    expect(h.indexOf('What you’re confirming')).toBeLessThan(h.indexOf('ABCD-1234'));
    expect(h).toContain('ABCD-1234');
    expect(h).toContain('Only enter codes you started on this screen. World App shows only &#x27;ScoobyDAO&#x27; and this code — check the action above.');
    expect(h).toContain('href="https://world.org/device"');
    expect(h).toContain('<svg'); // QR
    expect(h).toContain('0xaaaaaa…aaaa'); // short claim hash with copy
  });
  it('journey stepper: Review done, Publish current, then Onchain', () => {
    expect(journey('pending').map((s) => s.state)).toEqual(['done', 'current', 'todo']);
    expect(journey('approved').map((s) => s.state)).toEqual(['done', 'done', 'current']);
    expect(journey('spent').map((s) => s.state)).toEqual(['done', 'done', 'done']);
    expect(journey('denied').map((s) => s.state)).toEqual(['done', 'failed', 'todo']);
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
