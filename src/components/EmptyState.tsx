import type { ReactNode } from 'react';
import { SniffPose, type Pose } from './SniffPose';

export function EmptyState({
  pose,
  title,
  children,
  action,
  as: Heading = 'h2',
}: {
  pose: Pose;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** h1 when the empty state is the whole page (404s). */
  as?: 'h1' | 'h2';
}) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <SniffPose pose={pose} size={132} />
      <Heading className="font-display mt-4 text-2xl">{title}</Heading>
      {children && <div className="text-muted mt-2 max-w-md">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
