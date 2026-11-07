import type { Metadata } from 'next';
import { ReviewDesk } from '../ReviewDesk';

export const metadata: Metadata = { title: 'Decided reports · Review desk' };

export default function Page() {
  return <ReviewDesk view="decided" />;
}
