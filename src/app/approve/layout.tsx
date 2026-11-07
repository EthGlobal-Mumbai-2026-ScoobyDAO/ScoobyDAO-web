import type { ReactNode } from 'react';
import { ReviewerShell } from '@/components/admin/ReviewerShell';

export default function Layout({ children }: { children: ReactNode }) {
  return <ReviewerShell>{children}</ReviewerShell>;
}
