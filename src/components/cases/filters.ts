import type { CaseStatus } from '@/lib/status';

/** The five board groups shown in the segmented control. */
export type CaseGroup = 'all' | 'review' | 'open' | 'settling' | 'closed';

export const CASE_GROUPS: { key: CaseGroup; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'review', label: 'Under review' },
  { key: 'open', label: 'Open' },
  { key: 'settling', label: 'Settling' },
  { key: 'closed', label: 'Closed' },
];

/**
 * Exact phase → board group.
 * - Under review: a report exists but no human has approved it yet (draft, awaiting approval).
 * - Open: approved and staking (or publication reported, waiting for the case file's onchain check).
 * - Settling: stakes locked and the verdict is being worked out (locked, matured, proposed, challenged).
 * - Closed: nothing more will happen (final Yes/No, Void, and reports that were denied or expired before opening).
 */
export const GROUP_OF: Record<CaseStatus, Exclude<CaseGroup, 'all'>> = {
  draft: 'review',
  awaiting_approval: 'review',
  published: 'open',
  open: 'open',
  open_local_only: 'open',
  locked: 'settling',
  matured: 'settling',
  proposed: 'settling',
  challenged: 'settling',
  final_yes: 'closed',
  final_no: 'closed',
  void: 'closed',
  denied: 'closed',
  expired: 'closed',
};

export const inGroup = (status: CaseStatus, group: CaseGroup) =>
  group === 'all' || GROUP_OF[status] === group;
