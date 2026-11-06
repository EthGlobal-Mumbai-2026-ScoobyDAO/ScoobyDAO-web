import type { Metadata } from 'next';
import { OnchainDashboard } from '@/components/onchain/OnchainDashboard';

export async function generateMetadata({ params }: { params: Promise<{ reportId: string }> }): Promise<Metadata> {
  const { reportId } = await params;
  return { title: `Onchain report #${reportId}` };
}

export default async function Page({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return <OnchainDashboard id={decodeURIComponent(reportId)} />;
}
