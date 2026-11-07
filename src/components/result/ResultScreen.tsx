'use client';

import { CheckCircle2, Circle, CircleDot, FileUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { casePath, CaseFrame, CaseHeader, type CaseBase } from '@/components/case/CaseHeader';
import { useCase } from '@/components/case/useCase';
import { Countdown } from '@/components/Countdown';
import { WritesBlockedNote } from '@/components/forms';
import { HashText } from '@/components/HashText';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Card, EmptyState, KeyValue, LoadState, Page, TechnicalDetails } from '@/components/ui';
import { MaskPop } from '@/components/MaskPop';
import { SniffPose } from '@/components/SniffPose';
import { TxPlanStepper, usePlan } from '@/components/TxPlanStepper';
import { env } from '@/lib/env';
import { formatDate, formatDuration, formatUsdc } from '@/lib/format';
import { evidenceHash } from '@/lib/hash';
import { estimatePaid, feeOf } from '@/lib/payout';
import {
  canChallenge,
  canFinalize,
  canPropose,
  challengeEnds,
  claimPrincipalOpen,
  claimsCloseAt,
  claimsExpired,
  isFinal,
  type MarketView,
  type PositionView,
} from '@/protocol';
import { useActiveAccount, useChainTime, usePosition, useProtocol, useWritesAllowed } from '@/protocol/hooks';
import { REPUTATION_BADGE_TITLE, ReputationBadgeCard } from './ReputationBadgeCard';

export function ResultScreen({ id, base = '/case' }: { id: string; base?: CaseBase }) {
  const { market, report } = useCase(id, base);
  return (
    <CaseFrame state={market}>
      {market.data && (
        <Page>
          <CaseHeader market={market.data} report={report} tab="result" base={base} facts={['testToken', 'simulatedYield', 'estimate']} />
          {market.data.series === false ? (
            <Card>
              <EmptyState pose="thinking" title="Nothing to settle yet">
                This report is published onchain, but no market was deployed for it, so there is nothing to settle or claim.
              </EmptyState>
            </Card>
          ) : (
            <div className="space-y-8">
              <Verdict market={market.data} />
              {isFinal(market.data.phase) && <ClaimsPanel market={market.data} base={base} />}
              <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
                <SettlementTimeline market={market.data} />
                <div className="space-y-6">
                  {isFinal(market.data.phase) && <ResultSummary market={market.data} />}
                  <ChallengeForm market={market.data} />
                  <FinalizeButton market={market.data} />
                  <DemoVerdict market={market.data} />
                </div>
              </div>
              {!isFinal(market.data.phase) && <ClaimsPanel market={market.data} base={base} />}
            </div>
          )}
        </Page>
      )}
    </CaseFrame>
  );
}

/** Final numbers in one card: outcome, pools, fee and what each winning unit claims. */
function ResultSummary({ market: m }: { market: MarketView }) {
  const d = m.decision;
  const outcome = d?.outcome;
  const oneSided = m.totals.yes === 0n || m.totals.no === 0n;
  const fee = !outcome || outcome === 'void' || oneSided ? 0n : feeOf(outcome === 'yes' ? m.totals.no : m.totals.yes);
  return (
    <Card title="Final numbers">
      <KeyValue
        items={[
          { label: 'Result', value: <span className="font-semibold">{outcome === 'void' ? 'Void' : outcome === 'yes' ? 'Yes' : 'No'}</span> },
          ...(d?.finalizedAt ? [{ label: 'Final since', value: formatDate(d.finalizedAt) }] : []),
          { label: 'Yes pool', value: <span className="num">{formatUsdc(m.totals.yes)} dUSD</span> },
          { label: 'No pool', value: <span className="num">{formatUsdc(m.totals.no)} dUSD</span> },
          { label: 'Fee (20% of the losing pool)', value: <span className="num">{formatUsdc(fee)} dUSD</span> },
          ...(outcome && outcome !== 'void'
            ? [{ label: `Each ${outcome === 'yes' ? 'Yes' : 'No'} unit claims`, value: <span className="num font-semibold">{formatUsdc(perUnit(m, outcome), { exact: true })} dUSD</span> }]
            : []),
        ]}
      />
    </Card>
  );
}

const DEMO_VERDICT = 'Yes this token price went down by 80% and report already showed it suspicious, so yes it is a suspicious token';

