'use client';

import { useQuery } from '@tanstack/react-query';
import { api, usingFixtures } from './api';
import type { Approval } from './types';

export const qk = {
  reports: ['reports'] as const,
  report: (id: string) => ['report', id] as const,
  approval: (id: string) => ['approval', id] as const,
  claim: (id: string) => ['claim', id] as const,
  deployments: ['deployments'] as const,
  mode: ['api-mode'] as const,
};

export const useFixturesMode = () => useQuery({ queryKey: qk.mode, queryFn: usingFixtures, staleTime: Infinity });
export const useReports = () => useQuery({ queryKey: qk.reports, queryFn: () => api.getReports() });
export const useReport = (id: string | undefined) =>
  useQuery({ queryKey: qk.report(id ?? ''), queryFn: () => api.getReport(id!), enabled: !!id });
export const useClaim = (claimId: string | undefined, opts: { poll?: boolean } = {}) =>
  useQuery({
    queryKey: qk.claim(claimId ?? ''),
    queryFn: () => api.getClaim(claimId!),
    enabled: !!claimId,
    refetchInterval: opts.poll ? 5000 : false,
  });

const FINAL: Approval['status'][] = ['approved', 'spent', 'denied', 'expired', 'rejected_not_reviewer'];

/** Polls GET /approvals/:id every 2s until the backend reports a final status. */
export const useApproval = (id: string) =>
  useQuery({
    queryKey: qk.approval(id),
    queryFn: () => api.getApproval(id),
    refetchInterval: (q) => (q.state.data && FINAL.includes(q.state.data.status) ? false : 2000),
    refetchIntervalInBackground: true,
  });
