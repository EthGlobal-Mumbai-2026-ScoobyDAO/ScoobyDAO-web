'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CircleCheck, CircleMinus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Hex } from 'viem';
import { Banner } from '@/components/Banner';
import { AmountField, ApprovalToggle, validAmount, WritesBlockedNote } from '@/components/forms';
import { HashText } from '@/components/HashText';
import { SimulatedYieldDemoLabel, TestTokenLabel } from '@/components/HonestyLabels';
import { NetworkBadge } from '@/components/NetworkBadge';
import { TxLink } from '@/components/TxLink';
import { TxPlanStepper, usePlan } from '@/components/TxPlanStepper';
import { formatDate, formatUsdc } from '@/lib/format';
import { evidenceHash } from '@/lib/hash';
import { canAdjudicate, canClaimFee, canInjectYield, canPropose, isSameAddress, V2_INFO, type MarketView, type Outcome } from '@/protocol';
import { useActiveAccount, useChainTime, useMarket, usePosition, useProtocol, usePublished, useWritesAllowed } from '@/protocol/hooks';

const SEPOLIA = 11155111;

/**
 * /operator (NEXT_PUBLIC_OPERATOR_VIEW=true): demo maintenance through the connected wallet. Each
 * button is enabled only when the chain says the connected account holds the role and the contract's
 * time gate is open. No keys live here; no simulateLoss, sweepDust or admin setup.
 */
export function OperatorScreen() {
  const { protocol } = useProtocol();
  const published = usePublished();
  const id = published.data?.[0];
  const market = useMarket(id);
  const { address, connected } = useActiveAccount();
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:py-10">
      <div className="space-y-2">
        <h1 className="font-display text-4xl">Operator</h1>
        <p className="text-muted max-w-3xl">
          Role-gated demo actions, sent from your connected wallet. This page holds no keys. A button turns on only when the chain says your wallet holds the role and
          the contract would accept the call now.
        </p>
      </div>
      {protocol.kind !== 'v2' ? (
        <Banner tone="info" title="The operator view is for the live V2 deployment" />
      ) : !connected ? (
        <ConnectButton />
      ) : market.isError ? (
        <Banner tone="danger" title="Couldn't read the report">
          {market.error.message}
        </Banner>
      ) : !market.data || !address ? (
        <div className="sweep h-64" aria-busy="true" aria-label="Loading roles" />
      ) : (
        <Operator m={market.data} me={address} />
      )}
    </main>
  );
}

