import type { Metadata } from 'next';
import { PublicReport } from '@/components/reports/PublicReport';

export const metadata: Metadata = { title: 'Report' };

export default async function Page({ params }: { params: Promise<{ id: string; version: string }> }) {
  const { id, version } = await params;
  return <PublicReport id={decodeURIComponent(id)} version={decodeURIComponent(version)} />;
}
