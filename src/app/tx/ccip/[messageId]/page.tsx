import type { Metadata } from 'next';
import { CcipTrackerPage } from '@/components/ccip/CcipTracker';

export const metadata: Metadata = { title: 'CCIP stake tracker' };

export default async function Page({ params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  return <CcipTrackerPage messageId={decodeURIComponent(messageId)} />;
}
