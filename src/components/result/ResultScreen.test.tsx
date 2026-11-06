import { beforeEach, describe, expect, it } from 'vitest';
import { fixture, resetFixture, setFixtureClock } from '@/protocol/fixture';
import { canChallenge, canFinalize, challengeEnds } from '@/protocol/phase';
import type { MarketView } from '@/protocol/types';
import { timelineSteps } from './ResultScreen';

const T = 1_900_000_000;
let now = T;
beforeEach(() => {
  now = T;
  setFixtureClock(() => now);
  resetFixture(T);
});

const states = (m: MarketView, t: number) => timelineSteps(m, t).map((s) => `${s.label}:${s.state}`);

describe('result page per phase (fixture scenarios)', () => {
  it('open: every later step is listed with its date or rule, none active', async () => {
    const m = await fixture.getMarket(1n);
    expect(states(m, now)).toEqual(['Locked:current', 'Matured:todo', 'Proposed:todo', 'Challenge window:todo', 'Final:todo']);
    const steps = timelineSteps(m, now);
    expect(steps[1].at).toBe(m.maturity);
    expect(steps[2].note).toMatch(/from maturity/);
    expect(steps.at(-1)!.note).toMatch(/Void if nothing is final by the result deadline/);
    expect(canFinalize(m, now)).toBe(false);
  });
  it('locked', async () => {
    const m = await fixture.getMarket(2n);
    expect(states(m, now).slice(0, 2)).toEqual(['Locked:done', 'Matured:current']);
  });
  it('proposed, inside the challenge window', async () => {
    const m = await fixture.getMarket(3n);
    expect(states(m, now)).toContain('Proposed: YES:done');
    expect(states(m, now)).toContain('Challenge window:current');
    expect(canChallenge(m, now)).toBe(true);
  });
  it('challenge-window edge: exactly at proposedAt + challengePeriod', async () => {
    const m = await fixture.getMarket(3n);
    const end = challengeEnds(m)!;
    expect(canChallenge(m, end - 1)).toBe(true);
    expect(canChallenge(m, end)).toBe(false);
    expect(canFinalize(m, end - 1)).toBe(false);
    expect(canFinalize(m, end)).toBe(true);
    expect(states(m, end)).toContain('Challenge window:done');
  });
  it('final Yes, then the 90-day claims window', async () => {
    const m = await fixture.getMarket(4n);
    expect(states(m, now).slice(-2)).toEqual(['Final: Yes:done', 'Claims close:current']);
    const closes = m.decision!.finalizedAt! + 90 * 86_400;
    expect(states(m, closes).at(-1)).toBe('Claims close:current');
    expect(states(m, closes + 1).at(-1)).toBe('Claims expired:done');
  });
  it('Void flow: final step is Void and redeem refunds without fee', async () => {
    const m = await fixture.getMarket(5n);
    expect(states(m, now)).toContain('Void:done');
    fixture.account = (await import('@/protocol/fixture')).FIXTURE_ACCOUNT;
    const pos = await fixture.getPosition(5n, fixture.account);
    expect(pos.redeemable).toBe(15_000_000n);
  });
  it('challenged adds the adjudicator step', async () => {
    const plan = await fixture.challenge(3n, '0x01');
    plan[0].fixture!();
    const m = await fixture.getMarket(3n);
    expect(m.phase).toBe('challenged');
    expect(states(m, now)).toContain('Challenged: the adjudicator decides:current');
  });
});
