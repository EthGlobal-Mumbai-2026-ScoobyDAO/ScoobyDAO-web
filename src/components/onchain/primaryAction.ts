import type { CaseTab } from '@/components/case/CaseHeader';
import { isFinal, stakingOpen, tradingOpen, type MarketView, type Phase } from '@/protocol';

export interface PrimaryAction {
  tab: CaseTab;
  label: string;
}

/** The one thing to do next, by phase: Stake → Trade YT → View result → Claim. */
export function primaryAction(m: Pick<MarketView, 'phase' | 'series' | 'maturity' | 'market'>, now: number): PrimaryAction | null {
  if (m.series === false) return null;
  if (isFinal(m.phase)) return { tab: 'result', label: 'Claim' };
  if (stakingOpen(m.phase)) return { tab: 'stake', label: 'Stake Yes or No' };
  if (m.phase === 'locked' && tradingOpen(m, now)) return { tab: 'market', label: 'Trade YT' };
  return { tab: 'result', label: 'View result' };
}

/** One plain sentence per phase, under the primary action. */
export const PHASE_LINE: Record<Phase, string> = {
  open: 'Staking is open on Ethereum Sepolia and from Arbitrum Sepolia.',
  open_local_only: 'Cross-chain staking has closed; direct stakes stay open until the lock.',
  locked: 'Stakes are locked. YT keeps trading until maturity.',
  matured: 'Trading has ended. Waiting for the resolver to propose a result.',
  proposed: 'A result was proposed; the challenge window is running.',
  challenged: 'The proposal was challenged; the adjudicator decides.',
  final_yes: 'Final result: Yes. Yes stakes can claim their payout.',
  final_no: 'Final result: No. No stakes can claim their payout.',
  void: 'Void: every stake can claim its principal back.',
};

