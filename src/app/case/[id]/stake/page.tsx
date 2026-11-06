import type { Metadata } from 'next';
import { StakeScreen } from '@/components/stake/StakeScreen';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Stake · Case #${id}` };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StakeScreen id={decodeURIComponent(id)} />;
}
