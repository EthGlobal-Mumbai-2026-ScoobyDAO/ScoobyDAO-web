import type { Metadata } from 'next';
import { ScoutingBoard } from '@/components/cases/ScoutingBoard';

export const metadata: Metadata = { title: 'Case board' };

export default function Page() {
  return <ScoutingBoard />;
}