function DemoVerdict({ market: m }: { market: MarketView }) {
  const { protocol } = useProtocol();
  const { address } = useActiveAccount();
  const writes = useWritesAllowed();
  const plan = usePlan();
  const now = useChainTime() ?? m.chainTime;
  const [shown, setShown] = useState(false);
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  if (isFinal(m.phase) || (m.decision?.proposedAt ?? 0) > 0) return null;

  const resolver = address?.toLowerCase() === m.resolver.toLowerCase();
  const proposalOpen = canPropose(m, now);
  const accept = async () => {
    const verdictHash = hash ?? (await evidenceHash(DEMO_VERDICT));
    setHash(verdictHash);
    await plan.start(() => protocol.propose!(m.reportId, 'yes', verdictHash));
  };

  return (
    <section aria-labelledby="demo-verdict-h" className="glass space-y-3 p-5 sm:p-6">
      <div>
        <h2 id="demo-verdict-h" className="text-lg font-semibold">Demo verdict <span className="text-muted text-sm font-normal">· resolver only</span></h2>
        <p className="text-muted mt-1 text-[13px]">Hardcoded demo text — not calculated by an oracle or price feed.</p>
      </div>
      {!shown ? (
        <button type="button" onClick={() => setShown(true)} className="bg-beam text-on-beam rounded-xl px-4 py-2.5 font-semibold hover:brightness-105">
          Get verdict
        </button>
      ) : (
        <>
          <p className="text-[15px] font-semibold">{DEMO_VERDICT}</p>
          <p className="text-muted text-sm">Accepting proposes <strong>Yes</strong> onchain with the SHA-256 hash of this text. It still requires the challenge window and finalization.</p>
          {!proposalOpen && <p className="text-muted text-sm">Onchain acceptance opens at maturity ({formatDate(m.maturity)}) and closes at the result deadline ({formatDate(m.resultDeadline)}).</p>}
          {proposalOpen && !resolver && <p className="text-mask-ink text-sm">Connect the resolver wallet <span className="num break-all">{m.resolver}</span> to accept this verdict onchain.</p>}
          <WritesBlockedNote />
          <button
            type="button"
            disabled={!protocol.propose || !proposalOpen || !resolver || !writes.allowed || plan.running}
            onClick={() => void accept()}
            className="bg-beam text-on-beam rounded-xl px-4 py-2.5 font-semibold hover:brightness-105 disabled:opacity-50"
          >
            {plan.running ? 'Proposing Yes…' : 'Accept verdict and propose Yes onchain'}
          </button>
          <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
        </>
      )}
    </section>
  );
}

/** Per-unit claim after finalization: nominal payout scaled by the principal the vault had left. */
const perUnit = (m: MarketView, side: 'yes' | 'no') => estimatePaid(m.decision!.outcome!, side, 1_000_000n, m.totals, m.principalAvailable);

/** Unmasked! on a final Yes; "Case closed — cleared." on No; neutral on Void. */
export function Verdict({ market: m }: { market: MarketView }) {
  if (m.phase === 'final_yes')
    return (
      <section className="glass flex flex-wrap items-center gap-6 p-6" aria-live="polite">
        <MaskPop claimId={m.reportId.toString()} className="h-36 w-36" />
        <div>
          <p className="font-display text-beam-ink text-5xl">Unmasked!</p>
          <p className="mt-2 text-lg">Final result: Yes. Each Yes unit claims {formatUsdc(perUnit(m, 'yes'), { exact: true })} dUSD; No pays 0.</p>
        </div>
      </section>
    );
  if (m.phase === 'final_no')
    return (
      <section className="glass flex flex-wrap items-center gap-6 p-6" aria-live="polite">
        <SniffPose pose="shrug" size={110} />
        <div>
          <p className="font-display text-4xl">Case closed — cleared.</p>
          <p className="mt-2 text-lg">Final result: No. Each No unit claims {formatUsdc(perUnit(m, 'no'), { exact: true })} dUSD; Yes pays 0.</p>
        </div>
      </section>
    );
  if (m.phase === 'void')
    return (
      <section className="glass p-6" aria-live="polite">
        <p className="font-display text-4xl">No verdict — stakes returned.</p>
        <p className="mt-2 text-lg">Void: every position claims its principal back (scaled only if a simulated loss reduced it). No fee is taken.</p>
      </section>
    );
  return null;
}

type Step = { label: string; at?: number; note?: string; state: 'done' | 'current' | 'todo' };

/**
 * Open → Locked → Matured → Proposed → challenge window → (challenged: adjudicated) → Final or Void →
 * claims close (finalized + 90 days). Future steps carry their dates; nothing here enables a button.
 */
