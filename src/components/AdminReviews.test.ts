import { describe, expect, it } from 'vitest';
import { validateAttempt } from './AdminReviews';

const sha = 'a'.repeat(64);
const detail = {
  report_id: 'report-1',
  report_version: 'v1',
  report_sha256: sha,
  target_digest: sha,
} as Parameters<typeof validateAttempt>[1];
const attempt = {
  schema: 'scooby.admin-review-attempt/1',
  id: 'attempt-1',
  report_id: 'report-1',
  report_version: 'v1',
  target_digest: sha,
  decision: 'approve',
  reason: 'Reviewed evidence',
  binding_digest: sha,
  status: 'pending',
  expires_at: 1900000000,
  binding: {
    audience: 'scooby-admin',
    resource: `report/report-1/v1/${sha}`,
    scope: 'report_review',
    nonce: sha,
    issuedAt: 1899999900,
    expiresAt: 1900000000,
  },
  user_code: 'TEST',
  verification_uri: 'https://world.org/device',
  interval: 5,
};
describe('report review attempt binding', () => {
  it('accepts a matching pending attempt and rejects a changed decision or report', () => {
    expect(
      validateAttempt(attempt, detail, { decision: 'approve', reason: 'Reviewed evidence' }),
    ).toEqual(attempt);
    expect(() =>
      validateAttempt({ ...attempt, decision: 'reject' }, detail, {
        decision: 'approve',
        reason: 'Reviewed evidence',
      }),
    ).toThrow();
    expect(() =>
      validateAttempt(
        { ...attempt, binding: { ...attempt.binding, resource: 'report/other/v1/hash' } },
        detail,
      ),
    ).toThrow();
    expect(() =>
      validateAttempt({ ...attempt, verification_uri: 'https://world.org.evil.test' }, detail),
    ).toThrow();
  });
  it('requires a matching receipt for a confirmed decision', () => {
    expect(() => validateAttempt({ ...attempt, status: 'confirmed' }, detail)).toThrow();
    expect(() =>
      validateAttempt(
        {
          ...attempt,
          status: 'confirmed',
          receipt: { id: 'receipt-1', decision: 'reject', decided_at: 1900000000 },
        },
        detail,
      ),
    ).toThrow();
    expect(
      validateAttempt(
        {
          ...attempt,
          status: 'confirmed',
          receipt: { id: 'receipt-1', decision: 'approve', decided_at: 1900000000 },
        },
        detail,
      ).status,
    ).toBe('confirmed');
  });
});
