// Placeholder mascot poses (original art) until the illustrated set exists; see THEME.md §1.3.
// Each pose is the same head with a different expression and prop.

export type Pose =
  | 'idle'
  | 'sniffing'
  | 'thinking'
  | 'alert'
  | 'triumphant'
  | 'sad'
  | 'asleep'
  | 'confused'
  | 'shrug';

const LABEL: Record<Pose, string> = {
  idle: 'Sniff the detective hound',
  sniffing: 'Sniff, nose to the ground, sniffing for clues',
  thinking: 'Sniff thinking, paw on chin',
  alert: 'Sniff on alert, ears up, flashlight on',
  triumphant: 'Sniff holding up a pulled-off mask',
  sad: 'Sniff looking sad',
  asleep: 'Sniff asleep',
  confused: 'Sniff looking confused',
  shrug: 'Sniff shrugging',
};

export function SniffPose({
  pose = 'idle',
  size = 120,
  decorative = false,
}: {
  pose?: Pose;
  size?: number;
  decorative?: boolean;
}) {
  const eyesClosed = pose === 'asleep';
  const earsUp = pose === 'alert' || pose === 'triumphant';
  const sad = pose === 'sad';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : LABEL[pose]}
    >
      {/* ears */}
      <g fill="#8a5a2b">
        {earsUp ? (
          <>
            <path d="M30 40c-10-10-14-26-6-30 6-2 14 10 18 24Z" />
            <path d="M90 40c10-10 14-26 6-30-6-2-14 10-18 24Z" />
          </>
        ) : (
          <>
            <path
              d="M32 34c-16 4-20 32-12 52 4 8 12 8 15 0l8-36Z"
              transform={sad ? 'rotate(8 32 34)' : undefined}
            />
            <path
              d="M88 34c16 4 20 32 12 52-4 8-12 8-15 0l-8-36Z"
              transform={sad ? 'rotate(-8 88 34)' : undefined}
            />
          </>
        )}
      </g>
      {/* head + muzzle */}
      <path
        d="M36 38c0-14 11-22 24-22s24 8 24 22v30c0 18-11 32-24 32S36 86 36 68Z"
        fill="#d9a066"
      />
      <path d="M46 72c0-6 6-8 14-8s14 2 14 8v8c0 11-6 18-14 18s-14-7-14-18Z" fill="#f3e2c4" />
      <ellipse cx="60" cy="72" rx="8" ry="5.5" fill="#1b1410" />
      {/* hat brim (teal coat colour) */}
      <path d="M33 36Q60 20 87 36L85 27Q60 8 35 27Z" fill="#2ec4b6" />
      <path d="M42 26Q60 14 78 26" stroke="#1f8f85" strokeWidth="3" fill="none" />
      {/* eyes */}
      {eyesClosed ? (
        <g stroke="#1b1410" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M46 52q4 3 8 0M66 52q4 3 8 0" />
        </g>
      ) : (
        <g>
          <ellipse cx="50" cy="52" rx="4" ry={sad ? 3 : 4.5} fill="#1b1410" />
          <ellipse cx="70" cy="52" rx="4" ry={sad ? 3 : 4.5} fill="#1b1410" />
          <path
            d={sad ? 'M44 44l10 3M76 44l-10 3' : 'M44 46q6-4 12 0M64 46q6-4 12 0'}
            stroke="#8a5a2b"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      )}
      {/* props */}
      {pose === 'asleep' && (
        <g fill="var(--ghost-ink, #b8a9ff)" fontFamily="var(--font-display)" fontSize="14">
          <text x="88" y="26">
            z
          </text>
          <text x="98" y="14" fontSize="10">
            z
          </text>
        </g>
      )}
      {pose === 'confused' && (
        <text
          x="90"
          y="30"
          fontFamily="var(--font-display)"
          fontSize="26"
          fill="var(--beam-ink, #ffc857)"
        >
          ?
        </text>
      )}
      {pose === 'sniffing' && (
        <g stroke="var(--fog-400, #7a86b8)" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M44 100q-6 4-12 0M60 106q0 6-6 9M76 100q6 4 12 0" />
        </g>
      )}
      {pose === 'thinking' && (
        <circle cx="84" cy="92" r="9" fill="#d9a066" stroke="#8a5a2b" strokeWidth="2" />
      )}
      {pose === 'alert' && (
        <g>
          <rect
            x="88"
            y="62"
            width="16"
            height="9"
            rx="2"
            fill="#b0892f"
            transform="rotate(-20 96 66)"
          />
          <path d="M104 58l14-10v28Z" fill="var(--beam-400, #ffc857)" opacity="0.55" />
        </g>
      )}
      {pose === 'triumphant' && (
        <g transform="translate(84 6) rotate(18)">
          <ellipse
            cx="14"
            cy="12"
            rx="15"
            ry="10"
            fill="#e8b84a"
            stroke="#8a5a00"
            strokeWidth="2"
          />
          <ellipse cx="8" cy="11" rx="3" ry="2" fill="#1b1410" />
          <ellipse cx="20" cy="11" rx="3" ry="2" fill="#1b1410" />
        </g>
      )}
      {pose === 'shrug' && (
        <g stroke="#8a5a2b" strokeWidth="4" fill="none" strokeLinecap="round">
          <path d="M22 96q-6-10 2-16M98 96q6-10-2-16" />
        </g>
      )}
    </svg>
  );
}