export function timelineSteps(m: MarketView, now: number): Step[] {
  const d = m.decision;
  const end = challengeEnds(m);
  const final = isFinal(m.phase);
  const proposed = !!d && d.proposedAt > 0;
  const closes = claimsCloseAt(m);
  const steps: Step[] = [
    ...(now < m.lockTime ? [{ label: 'Open to staking', state: 'current' as const }] : []),
    { label: 'Locked', at: m.lockTime, state: now >= m.lockTime ? 'done' : 'todo' },
    { label: 'Matured', at: m.maturity, state: now >= m.maturity || proposed || final ? 'done' : now >= m.lockTime ? 'current' : 'todo' },
    {
      label: proposed ? `Proposed: ${d!.proposed?.toUpperCase() ?? '—'}` : 'Proposed',
      at: proposed ? d!.proposedAt : undefined,
      note: proposed ? undefined : `The resolver can propose from maturity (${formatDate(m.maturity)}) until the result deadline.`,
      state: proposed || final ? 'done' : m.phase === 'matured' ? 'current' : 'todo',
    },
    {
      label: 'Challenge window',
      at: end,
      note: end ? undefined : `${formatDuration(m.challengePeriod)} after a proposal; anyone may challenge with an evidence hash.`,
      state: !proposed ? 'todo' : d!.challenged || final || (end !== undefined && now >= end) ? 'done' : 'current',
    },
    ...(d?.challenged ? [{ label: 'Challenged: the adjudicator decides', state: (final ? 'done' : 'current') as Step['state'] }] : []),
    {
      label: m.phase === 'void' ? 'Void' : final ? `Final: ${m.phase === 'final_yes' ? 'Yes' : 'No'}` : 'Final',
      at: d?.finalizedAt,
      note: final ? undefined : `Void if nothing is final by the result deadline (${formatDate(m.resultDeadline)}).`,
      state: final ? 'done' : 'todo',
    },
  ];
  if (closes !== undefined)
    steps.push({ label: claimsExpired(m, now) ? 'Claims expired' : 'Claims close', at: closes, note: '90 days after the result is final.', state: claimsExpired(m, now) ? 'done' : 'current' });
  return steps;
}

function SettlementTimeline({ market: m }: { market: MarketView }) {
  const now = useChainTime() ?? m.chainTime;
  const end = challengeEnds(m);
  const closes = claimsCloseAt(m);
  return (
    <section aria-labelledby="tl-h" className="glass p-5 sm:p-6">
      <h2 id="tl-h" className="text-[1.375rem] font-semibold sm:text-2xl">
        How this gets settled
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
              {s.note && <p className="text-muted text-sm">{s.note}</p>}
              {s.label === 'Challenge window' && s.state === 'current' && end && (
                <p className="text-sm">
                  Closes in <Countdown to={end} now={now} className="font-semibold" endedLabel="now" />
                </p>
              )}
              {s.label === 'Claims close' && closes && (
                <p className="text-sm">
                  In <Countdown to={closes} now={now} className="font-semibold" endedLabel="now" />
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {m.decision && m.decision.proposedAt > 0 && (
        <TechnicalDetails className="mt-5">
          <p className="text-muted">Evidence hash (proposal)</p>
          <HashText value={m.decision.evidenceHash} label="evidence hash" />
        </TechnicalDetails>
      )}
    </section>
  );
}

export function ChallengeForm({ market: m }: { market: MarketView }) {
  const { protocol } = useProtocol();
  const now = useChainTime() ?? m.chainTime;
  const writes = useWritesAllowed();
  const plan = usePlan();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  if (isFinal(m.phase)) return null;
  const open = canChallenge(m, now);
  const end = challengeEnds(m);
  return (
    <section aria-labelledby="ch-h" className="glass space-y-3 p-5 sm:p-6">
      <h2 id="ch-h" className="text-lg font-semibold">
        Challenge the proposal
      </h2>
      {!open ? (
        <p className="text-muted text-sm">
          {m.phase === 'challenged'
            ? 'Already challenged: the adjudicator decides.'
            : end && now >= end
              ? `The challenge window closed on ${formatDate(end)}.`
              : `Opens when the resolver proposes a result (no earlier than maturity, ${formatDate(m.maturity)}) and stays open ${formatDuration(m.challengePeriod)}.`}
        </p>
      ) : (
        <>
          <p className="text-sm">
            Anyone may challenge until {formatDate(end!)} with a nonzero evidence hash. No bond is required; the adjudicator decides.
          </p>
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
              <WritesBlockedNote />
              <button
                type="button"
                disabled={plan.running || !writes.allowed || /^0x0+$/.test(hash)}
                onClick={() => void plan.start(() => protocol.challenge(m.reportId, hash))}
                className="bg-beam text-on-beam block rounded-xl px-4 py-2.5 font-semibold hover:brightness-105 disabled:opacity-60"
              >
                Challenge with this hash
              </button>
            </>
          )}
          <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
        </>
      )}
    </section>
  );
}

