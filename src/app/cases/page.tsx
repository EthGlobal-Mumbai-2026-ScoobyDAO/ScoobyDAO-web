import type { Metadata } from 'next';
import { CasesBoard } from '@/components/cases/CasesBoard';

export const metadata: Metadata = { title: 'Case board' };

export default function Page() {
  return <CasesBoard />;
}
