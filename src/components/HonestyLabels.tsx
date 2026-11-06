import { Clock, Eye, FlaskConical, Fingerprint, Globe2, Info, Sprout } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

// The honesty labels. Exact strings; reuse these components rather than retyping the copy.
export const LABELS = {
  testToken: 'dUSD — test token, not USDC',
  simulatedYield: 'Simulated yield',
  demoClock: 'Demo clock',
  publicStakes: 'Stakes are public onchain',
  ytNotPrediction: 'The YT price is not a prediction of the verdict',
  ccipNotVote: 'A CCIP transfer is not a vote until it is credited',
  demoIdentity: 'Demo identity: World Agent Pass',
} as const;

function Tag({ icon: Icon, children, title }: { icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="border-line text-muted inline-flex items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-xs font-medium whitespace-nowrap"
    >
      <Icon size={12} aria-hidden />
      {children}
    </span>
  );
}

export const TestTokenLabel = () => <Tag icon={FlaskConical}>{LABELS.testToken}</Tag>;
export const SimulatedYieldLabel = () => (
  <Tag icon={Sprout} title="The DemoUSD vault uses injected, simulated yield. It is not lending interest.">
    {LABELS.simulatedYield}
  </Tag>
);
export const DemoClockLabel = () => (
  <Tag icon={Clock} title="This report uses demo or accelerated times.">
    {LABELS.demoClock}
  </Tag>
);
export const PublicStakesLabel = () => <Tag icon={Eye}>{LABELS.publicStakes}</Tag>;
export const CcipNotVoteLabel = () => <Tag icon={Globe2}>{LABELS.ccipNotVote}</Tag>;
export const DemoIdentityLabel = () => (
  <Tag icon={Fingerprint} title="The World proofs at this event are mocked or simulated; this is not production assurance.">
    {LABELS.demoIdentity}
  </Tag>
);
export const YtNotPredictionLabel = () => <Tag icon={Info}>{LABELS.ytNotPrediction}</Tag>;
