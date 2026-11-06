import { Clock, Eye, UserCheck } from 'lucide-react';
import { BUILT_WITH } from '@/lib/site';

const CANT = [
  {
    Icon: UserCheck,
    title: 'No AI-only accusations',
    body: "An agent's report is a draft. Nothing is published or stakeable until an enrolled human approves the exact report and claim, and that approval is checked by the backend, not this page.",
  },
  {
    Icon: Eye,
    title: 'No hidden stakes',
    body: 'Stakes are public onchain. Positions and totals are visible to everyone, so the share of stakes is a split of money, not a probability.',
  },
  {
    Icon: Clock,
    title: 'No verdict by timer',
    body: 'A result needs a proposal with evidence, a challenge window anyone can use, and someone to finalize. If no result is final by the deadline, the case is Void and stakes are refunded.',
  },
];

export function TrustSection() {
  return (
    <section aria-labelledby="cant-h" className="border-line bg-surface border-t">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <h2 id="cant-h" className="font-display text-4xl sm:text-5xl">
          What we can&apos;t do
        </h2>
        <p className="text-muted mt-3 max-w-2xl text-lg">The rules that keep a mystery game from becoming a smear machine.</p>
        <ul className="mt-10 grid gap-8 md:grid-cols-3">
          {CANT.map(({ Icon, title, body }) => (
            <li key={title}>
              <Icon size={28} className="text-beam-ink" aria-hidden />
              <h3 className="mt-3 text-xl font-semibold">{title}</h3>
              <p className="text-muted mt-2">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Sponsor touchpoints, text labels only (no logos). */
export function BuiltWith() {
  return (
    <section aria-labelledby="built-h" className="mx-auto max-w-6xl px-4 py-14">
      <h2 id="built-h" className="text-muted text-sm font-semibold tracking-wide uppercase">
        Built with
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        {BUILT_WITH.map((b) => (
          <li key={b.name} className="border-line rounded-xl border p-4">
            <p className="font-display text-xl">{b.name}</p>
            <p className="text-muted">{b.role}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
