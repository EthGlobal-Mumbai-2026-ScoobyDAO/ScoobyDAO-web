import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { reviewHref } from '@/components/admin/reviewMeta';
import { GatedReferenceReader } from '@/components/reference/ReferenceReader';

export const metadata: Metadata = { title: 'Historical reference report' };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; version: string }>;
}) {
  const { id, version } = await params;
  const ident = { report_id: decodeURIComponent(id), report_version: decodeURIComponent(version) };
  return (
    <main className="py-8 sm:py-10">
      <p className="mb-6 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Link href={reviewHref(ident)} className="text-muted hover:text-text inline-flex items-center gap-1.5">
          <ArrowLeft size={14} aria-hidden /> Review workspace
        </Link>
        <Link href="/cases" className="text-muted hover:text-text">
          Case board
        </Link>
      </p>
      <GatedReferenceReader id={ident.report_id} version={ident.report_version} />
    </main>
  );
}
