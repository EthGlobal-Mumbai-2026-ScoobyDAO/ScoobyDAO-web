import { SniffPose } from '@/components/SniffPose';
import { Page } from '@/components/ui';

/** Route-level loading: Sniff on the trail above a calm page skeleton. */
export default function Loading() {
  return (
    <Page className="space-y-6">
      <div aria-busy="true" role="status" aria-label="Loading" className="space-y-6">
        <div className="flex items-end gap-4">
          <SniffPose pose="sniffing" size={96} decorative />
          <div className="flex-1 space-y-3 pb-3">
            <div className="sweep h-10 w-64 max-w-full" />
            <div className="sweep h-4 w-full max-w-md" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="sweep h-56" />
          <div className="sweep h-56" />
        </div>
      </div>
    </Page>
  );
}
