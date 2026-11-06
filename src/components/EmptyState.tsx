import type { ReactNode } from 'react';
import { SniffPose, type Pose } from './SniffPose';

export function EmptyState({
  pose,
  title,
  children,
  action,
}: {
  pose: Pose;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <SniffPose pose={pose} size={132} />
      <h2 className="font-display mt-4 text-2xl">{title}</h2>
      {children && <div className="text-muted mt-2 max-w-md">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
