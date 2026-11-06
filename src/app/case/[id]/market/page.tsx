import type { Metadata } from 'next';
import { MarketScreen } from '@/components/market/MarketScreen';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Trade YT · Case #${id}` };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MarketScreen id={decodeURIComponent(id)} />;
}
