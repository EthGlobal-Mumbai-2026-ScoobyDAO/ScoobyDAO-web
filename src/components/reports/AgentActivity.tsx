'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchAgentActivity } from '@/lib/agentActivity';
import { reportApiBase } from '@/lib/reports';

const configured = process.env.NEXT_PUBLIC_REPORT_API_URL === undefined ? 'https://scoobydao-backend.onrender.com' : process.env.NEXT_PUBLIC_REPORT_API_URL;
const base = reportApiBase(configured);

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
  const worker = !data
    ? null
    : heartbeat === null
      ? 'No worker heartbeat recorded'
      : data.workerFresh
        ? 'Worker heartbeat active'
        : 'Worker heartbeat not current';

  return (
    <section
      className="border-line bg-surface mt-6 rounded-xl border p-5"
      aria-labelledby="agent-activity-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-beam-ink text-xs font-semibold tracking-wider uppercase">
            Agent activity
          </p>
          <h2 id="agent-activity-title" className="mt-1 text-xl font-semibold">
            Discovery monitor
          </h2>
        </div>
        <span className="border-line text-muted rounded-full border px-3 py-1 text-xs font-medium">
          Token activity unavailable
        </span>
      </div>
      <p className="text-muted mt-3 max-w-3xl text-sm">
        The live token-by-token screening feed is not connected yet. A worker heartbeat shows that
        the worker is responding; it does not mean tokens are being scanned.
      </p>
      <div className="mt-4" role="status">
        {!base ? (
          <p className="text-sm">
            {configured
              ? 'Activity API configuration is invalid.'
              : 'Connect the reports API to see worker status.'}
          </p>
        ) : query.isPending ? (
          <p className="text-sm">Checking worker status…</p>
        ) : query.isError ? (
          <p className="text-sm">Worker status unavailable. The connection will be retried.</p>
        ) : data ? (
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted text-xs">Worker</p>
              <p className="mt-1 font-medium">{worker}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Running jobs</p>
              <p className="mt-1 font-medium">{data.runningJobs}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Queued jobs</p>
              <p className="mt-1 font-medium">{data.queuedJobs}</p>
            </div>
          </div>
        ) : null}
      </div>
      {data && heartbeat !== null && (
        <p className="text-muted mt-3 text-xs">
          Last worker heartbeat: {new Date(heartbeat * 1000).toLocaleString()}
        </p>
      )}
    </section>
  );
}
