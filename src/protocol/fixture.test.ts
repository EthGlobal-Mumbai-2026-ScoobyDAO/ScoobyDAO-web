import { beforeEach, describe, expect, it } from 'vitest';
import { runPlan, type RunDeps } from '@/lib/runPlan';
import { fixture, FIXTURE_ACCOUNT, HELD_MESSAGE_ID, resetFixture, setCcipLatency, setFixtureClock } from './fixture';
import type { TxPlan } from './types';

const T = 1_900_000_000;
let now = T;
const U = 1_000_000n;
const me = FIXTURE_ACCOUNT;

const deps: RunDeps = {
  currentChainId: () => 11155111,
  switchChain: async () => {},
  send: async () => '0x01',
  confirm: async () => ({ ok: true, logs: [] }),
  decode: () => ({}),
  fakeHash: () => `0x${'ab'.repeat(32)}`,
  delay: async () => {},
  chainName: String,
};
const run = (p: TxPlan) => runPlan(p, deps);

beforeEach(() => {
  now = T;
  setFixtureClock(() => now);
  resetFixture(T);
  setCcipLatency(20);
  fixture.account = me;
});

describe('fixture scenarios', () => {
  it('has the six demo scenarios with the expected phases', async () => {
    const phases = await Promise.all((await fixture.listPublished()).map(async (id) => (await fixture.getMarket(id)).phase));
    expect(phases).toEqual(['open', 'locked', 'proposed', 'final_yes', 'void']);
    expect((await fixture.getMarket(2n)).market?.configured).toBe(true);
    const held = await fixture.getPosition(1n, me);
    expect(held.pendingCcip.map((s) => [s.messageId, s.status])).toEqual([[HELD_MESSAGE_ID, 'held']]);
  });
});

describe('stake flow on the fixture protocol', () => {
  it('adds an approve step only when the allowance is short', async () => {
    const first = await fixture.stakeLocal(1n, true, 10n * U, me);
    expect(first.map((s) => s.label)).toEqual(['Approve dUSD', 'Stake Yes']);
    expect((await run(first)).ok).toBe(true);
    const second = await fixture.stakeLocal(1n, true, 10n * U, me);
    expect(second.map((s) => s.label)).toEqual(['Stake Yes']);
    expect((await run(second)).ok).toBe(true);
    expect((await fixture.getMarket(1n)).totals.yes).toBe(140n * U);
    expect((await fixture.getPosition(1n, me)).yes).toBe(20n * U);
  });

  it('reverts TokenCallFailed on insufficient balance', async () => {
    const r = await run(await fixture.stakeLocal(1n, false, 10_000n * U, me));
    expect(r).toMatchObject({ ok: false, reason: 'TokenCallFailed' });
  });

  it('stakes only before lockTime (CLOSED at lockTime)', async () => {
    const m = await fixture.getMarket(1n);
    const plan = await fixture.stakeLocal(1n, true, U, me);
    now = m.lockTime - 1;
    expect((await run(plan)).ok).toBe(true);
    now = m.lockTime;
    expect(await run(await fixture.stakeLocal(1n, true, U, me))).toMatchObject({ ok: false, reason: 'CLOSED' });
  });
});

