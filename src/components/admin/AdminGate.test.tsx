import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorldCodePanel } from './AdminGate';

describe('World code panel', () => {
  it('shows the code, a QR of the World link, the link itself and the note', () => {
    const h = renderToStaticMarkup(
      <WorldCodePanel
        title="Sign in: confirm in World App"
        userCode="ABCD-1234"
        verificationUri="https://auth.world.org/authorize?transaction_id=t"
        note="Check that it shows this code."
      />,
    );
    expect(h).toContain('ABCD-1234');
    expect(h).toContain('href="https://auth.world.org/authorize?transaction_id=t"');
    expect(h).toContain('<svg');
    expect(h).toContain('Check that it shows this code.');
  });
  it('without a link there is no QR or World App button', () => {
    const h = renderToStaticMarkup(<WorldCodePanel title="t" userCode="X" note="n" />);
    expect(h).not.toContain('<svg');
    expect(h).not.toContain('Open World App');
  });
});
