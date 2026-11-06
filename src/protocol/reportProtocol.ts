import type { Protocol } from './types';
import { bundleForMarket } from './dynamicMarket';
import type { ReportChoice } from './reportDiscovery';
import { v2, v2Flexible, v2ForBundle } from './v2';

export type ReportProtocol = Protocol & { kind: 'v2'; deploymentKey: string; deploymentBundle: typeof v2.deploymentBundle };

/** Catalog markets use dynamic bundles; the two pre-catalog report #1 demos use their checked-in bundles. */
export function protocolForReport(report: ReportChoice): ReportProtocol | undefined {
  if (report.market && report.report) return v2ForBundle(bundleForMarket(report));
  const fallback = report.deployment === 'flexible' ? v2Flexible : v2;
  return report.tradable && BigInt(report.id) === fallback.deploymentBundle.reportId ? fallback : undefined;
}
