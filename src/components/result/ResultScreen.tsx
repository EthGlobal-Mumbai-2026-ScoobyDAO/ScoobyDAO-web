'use client';

import { CheckCircle2, Circle, CircleDot, FileUp } from 'lucide-react';
import { useState } from 'react';
import { CaseFrame, CaseHeader } from '@/components/case/CaseHeader';
import { useCase } from '@/components/case/useCase';
import { Countdown } from '@/components/Countdown';
import { HashText } from '@/components/HashText';
import { SimulatedYieldLabel } from '@/components/HonestyLabels';
import { MaskPop } from '@/components/MaskPop';
import { SniffPose } from '@/components/SniffPose';
import { TxPlanStepper, usePlan } from '@/components/TxPlanStepper';
import { env } from '@/lib/env';
import { formatDate, formatUsdc } from '@/lib/format';
import { evidenceHash } from '@/lib/hash';
import { payoutFor } from '@/lib/payout';
import { canChallenge, canFinalize, challengeEnds, isFinal, type MarketView, type PositionView } from '@/protocol';
import { useActiveAccount, useChainTime, usePosition, useProtocol } from '@/protocol/hooks';
import { RepCard } from './RepCard';

export function ResultScreen({ id }: { id: string }) {
  const { market, report } = useCase(id);
  return (
    <CaseFrame state={market}>
      {market.data && (
        <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:py-10">
          <CaseHeader market={market.data} report={report} tab="result" />
          <Verdict market={market.data} />
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <SettlementTimeline market={market.data} />
            <div className="space-y-6">
              <ChallengeForm market={market.data} />
              <FinalizeButton market={market.data} />
            </div>
          </div>
          <ClaimsPanel market={market.data} />
        </main>
      )}
    </CaseFrame>
  );
}

/** Unmasked! on Finalized(id, Yes); "Case closed — cleared." on No; neutral on Void. */
export function Verdict({ market: m }: { market: MarketView }) {
  if (m.phase === 'final_yes')
    return (
      <section className="glass flex flex-wrap items-center gap-6 p-6" aria-live="polite">
        <MaskPop claimId={m.reportId.toString()} className="h-36 w-36" />
        <div>
          <p className="font-display text-beam-ink text-5xl">Unmasked!</p>
          <p className="mt-2 text-lg">Final result: Yes. Each Yes unit redeems {formatUsdc(payoutFor('yes', 'yes', 1_000_000n, m.totals), { exact: true })} dUSD.</p>
        </div>
      </section>
    );
  if (m.phase === 'final_no')
    return (
      <section className="glass flex flex-wrap items-center gap-6 p-6" aria-live="polite">
        <SniffPose pose="shrug" size={110} />
        <div>
          <p className="font-display text-4xl">Case closed — cleared.</p>
          <p className="mt-2 text-lg">Final result: No. Each No unit redeems {formatUsdc(payoutFor('no', 'no', 1_000_000n, m.totals), { exact: true })} dUSD.</p>
        </div>
      </section>
    );
  if (m.phase === 'void')
    return (
      <section className="glass p-6" aria-live="polite">
        <p className="font-display text-4xl">No verdict — stakes refunded.</p>
        <p className="mt-2 text-lg">Void: every position redeems its principal pro rata. No fee is taken.</p>
      </section>
    );
  return null;
}

type Step = { label: string; at?: number; state: 'done' | 'current' | 'todo'; detail?: React.ReactNode };

export function timelineSteps(m: MarketView, now: number): Step[] {
  const d = m.decision;
  const end = challengeEnds(m);
  const final = isFinal(m.phase);
  const proposed = !!d && d.proposedAt > 0;
  return [
    { label: 'Locked', at: m.lockTime, state: now >= m.lockTime ? 'done' : 'current' },
    { label: 'Matured', at: m.maturity, state: now >= m.maturity || proposed || final ? 'done' : now >= m.lockTime ? 'current' : 'todo' },
    {
      label: proposed ? `Proposed: ${d!.proposed?.toUpperCase() ?? '—'}` : 'Proposed',
      at: proposed ? d!.proposedAt : undefined,
      state: proposed || final ? 'done' : m.phase === 'matured' ? 'current' : 'todo',
    },
    {
      label: 'Challenge window',
      at: end,
      state: !proposed ? 'todo' : d!.challenged || final || (end !== undefined && now >= end) ? 'done' : 'current',
    },
    ...(d?.challenged ? [{ label: 'Challenged: the adjudicator decides', state: (final ? 'done' : 'current') as Step['state'] }] : []),
    {
      label: m.phase === 'void' ? 'Void' : final ? `Final: ${m.phase === 'final_yes' ? 'Yes' : 'No'}` : 'Final',
      at: d?.finalizedAt,
      state: final ? 'done' : 'todo',
    },
  ];
}