export function FinalizeButton({ market: m }: { market: MarketView }) {
  const { protocol } = useProtocol();
  const now = useChainTime() ?? m.chainTime;
  const writes = useWritesAllowed();
  const plan = usePlan();
  if (isFinal(m.phase)) return null;
  const ready = canFinalize(m, now);
  const end = challengeEnds(m);
  const why =
    m.phase === 'challenged'
      ? `Challenged: only the adjudicator can settle it now (or anyone after the result deadline, ${formatDate(m.resultDeadline)}, as Void).`
      : m.phase === 'proposed' && end
        ? `The challenge window is still open until ${formatDate(end)}.`
        : `Waiting for a proposal (from maturity, ${formatDate(m.maturity)}). After the result deadline (${formatDate(m.resultDeadline)}) anyone can finalize as Void.`;
  return (
    <section aria-labelledby="fin-h" className="glass space-y-3 p-5 sm:p-6">
      <h2 id="fin-h" className="text-lg font-semibold">
        Finalize
      </h2>
      <p className="text-sm">Anyone can finalize; nothing happens automatically.</p>
      {!ready && <p className="text-muted text-sm">{why}</p>}
      {ready && now > m.resultDeadline && <p className="text-beam-ink text-sm">The result deadline has passed, so finalizing makes this report Void.</p>}
      {ready && <WritesBlockedNote />}
      <button
        type="button"
        disabled={!ready || plan.running || !writes.allowed}
        onClick={() => void plan.start(() => protocol.finalize(m.reportId))}
        className="bg-beam text-on-beam rounded-xl px-4 py-2.5 font-semibold hover:brightness-105 disabled:opacity-50"
      >
        Finalize #{m.reportId.toString()}
      </button>
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
    </section>
  );
}

