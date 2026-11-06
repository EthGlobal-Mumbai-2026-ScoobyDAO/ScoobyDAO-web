import type { Metadata } from 'next';
import { MarketScreen } from '@/components/market/MarketScreen';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ claimId: string }>;
}): Promise<Metadata> {
  const { claimId } = await params;
  return { title: `Trade · Case #${claimId}` };
}

export default async function Page({ params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  return <MarketScreen claimId={decodeURIComponent(claimId)} />;
}
