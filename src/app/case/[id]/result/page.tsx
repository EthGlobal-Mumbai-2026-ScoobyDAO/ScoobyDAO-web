import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ResultScreen } from '@/components/result/ResultScreen';
import { env } from '@/lib/env';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Result · Case #${id}` };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  // Live V2 cases are onchain reports: /case/<id>/* resolves to /onchain/<id>/* (never a backend mapping).
  if (env.chainMode === 'live' && env.protocol === 'v2' && /^\d+$/.test(id)) redirect(`/onchain/${id}/result`);
  return <ResultScreen id={id} />;
}
