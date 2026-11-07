import { SniffPose } from '@/components/SniffPose';

/** 2D Sniff for the hero (no WebGL, touch, reduced motion): the full-body trench-coat figure. */
export function StandingSniff() {
  return (
    <div className="absolute inset-x-[-12%] bottom-[-4%] [&>svg]:h-auto [&>svg]:w-full">
      <SniffPose pose="idle" size={240} decorative />
    </div>
  );
}
