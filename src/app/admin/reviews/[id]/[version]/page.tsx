import type { Metadata } from 'next';
import Link from 'next/link';
import { GatedReviewScreen } from '@/components/admin/ReviewScreen';

export const metadata: Metadata = { title: 'Review report' };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; version: string }>;
}) {
  const { id, version } = await params;
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <p className="mb-4">
        <Link href="/admin" className="text-muted underline underline-offset-4">
          ← Review desk
        </Link>
      </p>
      <GatedReviewScreen id={decodeURIComponent(id)} version={decodeURIComponent(version)} />
    </main>
  );
}
