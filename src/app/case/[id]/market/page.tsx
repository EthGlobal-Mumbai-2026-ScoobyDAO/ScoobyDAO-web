import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MarketScreen } from '@/components/market/MarketScreen';
import { env } from '@/lib/env';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Trade YT · Case #${id}` };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  // Live V2 cases are onchain reports: /case/<id>/* resolves to /onchain/<id>/* (never a backend mapping).
  if (env.chainMode === 'live' && env.protocol === 'v2' && /^\d+$/.test(id)) redirect(`/onchain/${id}/market`);
  return <MarketScreen id={id} />;
}
