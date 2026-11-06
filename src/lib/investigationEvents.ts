import { scoutingApiOrigin } from './scouting';

export type InvestigationEvent = {
  seq: number;
  run_id: string;
  kind: string;
  detail: string;
  created: number;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const safeId = /^[a-zA-Z0-9_-]{1,128}$/;

/** An event belongs to exactly one run; never splice another run's output into this view. */
export function parseInvestigationEvents(value: unknown, runId: string): InvestigationEvent[] {
  if (!safeId.test(runId) || !Array.isArray(value) || value.length > 1000)
    throw new Error('Invalid investigation events');
  let last = 0;
  return value.map((event) => {
    if (
      !record(event) ||
      !Number.isSafeInteger(event.seq) ||
      (event.seq as number) <= last ||
      event.run_id !== runId ||
      typeof event.kind !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(event.kind) ||
      typeof event.detail !== 'string' ||
      event.detail.length > 10000 ||
      typeof event.created !== 'number' ||
      !Number.isFinite(event.created) ||
      event.created < 0 ||
      event.created > 8_640_000_000
    )
      throw new Error('Invalid investigation event');
    last = event.seq as number;
    return event as InvestigationEvent;
  });
}
export async function fetchInvestigationEvents(
  origin: string,
  runId: string,
): Promise<InvestigationEvent[]> {
  if (scoutingApiOrigin(origin) !== origin || !safeId.test(runId))
    throw new Error('Invalid investigation endpoint');
  const response = await fetch(`${origin}/investigations/${encodeURIComponent(runId)}/events`, {
    cache: 'no-store',
    redirect: 'error',
    credentials: 'omit',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Investigation events unavailable');
  return parseInvestigationEvents(await response.json(), runId);
}
