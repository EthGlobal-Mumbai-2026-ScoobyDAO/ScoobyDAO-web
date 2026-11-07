import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  shortDigest,
  spelledCode,
  TWO_STEP_NOTE,
  WORLD_WARNING,
  WorldConfirm,
  worldSteps,
  type WorldPhase,
} from './WorldConfirm';

const DIGEST = `0x${'ab'.repeat(32)}`;
const html = (phase: WorldPhase, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    <WorldConfirm
      action="approve"
      phase={phase}
      subject="SHIB"
      version="run-1"
      digest={DIGEST}
      reason="Evidence checks out"
      userCode="ABCD-1234"
      qrValue="https://world.org/device?user_code=ABCD1234"
      openUrl="https://world.org/device"
      expiresAt={1_900_000_000}
      onCancel={() => {}}
      onNext={() => {}}
      {...extra}
    />,
  );

describe('WorldConfirm', () => {
  it('waiting: what you confirm first, then the code, QR, World App link, warning and Cancel', () => {
    const h = html('waiting');
    expect(h.indexOf('What you’re confirming')).toBeLessThan(h.indexOf('Your code'));
    expect(h).toContain('Approve report');
    expect(h).toContain('SHIB');
    expect(h).toContain('Evidence checks out');
    expect(h).toContain('Approving makes this version public. Nothing goes onchain yet.');
    expect(h).toContain(shortDigest(DIGEST));
    expect(h).toContain('ABCD-1234');
    expect(h).toContain('Code: A B C D - 1 2 3 4'); // spelled out for screen readers
    expect(h).toContain('<svg'); // QR
    expect(h).toContain('href="https://world.org/device"');
    expect(h).toContain('Waiting for World App…');
    expect(h).toContain(WORLD_WARNING.replace(/'/g, '&#x27;'));
    expect(h).toContain('>Cancel<');
    expect(h).toContain('aria-live="polite"');
  });
  it('explains the two-step model in an InfoTip trigger (popover closed by default)', () => {
    const h = html('waiting');
    expect(h).toContain('aria-label="Why World ID asks again"');
    expect(h).not.toContain(TWO_STEP_NOTE.replace(/'/g, '&#x27;'));
  });
  it('without a link there is no QR or Open World App button', () => {
    const h = html('waiting', { qrValue: undefined, openUrl: undefined });
    expect(h).not.toContain('Scan with World App');
    expect(h).not.toContain('Open World App');
  });
  it('start: a start button and no code', () => {
    const h = html('start', { onStart: () => {}, startLabel: 'Open with World ID' });
    expect(h).toContain('Open with World ID');
    expect(h).not.toContain('Your code');
  });
  it.each([
    ['confirmed', 'Confirmed in World App', 'Sniff holding up a pulled-off mask'],
    ['denied', 'Denied in World App', 'Nothing was recorded.'],
    ['expired', 'The code expired', 'Get a new code'],
    ['not_permitted', 'This World ID isn&#x27;t an enrolled reviewer', 'Nothing was recorded.'],
    ['failed', 'World couldn&#x27;t confirm', 'Try again'],
    ['superseded', 'The report changed', 'Review the new version'],
  ] as const)('%s: full-panel result with Sniff and one next action', (phase, title, more) => {
    const h = html(phase);
    expect(h).toContain(title);
    expect(h).toContain(more);
    expect(h).not.toContain('Your code');
    expect(h).not.toContain('ABCD-1234');
  });
  it('failures are alerts; open says nothing was opened', () => {
    const h = html('denied', { action: 'open' });
    expect(h).toContain('role="alert"');
    expect(h).toContain('Nothing was opened.');
  });
  it('stepper: start → waiting → done, failures mark step 2', () => {
    expect(worldSteps('start')).toEqual(['current', 'todo', 'todo']);
    expect(worldSteps('waiting')).toEqual(['done', 'current', 'todo']);
    expect(worldSteps('confirmed')).toEqual(['done', 'done', 'done']);
    expect(worldSteps('expired')).toEqual(['done', 'failed', 'todo']);
  });
  it('helpers', () => {
    expect(spelledCode('AB-1')).toBe('A B - 1');
    expect(shortDigest(DIGEST)).toBe('0xababab…abab');
    expect(shortDigest('abc')).toBe('abc');
  });
});
