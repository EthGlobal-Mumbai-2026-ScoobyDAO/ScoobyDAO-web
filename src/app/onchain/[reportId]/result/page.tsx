import type { Metadata } from 'next';
import { ResultScreen } from '@/components/result/ResultScreen';

export async function generateMetadata({ params }: { params: Promise<{ reportId: string }> }): Promise<Metadata> {
  const { reportId } = await params;
  return { title: `Result · Onchain report #${reportId}` };
}

export default async function Page({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return <ResultScreen id={decodeURIComponent(reportId)} base="/onchain" />;
}
