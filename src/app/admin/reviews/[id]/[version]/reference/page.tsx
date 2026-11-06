import type { Metadata } from 'next';
import Link from 'next/link';
import { GatedReferenceReader } from '@/components/reference/ReferenceReader';

export const metadata: Metadata = { title: 'Historical reference report' };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; version: string }>;
}) {
  const { id, version } = await params;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <p className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/cases" className="text-muted underline underline-offset-4">
          ← Case board
        </Link>
        <Link href="/admin" className="text-muted underline underline-offset-4">
          Review desk
        </Link>
      </p>
      <GatedReferenceReader id={decodeURIComponent(id)} version={decodeURIComponent(version)} />
    </main>
  );
}
