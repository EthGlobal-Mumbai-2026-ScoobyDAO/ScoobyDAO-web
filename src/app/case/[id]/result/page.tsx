import type { Metadata } from 'next';
import { ResultScreen } from '@/components/result/ResultScreen';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Result · Case #${id}` };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultScreen id={decodeURIComponent(id)} />;
}
