import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <EmptyState
        as="h1"
        pose="sad"
        title="This case went cold."
        action={
          <Link
            href="/cases"
            className="bg-beam text-on-beam rounded-xl px-5 py-3 font-semibold hover:brightness-105"
          >
            Back to the case board
          </Link>
        }
      >
        Sniff followed the trail to this address and found nothing. The link may be wrong, or the
        case was never filed.
      </EmptyState>
    </main>
  );
}