function SettlementTimeline({ market: m }: { market: MarketView }) {
  const now = useChainTime() ?? m.chainTime;
  const end = challengeEnds(m);
  return (
    <section aria-labelledby="tl-h" className="glass p-5 sm:p-6">
      <h2 id="tl-h" className="font-display text-2xl">
        Settlement
      </h2>
      <ol className="mt-4 space-y-4">
        {timelineSteps(m, now).map((s) => (
          <li key={s.label} className="flex gap-3">
            {s.state === 'done' ? (
              <CheckCircle2 className="text-clue-ink mt-0.5 shrink-0" size={20} aria-hidden />
            ) : s.state === 'current' ? (
              <CircleDot className="text-beam-ink mt-0.5 shrink-0" size={20} aria-hidden />
            ) : (
              <Circle className="text-muted mt-0.5 shrink-0" size={20} aria-hidden />
            )}
            <div>
              <p className="font-semibold">
                {s.label}
                <span className="sr-only"> ({s.state})</span>
              </p>
              {s.at ? <p className="text-muted text-sm">{formatDate(s.at)}</p> : null}
              {s.label === 'Challenge window' && s.state === 'current' && end && (
                <p className="text-sm">
                  Closes in <Countdown to={end} now={now} className="font-semibold" endedLabel="now" />
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {m.decision && m.decision.proposedAt > 0 && (
        <div className="border-line mt-5 border-t pt-4">
          <p className="text-muted text-sm">Evidence hash</p>
          <HashText value={m.decision.evidenceHash} label="evidence hash" />
        </div>
      )}
    </section>
  );
}

export function ChallengeForm({ market: m }: { market: MarketView }) {
  const { protocol } = useProtocol();
  const now = useChainTime() ?? m.chainTime;
  const plan = usePlan();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const open = canChallenge(m, now);
  if (!open) return null;
  return (
    <section aria-labelledby="ch-h" className="glass space-y-3 p-5">
      <h2 id="ch-h" className="font-display text-xl">
        Challenge the proposal
      </h2>
      <p className="text-sm">No bond is required; the adjudicator decides.</p>
      <label className="block text-sm">
        <span className="text-muted">Evidence (a URL or text)</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFile(null);
            setHash(null);
          }}
          rows={3}
          className="border-line focus:border-beam mt-1 w-full rounded-xl border bg-transparent p-2 outline-none"
        />
      </label>
      <label className="text-muted inline-flex cursor-pointer items-center gap-2 text-sm">
        <FileUp size={16} aria-hidden /> or upload a file
        <input
          type="file"
          className="sr-only"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setText('');
            setHash(null);
          }}
        />
      </label>
      {file && <p className="text-sm">{file.name}</p>}
      <button
        type="button"
        disabled={!text.trim() && !file}
        onClick={async () => setHash(await evidenceHash(file ?? text.trim()))}
        className="border-line rounded-lg border px-3 py-1.5 text-sm font-semibold hover:border-[var(--fog-400)] disabled:opacity-50"
      >
        Hash evidence (SHA-256, in this browser)
      </button>
      {hash && (
        <>
          <HashText value={hash} label="evidence hash" />
          <button
            type="button"
            disabled={plan.running}
            onClick={() => void plan.start(() => protocol.challenge(m.reportId, hash))}
            className="bg-beam text-on-beam block rounded-xl px-4 py-2.5 font-semibold hover:brightness-105 disabled:opacity-60"
          >
            Challenge with this hash
          </button>
        </>
      )}
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
    </section>
  );
}

export function FinalizeButton({ market: m }: { market: MarketView }) {
  const { protocol } = useProtocol();
  const now = useChainTime() ?? m.chainTime;
  const plan = usePlan();
  if (isFinal(m.phase)) return null;
  const ready = canFinalize(m, now);
  const end = challengeEnds(m);
  const why =
    m.phase === 'challenged'
      ? 'Challenged: only the adjudicator can settle it now (or anyone after the result deadline, as Void).'
      : m.phase === 'proposed' && end
        ? `The challenge window is still open until ${formatDate(end)}.`
        : `Waiting for a proposal. After the result deadline (${formatDate(m.resultDeadline)}) anyone can finalize as Void.`;
  return (
    <section aria-labelledby="fin-h" className="glass space-y-3 p-5">
      <h2 id="fin-h" className="font-display text-xl">
        Finalize
      </h2>
      <p className="text-sm">Anyone can finalize — nothing happens automatically.</p>
      {!ready && <p className="text-muted text-sm">{why}</p>}
      {ready && now > m.resultDeadline && <p className="text-beam-ink text-sm">The result deadline has passed, so finalizing makes this case Void.</p>}
      <button
        type="button"
        disabled={!ready || plan.running}
        onClick={() => void plan.start(() => protocol.finalize(m.reportId))}
        className="bg-beam text-on-beam rounded-xl px-4 py-2.5 font-semibold hover:brightness-105 disabled:opacity-50"
      >
        Finalize case #{m.reportId.toString()}
      </button>
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
    </section>
  );
}

/** Three separate claims; never merged into one button. */
function ClaimsPanel({ market: m }: { market: MarketView }) {
  const position = usePosition(m.reportId, m.blockNumber);
  const { address } = useActiveAccount();
  return (
    <section aria-labelledby="claims-h" className="space-y-4">
      <h2 id="claims-h" className="font-display text-2xl">
        Claims
      </h2>
      {!address ? (
        <p className="text-muted">Connect a wallet to see what you can claim.</p>
      ) : position.isLoading || !position.data ? (
        <div className="sweep h-40" aria-busy="true" aria-label="Loading your positions" />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <RedeemCard market={m} pos={position.data} />
          <YieldCard market={m} pos={position.data} />
          {env.repEnabled ? (
            <RepCard market={m} pos={position.data} />
          ) : (
            <div className="glass p-5">
              <h3 className="font-semibold">REP badge</h3>
              <p className="text-muted mt-2 text-sm">Coming soon: one reputation badge per verified human (World ID).</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function RedeemCard({ market: m, pos }: { market: MarketView; pos: PositionView }) {
  const { protocol } = useProtocol();
  const plan = usePlan();
  const outcome = m.decision?.outcome;
  const sides = (['yes', 'no'] as const).filter((s) => pos[s] > 0n);
  return (
    <div className="glass space-y-3 p-5">
      <h3 className="font-semibold">Redeem position</h3>
      {!outcome ? (
        <p className="text-muted text-sm">Available once the case is final.</p>
      ) : sides.length === 0 ? (
        <p className="text-muted text-sm">You have no position left to redeem.</p>
      ) : (
        sides.map((s) => {
          const pay = payoutFor(outcome, s, pos[s], m.totals);
          return (
            <div key={s} className="space-y-1">
              <p className="text-sm">
                {formatUsdc(pos[s])} {s === 'yes' ? 'Yes' : 'No'} →{' '}
                <span className="num font-semibold">{formatUsdc(pay, { exact: true })}</span> dUSD
                {outcome === 'void' && <span className="text-muted"> (refund pro rata, no fee)</span>}
              </p>
              {pay > 0n && outcome !== 'void' && (
                <p className="text-muted num text-xs">
                  {formatUsdc(payoutFor(outcome, s, 1_000_000n, m.totals), { exact: true })} per unit
                </p>
              )}
              <button
                type="button"
                disabled={plan.running}
                onClick={() => void plan.start(() => protocol.redeem(m.reportId, s === 'yes', pos[s]))}
                className="bg-beam text-on-beam rounded-xl px-4 py-2 text-sm font-semibold hover:brightness-105 disabled:opacity-60"
              >
                {pay > 0n ? `Redeem ${s === 'yes' ? 'Yes' : 'No'}` : `Burn ${s === 'yes' ? 'Yes' : 'No'} (pays 0)`}
              </button>
            </div>
          );
        })
      )}
      {plan.result?.ok && plan.result.effect.paid !== undefined && (
        <p className="text-clue-ink text-sm" role="status">
          Received {formatUsdc(plan.result.effect.paid, { exact: true })} dUSD.
        </p>
      )}
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
    </div>
  );
}

function YieldCard({ market: m, pos }: { market: MarketView; pos: PositionView }) {
  const { protocol } = useProtocol();
  const plan = usePlan();
  const { address } = useActiveAccount();
  return (
    <div className="glass space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Claim yield</h3>
        <SimulatedYieldLabel />
      </div>
      {!m.yt ? (
        <p className="text-muted text-sm">No YT series yet (it is issued at lock).</p>
      ) : (
        <>
          <p className="text-sm">
            YT balance <span className="num">{formatUsdc(pos.yt)}</span> · claimable{' '}
            <span className="num font-semibold">{formatUsdc(pos.ytClaimable, { exact: true })}</span> dUSD
          </p>
          <p className="text-muted text-xs">Includes only yield already checkpointed into the YT; claiming checkpoints the vault first if needed.</p>
          <button
            type="button"
            disabled={plan.running || (pos.ytClaimable === 0n && pos.yt === 0n)}
            onClick={() => void plan.start(() => protocol.claimYield(m.reportId, address!))}
            className="bg-beam text-on-beam rounded-xl px-4 py-2 text-sm font-semibold hover:brightness-105 disabled:opacity-50"
          >
            Claim yield
          </button>
        </>
      )}
      {plan.result?.ok && plan.result.effect.paid !== undefined && (
        <p className="text-clue-ink text-sm" role="status">
          Received {formatUsdc(plan.result.effect.paid, { exact: true })} dUSD.
        </p>
      )}
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
    </div>
  );
}

