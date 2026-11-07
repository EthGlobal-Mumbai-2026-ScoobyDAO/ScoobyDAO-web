import { Coins, Fingerprint, Scale, Search, type LucideIcon } from 'lucide-react';
import { SniffPose, type Pose } from '@/components/SniffPose';
import { Disclosure } from '@/components/ui';

export interface Step {
  title: string;
  body: string;
  pose: Pose;
  Icon: LucideIcon;
  /** Accent for the icon disc: amber = human, teal = agents/settlement. */
  tone: 'beam' | 'clue' | 'ghost';
  details: string[];
}

// Four steps, each with its own pose (no repeated heads). The long copy lives behind "Details".
export const STEPS: Step[] = [
  {
    title: 'Sniff and the agents investigate',
    body: 'AI agents file an evidence report on a suspicious token.',
    pose: 'sniffing',
    Icon: Search,
    tone: 'clue',
    details: [
      'Agents write a report across five pillars (microstructure, onchain, fundamentals, statistical risk, technical health) with evidence, unknowns and counterevidence kept in.',
    ],
  },
  {
    title: 'A human signs off with World ID',
    body: 'An enrolled reviewer approves the exact report, or nothing opens.',
    pose: 'alert',
    Icon: Fingerprint,
    tone: 'beam',
    details: [
      'An enrolled reviewer approves the report bytes and the claim with World Agent Pass. The backend checks it; denied or expired requests open nothing.',
      'ReportRegistry.publish records the report hash and claim hash onchain with its lock time, cross-chain cutoff, result deadline and challenge period.',
    ],
  },
  {
    title: 'Anyone stakes Yes or No',
    body: 'Back your verdict in dUSD, from Sepolia or over CCIP.',
    pose: 'thinking',
    Icon: Scale,
    tone: 'ghost',
    details: [
      'Stake dUSD (a test token) directly on Ethereum Sepolia, or from Arbitrum Sepolia over Chainlink CCIP until the cross-chain cutoff. Stakes are public onchain.',
      'At lock time the pool moves into a simulated yield vault. Its yield token (YT) trades on a Uniswap v4 hook market. The YT price is not a prediction of the verdict.',
    ],
  },
  {
    title: 'Settle the case and claim',
    body: 'A result is proposed, open to challenge, then finalized.',
    pose: 'triumphant',
    Icon: Coins,
    tone: 'beam',
    details: [
      'Thirty days after lock, the resolver proposes Yes, No or Void with an evidence hash.',
      'During the challenge window anyone can challenge with evidence and the adjudicator decides. After it, anyone can finalize. Nothing happens automatically.',
      'Winners redeem their stake plus 80% of the losing pool (the fee is 20% of the losing pool only). YT holders claim yield. Void refunds everyone. Verified humans can later claim one REP badge.',
    ],
  },
];

const TONE: Record<Step['tone'], string> = {
  beam: 'text-beam-ink border-[color-mix(in_srgb,var(--beam-400)_55%,transparent)] bg-[color-mix(in_srgb,var(--beam-400)_14%,var(--bg))]',
  clue: 'text-clue-ink border-[color-mix(in_srgb,var(--clue-500)_55%,transparent)] bg-[color-mix(in_srgb,var(--clue-500)_14%,var(--bg))]',
  ghost:
    'text-ghost-ink border-[color-mix(in_srgb,var(--ghost-300)_55%,transparent)] bg-[color-mix(in_srgb,var(--ghost-300)_14%,var(--bg))]',
};

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      tabIndex={-1}
      aria-labelledby="how-h"
      className="scroll-mt-20 outline-none"
    >
      <h2 id="how-h" className="text-[1.375rem] font-semibold sm:text-2xl">
        How it works
      </h2>
      <p className="text-muted mt-1 text-[15px]">
        From a hunch to a settled verdict in four steps.
      </p>
      <div className="relative mt-8">
        {/* the trail between steps (wide screens) */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-[158px] right-[calc(25%-36px)] left-[18px] hidden border-t-2 border-dashed border-[color-mix(in_srgb,var(--fog-400)_45%,transparent)] lg:block"
        />
        <ol className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative grid grid-cols-[88px_minmax(0,1fr)] content-start gap-x-4 sm:flex sm:flex-col">
              <div className="row-span-4 grid place-items-start sm:h-[132px] sm:place-items-end sm:justify-start [&>svg]:h-[88px] [&>svg]:w-[88px] sm:[&>svg]:h-32 sm:[&>svg]:w-32">
                <SniffPose pose={s.pose} size={128} decorative />
              </div>
              <div className="flex items-center gap-3 sm:mt-2">
                <span
                  className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border ${TONE[s.tone]}`}
                  aria-hidden
                >
                  <s.Icon size={17} />
                </span>
                <span className="text-muted num bg-bg relative z-10 pr-3 text-[13px]">Step {i + 1}</span>
              </div>
              <h3 className="mt-3 text-lg leading-snug font-semibold">{s.title}</h3>
              <p className="text-muted mt-1.5 text-[15px]">{s.body}</p>
              <Disclosure summary="Details" className="mt-3">
                <div className="text-muted space-y-2 text-sm">
                  {s.details.map((d) => (
                    <p key={d}>{d}</p>
                  ))}
                </div>
              </Disclosure>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
