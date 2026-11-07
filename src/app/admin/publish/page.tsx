import type { Metadata } from 'next';
import { PublishList } from '@/components/admin/PublishList';

export const metadata: Metadata = { title: 'Publish · Review desk' };

export default function Page() {
  return <PublishList />;
}
