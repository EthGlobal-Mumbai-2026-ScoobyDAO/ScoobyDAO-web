'use client';

import { useQuery } from '@tanstack/react-query';
import { InfoTip } from '@/components/ui';
import { fetchAgentActivity } from '@/lib/agentActivity';
import { reportApiBase } from '@/lib/reports';

const configured =
  process.env.NEXT_PUBLIC_REPORT_API_URL === undefined
    ? 'https://scoobydao-backend.onrender.com'
    : process.env.NEXT_PUBLIC_REPORT_API_URL;
const base = reportApiBase(configured);

const CAVEAT =
  'Token activity unavailable: the live token-by-token screening feed is not connected yet. A worker heartbeat shows that the worker is responding; it does not mean tokens are being scanned.';

/** Scout worker status as a small header pill; details live in the popover. */
export function AgentActivity() {
  const query = useQuery({
    queryKey: ['agent-activity', base],
    queryFn: () => fetchAgentActivity('/api/research'),
    enabled: Boolean(base),
    retry: false,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const data = query.isError ? undefined : query.data;
  const heartbeat = data?.lastHeartbeat ?? null;
  const worker = !base
    ? configured
      ? 'Activity API configuration is invalid.'
      : 'Connect the reports API to see worker status.'
    : query.isPending
      ? 'Checking worker status…'
      : query.isError || !data
        ? 'Worker status unavailable. The connection will be retried.'
        : heartbeat === null
          ? 'No worker heartbeat recorded'
          : data.workerFresh
            ? 'Worker heartbeat active'
            : 'Worker heartbeat not current';
  const online = !!data?.workerFresh;
  const pill = !base ? 'not connected' : query.isPending ? 'checking…' : online ? 'online' : 'offline';
  const dot = online ? 'bg-clue' : query.isPending ? 'bg-beam' : 'bg-[var(--fog-400)]';

  return (
    <div role="status" className="inline-flex items-center gap-1">
      <span className="border-line inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
        <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        Scout: {pill}
        <span className="sr-only">
          . {worker}. {CAVEAT}
        </span>
      </span>
      <InfoTip label="About the scout status" align="end">
        <strong className="block">{worker}</strong>
        {data && (
          <span className="text-muted mt-1 block">
            {data.runningJobs} running · {data.queuedJobs} queued
            {heartbeat !== null && <> · last heartbeat {new Date(heartbeat * 1000).toLocaleString()}</>}
          </span>
        )}
        <span className="text-muted mt-1 block">{CAVEAT}</span>
      </InfoTip>
    </div>
  );
}
