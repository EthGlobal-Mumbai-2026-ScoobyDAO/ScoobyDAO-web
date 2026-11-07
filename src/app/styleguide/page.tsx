import type { Metadata } from 'next';
import {
  CcipNotVoteLabel,
  DemoClockLabel,
  DemoIdentityLabel,
  PublicStakesLabel,
  SimulatedYieldLabel,
  TestTokenLabel,
  YtNotPredictionLabel,
} from '@/components/HonestyLabels';
import { POSES, SniffPose } from '@/components/SniffPose';
import { StatusChip } from '@/components/StatusChip';
import { CASE_STATUSES } from '@/lib/status';

export const metadata: Metadata = { title: 'Styleguide', robots: { index: false } };

export default function Styleguide() {
  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
      <h1 className="font-display text-4xl">Styleguide</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Status chips</h2>
        <div className="flex flex-wrap gap-2">
          {CASE_STATUSES.map((s) => (
            <StatusChip key={s} status={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {CASE_STATUSES.map((s) => (
            <StatusChip key={s} status={s} size="lg" />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sniff poses</h2>
        <p className="text-muted text-sm">
          sniffing = loading, thinking = empty, alert = action needed, triumphant = success, sad = denied/expired, shrug =
          unavailable.
        </p>
        <ul className="flex flex-wrap gap-4">
          {POSES.map((p) => (
            <li key={p} className="text-muted flex flex-col items-center text-[13px]">
              <SniffPose pose={p} size={112} />
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Honesty labels</h2>
        <div className="flex flex-wrap gap-2">
          <TestTokenLabel />
          <SimulatedYieldLabel />
          <DemoClockLabel />
          <PublicStakesLabel />
          <YtNotPredictionLabel />
          <CcipNotVoteLabel />
          <DemoIdentityLabel />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="glass p-6">
          <h2 className="font-display text-2xl">Glass card</h2>
          <p className="text-muted mt-2">Muted body text on glass over fog.</p>
          <p className="num mt-3 text-sm">0x9f2c…41ab · 1,250.000000 dUSD</p>
          <div className="mt-4 flex gap-3">
            <button className="bg-beam text-on-beam rounded-lg px-4 py-2 font-semibold">
              Primary
            </button>
            <button className="border-line rounded-lg border px-4 py-2">Secondary</button>
          </div>
        </div>
        <div className="paper relative p-6 pl-14">
          <span className="stamp text-mask-ink absolute top-4 right-4">Evidence</span>
          <h2 className="font-display text-2xl">Case file</h2>
          <p className="mt-2">Typed on paper. Stays paper in both themes.</p>
          <p className="text-muted mt-2">Muted note on paper.</p>
          <p className="mt-3 flex gap-3 text-sm">
            <span className="text-beam-ink">Yes: beam ink</span>
            <span className="text-clue-ink">No: teal ink</span>
            <span className="text-mask-ink">Challenged: red ink</span>
            <span className="text-ghost-ink">Pending</span>
          </p>
        </div>
      </section>

      <section className="flex flex-wrap gap-4 text-sm">
        <span className="text-beam-ink">beam-ink</span>
        <span className="text-clue-ink">clue-ink</span>
        <span className="text-mask-ink">mask-ink</span>
        <span className="text-ghost-ink">ghost-ink</span>
        <span className="text-muted">muted</span>
      </section>

      <section className="space-y-2">
        <div className="sweep h-6 w-2/3" />
        <div className="sweep h-6 w-1/2" />
      </section>
    </main>
  );
}