function Operator({ m, me }: { m: MarketView; me: `0x${string}` }) {
  const roles: [string, string | undefined, string][] = [
    ['Resolver', m.resolver, 'proposes Yes / No / Void after maturity'],
    ['Adjudicator', m.adjudicator, 'settles a challenged proposal'],
    ['Reviewer', m.reviewer, 'signed the report for publication'],
    ['Treasury', m.treasury, 'receives the 20% fee from claimFee()'],
    ['CCIP recovery operator', m.recoveryOperator, 'recovers undecodable CCIP deliveries'],
  ];
  const demo = [m.reviewer, m.resolver, m.adjudicator].every((a) => isSameAddress(a, V2_INFO.deployer));
  return (
    <>
      <section aria-labelledby="roles-h" className="glass space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="roles-h" className="font-semibold">
            Roles for report #{m.reportId.toString()} (read from chain)
          </h2>
          <NetworkBadge chainId={SEPOLIA} />
        </div>
        <table className="w-full text-sm">
          <caption className="sr-only">Roles and whether your wallet holds them</caption>
          <tbody>
            {roles.map(([role, addr, what]) => (
              <tr key={role} className="border-line border-t align-top">
                <td className="py-2 pr-3">
                  <p className="font-semibold">{role}</p>
                  <p className="text-muted text-xs">{what}</p>
                </td>
                <td className="py-2 pr-3">{addr ? <TxLink kind="address" value={addr} chainId={SEPOLIA} /> : '—'}</td>
                <td className="py-2">
                  {isSameAddress(addr, me) ? (
                    <span className="text-clue-ink inline-flex items-center gap-1 font-semibold">
                      <CircleCheck size={15} aria-hidden /> your wallet
                    </span>
                  ) : (
                    <span className="text-muted inline-flex items-center gap-1">
                      <CircleMinus size={15} aria-hidden /> not you
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {demo && <p className="text-beam-ink text-sm font-semibold">Demo roles: all held by the deployer wallet.</p>}
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <Decide kind="propose" m={m} me={me} />
        <Decide kind="adjudicate" m={m} me={me} />
        <InjectYield m={m} me={me} />
        <ClaimFee m={m} />
      </div>
    </>
  );
}

function Card({ title, children, label }: { title: string; children: ReactNode; label?: ReactNode }) {
  return (
    <section className="glass space-y-3 p-5" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {label}
      </div>
      {children}
    </section>
  );
}

function Decide({ kind, m, me }: { kind: 'propose' | 'adjudicate'; m: MarketView; me: `0x${string}` }) {
  const { protocol } = useProtocol();
  const now = useChainTime() ?? m.chainTime;
  const writes = useWritesAllowed();
  const plan = usePlan();
  const [outcome, setOutcome] = useState<Outcome>('yes');
  const [text, setText] = useState('');
  const [hash, setHash] = useState<Hex | null>(null);
  const role = kind === 'propose' ? m.resolver : m.adjudicator;
  const holds = isSameAddress(role, me);
  const timeOk = kind === 'propose' ? canPropose(m, now) : canAdjudicate(m, now);
  const why = !holds
    ? `Only the ${kind === 'propose' ? 'resolver' : 'adjudicator'} (${role.slice(0, 8)}…) can call this.`
    : timeOk
      ? undefined
      : kind === 'propose'
        ? m.decision?.proposedAt
          ? 'A result was already proposed.'
          : now < m.maturity
            ? `Proposals open at maturity, ${formatDate(m.maturity)}.`
            : `The result deadline (${formatDate(m.resultDeadline)}) has passed; finalize() makes it Void.`
        : !m.decision?.challenged
          ? 'Only a challenged proposal can be adjudicated.'
          : `Adjudication closes at the result deadline (${formatDate(m.resultDeadline)}).`;
  return (
    <Card title={kind === 'propose' ? 'Propose a result (resolver)' : 'Adjudicate a challenge (adjudicator)'}>
      <fieldset className="flex flex-wrap gap-3 text-sm">
        <legend className="text-muted mb-1">Outcome</legend>
        {(['yes', 'no', 'void'] as const).map((o) => (
          <label key={o} className="flex items-center gap-1.5">
            <input type="radio" name={`${kind}-outcome`} checked={outcome === o} onChange={() => setOutcome(o)} />
            {o === 'void' ? 'Void' : o === 'yes' ? 'Yes' : 'No'}
          </label>
        ))}
      </fieldset>
      <label className="block text-sm">
        <span className="text-muted">Evidence (text or URL, hashed with SHA-256 here)</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setHash(null);
          }}
          rows={2}
          className="border-line focus:border-beam mt-1 w-full rounded-xl border bg-transparent p-2 outline-none"
        />
      </label>
      <button
        type="button"
        disabled={!text.trim()}
        onClick={async () => setHash(await evidenceHash(text.trim()))}
        className="border-line rounded-lg border px-3 py-1.5 text-sm font-semibold hover:border-[var(--fog-400)] disabled:opacity-50"
      >
        Hash evidence
      </button>
      {hash && <HashText value={hash} label="evidence hash" />}
      {why && <p className="text-muted text-sm">{why}</p>}
      <WritesBlockedNote />
      <button
        type="button"
        disabled={!holds || !timeOk || !hash || plan.running || !writes.allowed}
        onClick={() => void plan.start(() => (kind === 'propose' ? protocol.propose!(m.reportId, outcome, hash!) : protocol.adjudicate!(m.reportId, outcome, hash!)))}
        className="bg-beam text-on-beam rounded-xl px-4 py-2 font-semibold hover:brightness-105 disabled:opacity-50"
      >
        {kind === 'propose' ? 'Propose' : 'Adjudicate'}
      </button>
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
    </Card>
  );
}

function InjectYield({ m, me }: { m: MarketView; me: `0x${string}` }) {
  const { protocol } = useProtocol();
  const now = useChainTime() ?? m.chainTime;
  const position = usePosition(m.reportId, m.blockNumber);
  const writes = useWritesAllowed();
  const plan = usePlan();
  const [amountStr, setAmountStr] = useState('');
  const [unlimited, setUnlimited] = useState(false);
  const balance = position.data?.dusdBalance;
  const amount = validAmount(amountStr, balance);
  const open = canInjectYield(m, now);
  return (
    <Card title="Inject simulated yield" label={<SimulatedYieldDemoLabel />}>
      <p className="text-sm">
        Moves dUSD from your wallet into the YT yield index (vault.injectYield). Every YT holder, including LP inventory, earns it pro rata. It is not lending
        interest.
      </p>
      <TestTokenLabel />
      <AmountField label="Amount (dUSD)" unit="dUSD" value={amountStr} onChange={setAmountStr} balance={balance} />
      <ApprovalToggle unlimited={unlimited} onChange={setUnlimited} />
      {!open && <p className="text-muted text-sm">Only before maturity ({formatDate(m.maturity)}) while something is staked.</p>}
      <WritesBlockedNote />
      <button
        type="button"
        disabled={!open || !amount || plan.running || !writes.allowed}
        onClick={() => void plan.start(() => protocol.injectYield!(m.reportId, amount!, me, { unlimited }))}
        className="bg-beam text-on-beam rounded-xl px-4 py-2 font-semibold hover:brightness-105 disabled:opacity-50"
      >
        Inject {amount ? formatUsdc(amount) : ''} dUSD of simulated yield
      </button>
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
    </Card>
  );
}

function ClaimFee({ m }: { m: MarketView }) {
  const { protocol } = useProtocol();
  const now = useChainTime() ?? m.chainTime;
  const writes = useWritesAllowed();
  const plan = usePlan();
  const open = canClaimFee(m, now);
  return (
    <Card title="Claim the protocol fee">
      <p className="text-sm">
        vault.claimFee() is permissionless but always pays the configured treasury{' '}
        {m.treasury ? <TxLink kind="address" value={m.treasury} chainId={SEPOLIA} /> : null}, never the caller. The fee is 20% of the losing pool after a final Yes or
        No.
      </p>
      {!open && (
        <p className="text-muted text-sm">{m.feeClaimed ? 'Already claimed.' : 'Available after a final Yes or No result, within the 90-day claim window.'}</p>
      )}
      <WritesBlockedNote />
      <button
        type="button"
        disabled={!open || plan.running || !writes.allowed}
        onClick={() => void plan.start(() => protocol.claimFee!(m.reportId))}
        className="border-line rounded-xl border px-4 py-2 font-semibold hover:border-[var(--fog-400)] disabled:opacity-50"
      >
        Claim fee to the treasury
      </button>
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
    </Card>
  );
}
