import { SniffPose } from '@/components/SniffPose';

/** 2D Sniff for the hero: teal trench coat + head, drawn to match the 3D placeholder's silhouette. */
export function StandingSniff() {
  return (
    <div className="absolute inset-0">
      <svg
        viewBox="0 0 120 160"
        className="absolute inset-x-0 bottom-0 h-[62%] w-full"
        preserveAspectRatio="xMidYMax meet"
      >
        <polygon points="60,8 14,158 106,158" fill="#2ec4b6" />
        <polygon points="60,8 60,158 106,158" fill="#1f8f85" />
        <path d="M60 20 L48 70 L60 64 L72 70 Z" fill="#17706a" />
        <circle cx="60" cy="96" r="3" fill="#b0892f" />
        <circle cx="60" cy="118" r="3" fill="#b0892f" />
        <rect
          x="76"
          y="92"
          width="16"
          height="9"
          rx="2"
          fill="#b0892f"
          transform="rotate(-20 84 96)"
        />
      </svg>
      <div className="absolute top-0 left-1/2 w-[78%] -translate-x-1/2">
        <SniffPose pose="idle" size={200} decorative />
      </div>
    </div>
  );
}
