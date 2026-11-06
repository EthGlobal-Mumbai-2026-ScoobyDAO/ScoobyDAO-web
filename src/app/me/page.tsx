import type { Metadata } from 'next';
import { PositionsScreen } from '@/components/me/PositionsScreen';

export const metadata: Metadata = { title: 'My positions' };

export default function Page() {
  return <PositionsScreen />;
}
