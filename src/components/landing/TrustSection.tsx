import { Ban, EyeOff, UserCheck } from 'lucide-react';

const CANT = [
  {
    Icon: UserCheck,
    title: 'No AI-only accusations',
    body: "An agent's finding is a draft. Nothing is published or tradable until a registered human approves the exact claim, and that approval is checked by the backend, not this page.",
  },
  {
    Icon: EyeOff,
    title: 'No betting after the answer is known',
    body: 'Stakes are sealed until reveal, and the moment a claim triggers, new stakes and every swap on its pools revert onchain.',
  },
  {
    Icon: Ban,
    title: 'No betting on your own rug',
    body: "Wallets linked to the token's deployer and its funders are listed in the case and rejected by the market contract.",
  },
];

export function TrustSection() {
  return (
    <section aria-labelledby="cant-h" className="border-line bg-surface border-t">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <h2 id="cant-h" className="font-display text-4xl sm:text-5xl">
          What we can&apos;t do
        </h2>
        <p className="text-muted mt-3 max-w-2xl text-lg">
          The rules that keep a mystery game from becoming a smear machine.
        </p>
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
