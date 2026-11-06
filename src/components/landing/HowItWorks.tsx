import { SniffPose, type Pose } from '@/components/SniffPose';

const STEPS: { title: string; body: string; pose: Pose }[] = [
  {
    title: 'Sniff finds a clue',
    body: 'Agents run checks anyone can repeat, like "a normal wallet can\'t sell". Each finding becomes a claim with its evidence and a hash of the exact wording.',
    pose: 'sniffing',
  },
  {
    title: 'A human signs off',
    body: 'A registered reviewer approves or denies the exact claim with World ID Agent Pass. No agent can accuse a token alone; denied or expired claims stay drafts.',
    pose: 'thinking',
  },
  {
    title: 'The case opens',
    body: 'Stake For or Against with a sealed bet: only a hash goes onchain until you reveal. Wallets linked to the token deployer are blocked by the contract.',
    pose: 'alert',
  },
  {
    title: 'The trap springs',
    body: 'When the claim triggers onchain, staking and trading on its Uniswap v4 pools freeze in the same block. Winners redeem; the losing side pays them.',
    pose: 'triumphant',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-h"
      className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:py-28"
    >
      <h2 id="how-h" className="font-display text-4xl sm:text-5xl">
        How it works
      </h2>
      <ol className="relative mt-12 space-y-12 before:absolute before:top-4 before:bottom-4 before:left-[27px] before:w-0.5 before:bg-[linear-gradient(var(--beam-400),var(--clue-500),var(--mask-500))] before:opacity-60 sm:space-y-16">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="relative grid grid-cols-[56px_1fr] gap-5 sm:grid-cols-[56px_1fr_160px] sm:gap-8"
          >
            <span className="num border-beam bg-bg text-beam-ink relative z-10 grid h-14 w-14 place-items-center rounded-full border-2 text-xl font-semibold">
              {i + 1}
            </span>
            <div className="max-w-xl pt-2">
              <h3 className="font-display text-2xl sm:text-3xl">{s.title}</h3>
              <p className="text-muted mt-2 text-lg">{s.body}</p>
            </div>
            <div className="hidden sm:block">
              <SniffPose pose={s.pose} size={140} decorative />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
