import { notFound } from 'next/navigation';
import { MarketReportView } from '@/components/market/MarketReportView';
import { listReportChoices } from '@/protocol/reportDiscovery';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ deployment: string; reportId: string; section?: string[] }> }) {
  const { deployment, reportId, section = [] } = await params;
  if (!['original', 'flexible'].includes(deployment) || !/^\d+$/.test(reportId) || section.length > 1) notFound();
  const tab = section[0] ?? 'overview';
  if (!['overview', 'stake', 'market', 'result', 'chains'].includes(tab)) notFound();
  const choices = await listReportChoices();
  if (!choices.some(x => x.deployment === deployment && x.id === reportId)) notFound();
  return <MarketReportView deployment={deployment as 'original' | 'flexible'} reportId={reportId} tab={tab as 'overview' | 'stake' | 'market' | 'result' | 'chains'} choices={choices} />;
}
