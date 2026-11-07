import Link from 'next/link';
import { EmptyState, Page } from '@/components/ui';

export default function NotFound() {
  return (
    <Page className="grid min-h-[60vh] place-items-center">
      <EmptyState
        as="h1"
        pose="shrug"
        title="This case went cold."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/cases" className="bg-beam text-on-beam rounded-xl px-5 py-3 font-semibold hover:brightness-105">
              Browse cases
            </Link>
            <Link href="/" className="border-line hover:border-text rounded-xl border px-5 py-3 font-semibold">
              Home
            </Link>
          </div>
        }
      >
        Nothing is filed at this address. The link may be wrong.
      </EmptyState>
    </Page>
  );
}
