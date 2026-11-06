import type { Metadata } from 'next';
import { MarketScreen } from '@/components/market/MarketScreen';

export async function generateMetadata({ params }: { params: Promise<{ reportId: string }> }): Promise<Metadata> {
  const { reportId } = await params;
  return { title: `Trade YT · Onchain report #${reportId}` };
}

export default async function Page({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return <MarketScreen id={decodeURIComponent(reportId)} base="/onchain" />;
}
