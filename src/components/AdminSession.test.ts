import { describe, expect, it } from 'vitest';
import { parseAdminSession } from './AdminSession';
describe('admin session validation', () => {
  const pending = {
    schema: 'scooby.admin-session/1',
    state: 'pending',
    user_code: 'TEST',
    verification_uri: 'https://auth.world.org/device',
    interval: 5,
    expires_at: 1900000000,
  };
  it('accepts the configured World device session and rejects untrusted endpoints', () => {
    expect(parseAdminSession(pending).state).toBe('pending');
    expect(() =>
      parseAdminSession({ ...pending, verification_uri: 'https://world.org.evil.test/device' }),
    ).toThrow();
    expect(() =>
      parseAdminSession({ ...pending, verification_uri: 'http://auth.world.org/device' }),
    ).toThrow();
  });
  it('accepts only documented admin scopes', () => {
    expect(
      parseAdminSession({
        schema: 'scooby.admin-session/1',
        state: 'active',
        scopes: ['report_review'],
      }).state,
    ).toBe('active');
    expect(() =>
      parseAdminSession({
        schema: 'scooby.admin-session/1',
        state: 'active',
        scopes: ['arbitrary'],
      }),
    ).toThrow();
  });
});
