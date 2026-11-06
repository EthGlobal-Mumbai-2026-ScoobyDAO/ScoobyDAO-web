import { reportApiBase } from './reports';

export type AgentActivityStatus = {
  workerFresh: boolean;
  lastHeartbeat: number | null;
  queuedJobs: number;
  runningJobs: number;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function count(value: unknown): number {
  if (value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('Invalid job count');
  return value;
}

export function parseAgentActivity(value: unknown): AgentActivityStatus {
  if (!record(value) || typeof value.worker_fresh !== 'boolean' || !record(value.queue))
    throw new Error('Invalid activity status');
  let lastHeartbeat: number | null = null;
  if (value.worker !== null) {
    if (
      !record(value.worker) ||
      typeof value.worker.seen !== 'number' ||
      !Number.isFinite(value.worker.seen) ||
      value.worker.seen < 0 ||
      value.worker.seen > 8_640_000_000_000
    )
      throw new Error('Invalid worker heartbeat');
    lastHeartbeat = value.worker.seen;
  }
  if (value.worker_fresh && lastHeartbeat === null) throw new Error('Missing worker heartbeat');
  return {
    workerFresh: value.worker_fresh,
    lastHeartbeat,
    queuedJobs: count(value.queue.queued),
    runningJobs: count(value.queue.running),
  };
}

export async function fetchAgentActivity(base: string): Promise<AgentActivityStatus> {
  if (reportApiBase(base) !== base) throw new Error('Invalid API origin');
  const response = await fetch(`${base}/status`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
    redirect: 'error',
    credentials: 'omit',
  });
  if (!response.ok) throw new Error('Activity status unavailable');
  const status = parseAgentActivity(await response.json());
  const age = status.lastHeartbeat === null ? null : Date.now() / 1000 - status.lastHeartbeat;
  return {
    ...status,
    workerFresh: status.workerFresh && age !== null && age >= 0 && age <= 150,
  };
}
