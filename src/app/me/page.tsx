import type { Metadata } from 'next';
import { PositionsScreen } from '@/components/me/PositionsScreen';
import { listReportChoices } from '@/protocol/reportDiscovery';

export const metadata: Metadata = { title: 'My positions' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const reports = await listReportChoices();
  return <PositionsScreen reports={reports} />;
}
