import type { Metadata } from 'next';
import { ApproveScreen } from './ApproveScreen';

export const metadata: Metadata = { title: 'Human sign-off' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApproveScreen id={decodeURIComponent(id)} />;
}
