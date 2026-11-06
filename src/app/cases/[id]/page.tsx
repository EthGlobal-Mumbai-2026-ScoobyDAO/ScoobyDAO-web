import type { Metadata } from 'next';
import { CaseFile } from '@/components/cases/CaseFile';

export const metadata: Metadata = { title: 'Case file' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseFile id={decodeURIComponent(id)} />;
}
