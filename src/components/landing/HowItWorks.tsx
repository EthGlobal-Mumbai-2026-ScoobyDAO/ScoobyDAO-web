import { SniffPose, type Pose } from '@/components/SniffPose';

const STEPS: { title: string; body: string; pose: Pose }[] = [
  {
    title: 'Sniff researches a token',
    body: 'Agents write a report across five pillars (microstructure, onchain, fundamentals, statistical risk, technical health) with evidence, unknowns and counterevidence kept in.',
    pose: 'sniffing',
  },
  {
    title: 'A human approves the exact report',
    body: 'An enrolled reviewer approves the report bytes and the claim with World Agent Pass. The backend checks it; denied or expired requests open nothing.',
    pose: 'thinking',
  },
  {
    title: 'The case is published',
    body: 'ReportRegistry.publish records the report hash and claim hash onchain with its lock time, cross-chain cutoff, result deadline and challenge period.',
    pose: 'alert',
  },
  {
    title: 'Anyone stakes Yes or No',
    body: 'Stake dUSD (a test token) directly on Ethereum Sepolia, or from Arbitrum Sepolia over Chainlink CCIP until the cross-chain cutoff. Stakes are public onchain.',
    pose: 'idle',
  },
  {
    title: 'Stakes lock and earn',
    body: 'At lock time the pool moves into a simulated yield vault. Its yield token (YT) trades on a Uniswap v4 hook market. The YT price is not a prediction of the verdict.',
    pose: 'thinking',
  },
  {
    title: 'At maturity a result is proposed',
    body: 'Thirty days after lock, the resolver proposes Yes, No or Void with an evidence hash.',
    pose: 'alert',
  },
  {
    title: 'Anyone can challenge, then finalize',
    body: 'During the challenge window anyone can challenge with evidence and the adjudicator decides. After it, anyone can finalize. Nothing happens automatically.',
    pose: 'confused',
  },
  {
    title: 'Claims, kept separate',
    body: 'Winners redeem their stake plus 80% of the losing pool (the fee is 20% of the losing pool only). YT holders claim yield. Void refunds everyone. Verified humans can later claim one REP badge.',
    pose: 'triumphant',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" tabIndex={-1} aria-labelledby="how-h" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 outline-none sm:py-28">
      <h2 id="how-h" className="font-display text-4xl sm:text-5xl">
        How it works
      </h2>
      <ol className="relative mt-12 space-y-12 before:absolute before:top-4 before:bottom-4 before:left-[27px] before:w-0.5 before:bg-[linear-gradient(var(--beam-400),var(--clue-500),var(--ghost-300))] before:opacity-60 sm:space-y-14">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative grid grid-cols-[56px_1fr] gap-5 sm:grid-cols-[56px_1fr_120px] sm:gap-8">
            <span className="num border-beam bg-bg text-beam-ink relative z-10 grid h-14 w-14 place-items-center rounded-full border-2 text-xl font-semibold">
              {i + 1}
            </span>
            <div className="max-w-xl pt-2">
              <h3 className="font-display text-2xl sm:text-3xl">{s.title}</h3>
              <p className="text-muted mt-2 text-lg">{s.body}</p>
            </div>
            <div className="hidden sm:block">
              <SniffPose pose={s.pose} size={110} decorative />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