describe('CCIP on the fixture protocol', () => {
  it('only before the cutoff (REMOTE_CLOSED at the cutoff)', async () => {
    const m = await fixture.getMarket(1n);
    now = m.crossChainCutoff;
    expect(await run(await fixture.stakeRemote!(1n, true, U, me))).toMatchObject({ ok: false, reason: 'REMOTE_CLOSED' });
  });

  it('sent → in transit → credited, and the credit counts in totals', async () => {
    const r = await run(await fixture.stakeRemote!(1n, true, 5n * U, me));
    expect(r.ok).toBe(true);
    const id = r.effect.messageId!;
    expect((await fixture.trackCcip(id))?.status).toBe('in_transit');
    now += 25;
    expect((await fixture.trackCcip(id))?.status).toBe('credited');
    expect((await fixture.getMarket(1n)).totals.yes).toBe(125n * U);
  });

  it('a message delivered after lock is Held, not counted, and recoverable by the recipient', async () => {
    const m = await fixture.getMarket(1n);
    setCcipLatency(2 * 3600); // a slow lane: sent before the cutoff, delivered after lock
    now = m.crossChainCutoff - 5;
    const r = await run(await fixture.stakeRemote!(1n, false, 3n * U, me));
    const id = r.effect.messageId!;
    now = m.crossChainCutoff + 600;
    expect((await fixture.trackCcip(id))?.status).toBe('in_transit');
    now = m.crossChainCutoff - 5 + 2 * 3600;
    expect((await fixture.trackCcip(id))).toMatchObject({ status: 'held', recoverable: 3n * U, recoveryRecipient: me });
    expect((await fixture.getMarket(1n)).totals.no).toBe(45n * U);
    expect((await run(await fixture.recoverCcip!(id, me))).ok).toBe(true);
    expect((await fixture.trackCcip(id))?.status).toBe('recovered');
  });

  it('the seeded late message is Held → Recover returns the dUSD', async () => {
    await fixture.getPosition(1n, me);
    const before = (await fixture.getPosition(1n, me)).dusdBalance;
    const held = await fixture.trackCcip(HELD_MESSAGE_ID);
    expect(held).toMatchObject({ status: 'held', recoverable: 7n * U, recoveryRecipient: me });
    expect((await run(await fixture.recoverCcip!(HELD_MESSAGE_ID, me))).ok).toBe(true);
    expect((await fixture.trackCcip(HELD_MESSAGE_ID))?.status).toBe('recovered');
    expect((await fixture.getPosition(1n, me)).dusdBalance).toBe(before + 7n * U);
    expect(await run(await fixture.recoverCcip!(HELD_MESSAGE_ID, me))).toMatchObject({ ok: false, reason: 'NO_FUNDS' });
  });
});

describe('settlement on the fixture protocol', () => {
  it('challenge window: challenge before the end, finalize only at/after it', async () => {
    const m = await fixture.getMarket(3n);
    const end = m.decision!.proposedAt + m.challengePeriod;
    now = end - 1;
    expect(await run(await fixture.finalize(3n))).toMatchObject({ ok: false, reason: 'PENDING' });
    now = end;
    expect(await run(await fixture.challenge(3n, '0x01'))).toMatchObject({ ok: false, reason: 'CHALLENGE_WINDOW' });
    expect((await run(await fixture.finalize(3n))).ok).toBe(true);
    expect((await fixture.getMarket(3n)).phase).toBe('final_yes');
  });

  it('a challenge inside the window blocks finalize', async () => {
    expect((await run(await fixture.challenge(3n, '0x01'))).ok).toBe(true);
    expect((await fixture.getMarket(3n)).phase).toBe('challenged');
    now += 3600;
    expect((await run(await fixture.finalize(3n))).ok).toBe(false);
  });

  it('final Yes 80/20: redeem pays 1.20 per winning unit', async () => {
    const pos = await fixture.getPosition(4n, me);
    expect(pos.redeemable).toBe(24n * U);
    const r = await run(await fixture.redeem(4n, true, 20n * U));
    expect(r.effect.paid).toBe(24n * U);
    expect((await fixture.getPosition(4n, me)).yes).toBe(0n);
  });

  it('Void refunds principal with no fee', async () => {
    const r = await run(await fixture.redeem(5n, false, 15n * U));
    expect(r.effect.paid).toBe(15n * U);
  });

  it('finalize after the result deadline is Void', async () => {
    const m = await fixture.getMarket(1n);
    now = m.resultDeadline + 1;
    expect((await run(await fixture.finalize(1n))).ok).toBe(true);
    expect((await fixture.getMarket(1n)).phase).toBe('void');
  });
});
