'use client';

import {
  Clock,
  Eye,
  FileWarning,
  Fingerprint,
  FlaskConical,
  Globe2,
  Info,
  LineChart,
  Sprout,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { LABELS, demoReportLabel } from '@/components/HonestyLabels';
import { InfoTip } from './InfoTip';

export type HonestyFact =
  | 'testToken'
  | 'simulatedYield'
  | 'publicStakes'
  | 'ytNotSignal'
  | 'curveNotOracle'
  | 'demoReport'
  | 'testIdentities'
  | 'ccipNotVote'
  | 'demoClock'
  | 'estimate';

type Icon = ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;

/** Short chip text, the exact honesty label, and one line of explanation. */
const FACTS: Record<
  Exclude<HonestyFact, 'demoReport'>,
  { chip: string; label: string; more: string; icon: Icon }
> = {
  testToken: {
    chip: 'Test dUSD',
    label: LABELS.testToken,
    more: 'Stakes use DemoUSD on testnets. It has no value.',
    icon: FlaskConical,
  },
  simulatedYield: {
    chip: 'Simulated yield',
    label: LABELS.simulatedYield,
    more: 'The vault’s yield is injected for the demo. It is not lending interest.',
    icon: Sprout,
  },
  publicStakes: {
    chip: 'Public stakes',
    label: LABELS.publicStakes,
    more: 'Anyone can see which side a wallet staked and how much.',
    icon: Eye,
  },
  ytNotSignal: {
    chip: 'YT price ≠ verdict',
    label: LABELS.ytNotPrediction,
    more: 'YT trades on a yield curve. Its price says nothing about how the report resolves.',
    icon: Info,
  },
  curveNotOracle: {
    chip: 'Curve output',
    label: LABELS.curveNotOracle,
    more: 'Price and implied APR come from the hook’s rate curve, not from the verdict.',
    icon: LineChart,
  },
  testIdentities: {
    chip: 'Test World IDs',
    label: 'World proofs at the event use test identities',
    more: 'Reviewer confirmations are real World ID flows, signed with test identities for the hackathon.',
    icon: Fingerprint,
  },
  ccipNotVote: {
    chip: 'CCIP ≠ vote yet',
    label: LABELS.ccipNotVote,
    more: 'A cross-chain stake counts only after the receiver on Ethereum Sepolia credits it.',
    icon: Globe2,
  },
  demoClock: {
    chip: 'Demo clock',
    label: LABELS.demoClock,
    more: 'This market uses demo or accelerated times.',
    icon: Clock,
  },
  estimate: {
    chip: 'Estimate',
    label: LABELS.estimate,
    more: 'The final amount comes from the claim receipt onchain.',
    icon: Info,
  },
};

function Chip({
  icon: I,
  chip,
  label,
  more,
}: {
  icon: Icon;
  chip: string;
  label: string;
  more: string;
}) {
  return (
    <InfoTip
      label={label}
      trigger={
        <span className="border-line text-muted hover:text-text inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium whitespace-nowrap">
          <I size={12} aria-hidden />
          {chip}
          <span className="sr-only">: {label}. More information</span>
        </span>
      }
    >
      <strong className="block">{label}</strong>
      <span className="text-muted mt-1 block">{more}</span>
    </InfoTip>
  );
}

/** One row of honesty facts; each chip opens a popover. Show each fact once per screen. */
export function HonestyChips({
  facts,
  reportId,
  className = '',
}: {
  facts: HonestyFact[];
  /** Needed for the demoReport fact. */
  reportId?: bigint | string;
  className?: string;
}) {
  const unique = [...new Set(facts)];
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="About this demo">
      {unique.map((f) => (
        <li key={f}>
          {f === 'demoReport' ? (
            <Chip
              icon={FileWarning}
              chip={`Demo report${reportId !== undefined ? ` #${reportId}` : ''}`}
              label={demoReportLabel(reportId ?? '1')}
              more="This onchain report was published with demo hashes. No backend research report maps to it."
            />
          ) : (
            <Chip {...FACTS[f]} />
          )}
        </li>
      ))}
    </ul>
  );
}
