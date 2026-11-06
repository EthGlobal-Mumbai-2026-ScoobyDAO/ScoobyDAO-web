import type { Metadata } from 'next';
import { StakeScreen } from '@/components/stake/StakeScreen';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ claimId: string }>;
}): Promise<Metadata> {
  const { claimId } = await params;
  return { title: `Stake · Case #${claimId}` };
}

export default async function Page({ params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  return <StakeScreen claimId={decodeURIComponent(claimId)} />;
}
