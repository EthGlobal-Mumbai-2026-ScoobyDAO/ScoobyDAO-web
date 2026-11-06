'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchDiagnostics } from '@/lib/diagnostics';
import { Identicon } from '@/components/Identicon';
export function DiagnosticsBoard({ origin }: { origin: string }) {
  const q = useQuery({
    queryKey: ['historical-diagnostics', origin],
    queryFn: () => fetchDiagnostics(origin),
    retry: false,
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });
  if (q.isPending)
    return (
      <p role="status" className="text-muted mt-8 text-sm">
        Loading historical diagnostic status…
      </p>
    );
  if (q.isError)
    return (
      <p role="status" className="text-muted mt-8 text-sm">
        Historical diagnostic status unavailable.{' '}
        <button type="button" className="underline" onClick={() => void q.refetch()}>
          Retry
        </button>
      </p>
    );
  if (!q.data?.length) return null;
  return (
    <section className="mt-10" aria-label="User-requested historical diagnostics">
      <h2 className="text-2xl font-semibold">User-requested historical diagnostics</h2>
      <p className="text-muted mt-1 max-w-3xl text-sm">
        Separate from live scouting admission. These entries are not case-admitted and have not
        passed World ID verification; drafts remain pending review.
      </p>
      <div className="cork mt-4 rounded-2xl p-5 sm:p-8">
        <ul className="grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.map((d) => (
            <li key={d.candidate_id}>
              <article className="paper-plain relative h-full min-w-0 p-4 pt-6 [overflow-wrap:anywhere]">
                <span
                  aria-hidden
                  className="bg-mask absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full shadow-[inset_-2px_-2px_0_rgb(0_0_0/0.25),0_2px_3px_rgb(0_0_0/0.4)]"
                />
                <div className="flex items-start gap-3">
                  <Identicon address={d.candidate_id.split(':')[1]} size={44} />
                  <div>
                    <h3 className="font-semibold">{d.label}</h3>
                    <p className="text-muted text-xs break-all">{d.candidate_id}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold">{d.state.replaceAll('_', ' ')}</p>
                <p className="mt-1 text-sm">{d.detail}</p>
                {d.attempt && (
                  <p className="text-muted mt-2 text-xs">
                    Model status: {d.attempt.model_status.replaceAll('_', ' ')}
                  </p>
                )}
                {d.report && d.state !== 'held_for_review' ? (
                  <Link
                    className="text-beam-ink mt-3 inline-block text-sm font-semibold underline"
                    href={`/reports/${encodeURIComponent(`${d.report.id}~${d.report.version}`)}`}
                  >
                    Open diagnostic report →
                  </Link>
                ) : (
                  <p className="text-muted mt-3 text-xs">
                    {d.state === 'held_for_review'
                      ? 'Report held for review.'
                      : 'No report available in the library.'}
                  </p>
                )}
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
