import { formatDate } from '@/lib/format';
import { NOT_STATED, type ClaimManifest } from '@/lib/types';
import type { MarketView } from '@/protocol/types';

const show = (v?: string) => (v && v !== NOT_STATED ? v : undefined);

/**
 * The exact claim the market bets on: the claim manifest the reviewer approved (claimHash covers it).
 * Window and Void rule fall back to what the contracts enforce when the manifest doesn't state them.
 */
export function ClaimCard({
  manifest,
  market,
  size = 'md',
}: {
  manifest: ClaimManifest;
  market?: Pick<MarketView, 'lockTime' | 'maturity' | 'resultDeadline'>;
  size?: 'md' | 'xl';
}) {
  const xl = size === 'xl';
  const window =
    show(manifest.observationWindow) ??
    (market
      ? `Stakes until ${formatDate(market.lockTime)}; maturity ${formatDate(market.maturity)}; result due by ${formatDate(market.resultDeadline)}`
      : manifest.windowSeconds
        ? `Stakes open for about ${Math.round(manifest.windowSeconds / 3600)} h after publication; result after lock + 30 days`
        : undefined);
  return (
    <section aria-label="The claim" className={`rounded-xl border-2 border-[color-mix(in_srgb,var(--beam-400)_45%,transparent)] ${xl ? 'p-6' : 'p-5'}`}>
      <p className="text-muted text-sm">The claim the market bets on</p>
      <p className={`mt-1 font-semibold ${xl ? 'text-2xl leading-snug sm:text-[1.7rem]' : 'text-lg'}`}>{manifest.title}</p>
      <p className={`mt-3 leading-relaxed ${xl ? 'text-xl' : ''}`}>{manifest.claimText}</p>
      <dl className={`mt-4 grid gap-x-6 gap-y-3 ${xl ? 'text-base' : 'text-sm'} sm:grid-cols-2`}>
        <Row label="Token">
          <span className="num break-all">{manifest.token}</span>
          {manifest.symbol && <span className="text-muted"> · {manifest.symbol}</span>}
        </Row>
        <Row label="Measurement method">{show(manifest.measurementMethod) ?? <Unknown />}</Row>
        <Row label="Observation window">{window ?? <Unknown />}</Row>
        <Row label="Void rule">
          {show(manifest.voidRule) ?? (
            <>
              Void if one side has no stakes, or if no result is final by the result deadline. Void refunds principal pro
              rata, no fee. <span className="text-muted">(enforced by the contract)</span>
            </>
          )}
        </Row>
        <Row label="Report digest (report_sha256)">
          <span className="num break-all">{manifest.reportSha256}</span>
        </Row>
        {manifest.assessmentStatus && <Row label="Assessment status">{manifest.assessmentStatus.replace(/_/g, ' ')}</Row>}
      </dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

const Unknown = () => <span className="text-muted italic">not stated in the claim manifest</span>;
