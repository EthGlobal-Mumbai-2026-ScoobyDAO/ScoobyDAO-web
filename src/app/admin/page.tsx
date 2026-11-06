import type { Metadata } from 'next';
import { ReviewDesk } from './ReviewDesk';

export const metadata: Metadata = { title: 'Review desk' };

export default function Page() {
  return <ReviewDesk />;
}
