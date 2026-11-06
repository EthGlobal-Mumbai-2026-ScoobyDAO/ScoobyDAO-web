import type { Metadata } from 'next';
import { StakeScreen } from '@/components/stake/StakeScreen';

export async function generateMetadata({ params }: { params: Promise<{ reportId: string }> }): Promise<Metadata> {
  const { reportId } = await params;
  return { title: `Stake · Onchain report #${reportId}` };
}

export default async function Page({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return <StakeScreen id={decodeURIComponent(reportId)} base="/onchain" />;
}
