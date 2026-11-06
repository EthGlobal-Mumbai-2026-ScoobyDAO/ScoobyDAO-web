import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OperatorScreen } from '@/components/operator/OperatorScreen';
import { env } from '@/lib/env';

export const metadata: Metadata = { title: 'Operator', robots: { index: false, follow: false } };

/** Only with NEXT_PUBLIC_OPERATOR_VIEW=true; otherwise the route doesn't exist. */
export default function Page() {
  if (!env.operatorView) notFound();
  return <OperatorScreen />;
}
