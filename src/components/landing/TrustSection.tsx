import { Clock, Eye, UserCheck } from 'lucide-react';
import { BUILT_WITH } from '@/lib/site';

export const TRUST = [
  {
    Icon: UserCheck,
    title: 'No AI-only accusations',
    body: 'Nothing is published or stakeable until an enrolled human approves the exact report and claim.',
  },
  {
    Icon: Eye,
    title: 'No hidden stakes',
    body: 'Every stake is public onchain, so the Yes/No split is money staked, not a probability.',
  },
  {
    Icon: Clock,
    title: 'No verdict by timer',
    body: 'A result needs evidence, a challenge window and a finalize call, or the case is Void and refunded.',
  },
];

export function TrustSection() {
  return (
    <section aria-labelledby="trust-h">
      <h2 id="trust-h" className="text-[1.375rem] font-semibold sm:text-2xl">
        Why trust it
      </h2>
      <p className="text-muted mt-1 text-[15px]">The rules that keep a mystery game from becoming a smear machine.</p>
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {TRUST.map(({ Icon, title, body }) => (
          <li key={title} className="glass p-5 sm:p-6">
            <Icon size={24} className="text-beam-ink" aria-hidden />
            <h3 className="mt-3 text-lg font-semibold">{title}</h3>
            <p className="text-muted mt-1.5 text-[15px]">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Sponsor touchpoints, text only (no logos). */
export function BuiltWith() {
  return (
    <section aria-labelledby="built-h" className="border-line flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t pt-6">
      <h2 id="built-h" className="text-muted text-sm font-medium">
        Built with
      </h2>
      <ul className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold">
        {BUILT_WITH.map((b, i) => (
          <li key={b.name} title={b.role}>
            {i > 0 && (
              <span aria-hidden className="text-muted mr-2 font-normal">
                ·
              </span>
            )}
            {b.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
