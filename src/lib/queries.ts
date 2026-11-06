'use client';

import { useQuery } from '@tanstack/react-query';
import { api, usingFixtures } from './api';
import type { Approval, WebReport } from './types';

export const qk = {
  reports: ['reports'] as const,
  report: (id: string) => ['report', id] as const,
  approval: (id: string) => ['approval', id] as const,
  mode: ['api-mode'] as const,
};

export const useFixturesMode = () => useQuery({ queryKey: qk.mode, queryFn: usingFixtures, staleTime: Infinity });
export const useReports = (opts: { pollMs?: number; enabled?: boolean } = {}) =>
  useQuery({ queryKey: qk.reports, queryFn: () => api.getReports(), refetchInterval: opts.pollMs ?? false, enabled: opts.enabled ?? true });
export const useReport = (id: string | undefined, opts: { pollMs?: number | false } = {}) =>
  useQuery({
    queryKey: qk.report(id ?? ''),
    queryFn: () => api.getReport(id!),
    enabled: !!id,
    refetchInterval: opts.pollMs ?? false,
  });

export const FINAL_APPROVAL: Approval['status'][] = ['spent', 'denied', 'expired', 'rejected_not_reviewer', 'error'];

/** Polls GET /approvals/:id every 2 s until the backend reports a final status. */
export const useApproval = (id: string) =>
  useQuery({
    queryKey: qk.approval(id),
    queryFn: () => api.getApproval(id),
    refetchInterval: (q) => (q.state.data && FINAL_APPROVAL.includes(q.state.data.status) ? false : 2000),
    refetchIntervalInBackground: true,
  });

export type { WebReport };