/** Separate claims; never merged into one button. */
function ClaimsPanel({ market: m, base }: { market: MarketView; base: CaseBase }) {
  const position = usePosition(m.reportId, m.blockNumber);
  const { address, connected } = useActiveAccount();
  const { protocol } = useProtocol();
  const v2 = protocol.kind === 'v2';
  return (
    <section aria-labelledby="claims-h">
      <h2 id="claims-h" className="mb-4 text-[1.375rem] font-semibold sm:text-2xl">
        Your claims
      </h2>
      {!address ? (
        <Card className="flex flex-wrap items-center gap-5">
          <SniffPose pose="alert" size={80} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px]">Connect a wallet to see what you can claim.</p>
            {!connected && (
              <div className="mt-3">
                <ConnectButton />
              </div>
            )}
          </div>
        </Card>
      ) : (
        <LoadState query={position} source="Ethereum Sepolia RPC" skeleton={<div className="sweep h-40" aria-label="Loading your positions" />}>
          {(pos) => (
            <div className={`grid gap-4 ${v2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
              <RedeemCard market={m} pos={pos} />
              <YieldCard market={m} pos={pos} base={base} />
              {v2 ? null : env.reputationBadgeEnabled ? (
                <ReputationBadgeCard market={m} pos={pos} />
              ) : (
                <div className="glass p-5">
                  <h3 className="font-semibold">{REPUTATION_BADGE_TITLE}</h3>
                  <p className="text-muted mt-2 text-sm">Not available for this report.</p>
                </div>
              )}
            </div>
          )}
        </LoadState>
      )}
    </section>
  );
}

function RedeemCard({ market: m, pos }: { market: MarketView; pos: PositionView }) {
  const { protocol } = useProtocol();
  const now = useChainTime() ?? m.chainTime;
  const writes = useWritesAllowed();
  const plan = usePlan();
  const outcome = m.decision?.outcome;
  const sides = (['yes', 'no'] as const).filter((s) => pos[s] > 0n);
  const v2 = protocol.kind === 'v2';
  const open = v2 ? claimPrincipalOpen(m, now) : !!outcome;
  const expired = v2 && claimsExpired(m, now);
  const closes = claimsCloseAt(m);
  return (
    <div className="glass space-y-3 p-5 sm:p-6">
      <h3 className="text-lg font-semibold">{v2 ? 'Claim your stake' : 'Redeem position'}</h3>
      {!outcome ? (
        <p className="text-muted text-sm">
          Opens when the result is final: no earlier than maturity ({formatDate(m.maturity)}) plus the {formatDuration(m.challengePeriod)} challenge window. Claims then
          stay open 90 days.
        </p>
      ) : sides.length === 0 ? (
        <p className="text-muted text-sm">You have no position left to claim.</p>
      ) : expired ? (
        <p className="text-mask-ink text-sm">Claims expired on {formatDate(closes!)} (90 days after the result).</p>
      ) : (
        sides.map((s) => {
          const pay = estimatePaid(outcome, s, pos[s], m.totals, v2 ? m.principalAvailable : undefined);
          return (
            <div key={s} className="space-y-1">
              <p className="text-sm">
                {formatUsdc(pos[s])} {s === 'yes' ? 'Yes' : 'No'} → <span className="num font-semibold">{formatUsdc(pay, { exact: true })}</span> dUSD
                {outcome === 'void' && <span className="text-muted"> (Void returns principal, no fee)</span>}
                {outcome !== 'void' && pay === 0n && <span className="text-muted"> (losing side pays 0)</span>}
              </p>
              <button
                type="button"
                disabled={plan.running || !open || !writes.allowed}
                onClick={() => void plan.start(() => protocol.redeem(m.reportId, s === 'yes', pos[s]))}
                className="bg-beam text-on-beam rounded-xl px-4 py-2 text-sm font-semibold hover:brightness-105 disabled:opacity-60"
              >
                {pay > 0n ? `Claim ${s === 'yes' ? 'Yes' : 'No'} principal` : `Close ${s === 'yes' ? 'Yes' : 'No'} position (pays 0)`}
              </button>
            </div>
          );
        })
      )}
      {v2 && open && closes && (
        <p className="text-muted text-xs">
          Claims close {formatDate(closes)} (<Countdown to={closes} now={now} endedLabel="now" />).
        </p>
      )}
      {plan.result?.ok && plan.result.effect.paid !== undefined && (
        <p className="text-clue-ink text-sm" role="status">
          Received {formatUsdc(plan.result.effect.paid, { exact: true })} dUSD (PrincipalClaimed).
        </p>
      )}
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
    </div>
  );
}

function YieldCard({ market: m, pos, base }: { market: MarketView; pos: PositionView; base: CaseBase }) {
  const { protocol } = useProtocol();
  const writes = useWritesAllowed();
  const plan = usePlan();
  const lpPlan = usePlan();
  const { address } = useActiveAccount();
  return (
    <div className="glass space-y-3 p-5 sm:p-6">
      <h3 className="text-lg font-semibold">Claim YT yield</h3>
      {!m.yt ? (
        <p className="text-muted text-sm">No YT series yet.</p>
      ) : (
        <>
          <p className="text-sm">
            YT balance <span className="num">{formatUsdc(pos.yt)}</span> · claimable <span className="num font-semibold">{formatUsdc(pos.ytClaimable, { exact: true })}</span> dUSD
          </p>
          <p className="text-muted text-[13px]">Paid whatever the verdict, and claimable after maturity.</p>
          <button
            type="button"
            disabled={plan.running || pos.ytClaimable === 0n || !writes.allowed}
            onClick={() => void plan.start(() => protocol.claimYield(m.reportId, address!))}
            className="bg-beam text-on-beam rounded-xl px-4 py-2 text-sm font-semibold hover:brightness-105 disabled:opacity-50"
          >
            Claim YT yield
          </button>
          <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
          {plan.result?.ok && plan.result.effect.paid !== undefined && (
            <p className="text-clue-ink text-sm" role="status">
              Received {formatUsdc(plan.result.effect.paid, { exact: true })} dUSD.
            </p>
          )}
          {protocol.kind === 'v2' && (pos.lpShares > 0n || pos.lpClaimable > 0n) && (
            <div className="border-line space-y-2 border-t pt-3 text-sm">
              <p>
                Liquidity yield ≈ <span className="num">{formatUsdc(pos.lpClaimable, { exact: true })}</span> dUSD on <span className="num">{formatUsdc(pos.lpShares)}</span> liquidity
                shares.{' '}
                <Link href={casePath(base, m.reportId, 'market')} className="text-beam-ink underline">
                  Remove liquidity
                </Link>
              </p>
              <button
                type="button"
                disabled={lpPlan.running || !writes.allowed}
                onClick={() => void lpPlan.start(() => protocol.claimLPYield!(m.reportId, address))}
                className="border-line rounded-lg border px-3 py-1.5 font-semibold hover:border-[var(--fog-400)] disabled:opacity-50"
              >
                Claim LP yield
              </button>
              <TxPlanStepper steps={lpPlan.steps} buildError={lpPlan.buildError} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
