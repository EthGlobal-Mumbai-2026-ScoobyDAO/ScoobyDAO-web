import { RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/EmptyState';
import type { Pose } from '@/components/SniffPose';

export { EmptyState };

/** A failed or unreachable source: what failed, why, and a retry. */
export function ErrorState({
  source,
  title,
  message,
  onRetry,
  pose = 'shrug',
  action,
}: {
  /** The data source in plain words: "Research API", "Ethereum Sepolia RPC". */
  source: string;
  title?: string;
  message?: ReactNode;
  onRetry?: () => void;
  pose?: Pose;
  action?: ReactNode;
}) {
  return (
    <div role="alert">
      <EmptyState
        pose={pose}
        title={title ?? `${source} isn’t responding`}
        action={
          onRetry || action ? (
            <div className="flex flex-wrap justify-center gap-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-4 py-2 font-semibold hover:brightness-105"
                >
                  <RotateCw size={16} aria-hidden /> Retry
                </button>
              )}
              {action}
            </div>
          ) : undefined
        }
      >
        {message}
      </EmptyState>
    </div>
  );
}
