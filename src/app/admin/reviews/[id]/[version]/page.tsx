import type { Metadata } from 'next';
import { GatedReviewScreen } from '@/components/admin/ReviewScreen';

export const metadata: Metadata = { title: 'Review report' };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; version: string }>;
}) {
  const { id, version } = await params;
  return <GatedReviewScreen id={decodeURIComponent(id)} version={decodeURIComponent(version)} />;
}
