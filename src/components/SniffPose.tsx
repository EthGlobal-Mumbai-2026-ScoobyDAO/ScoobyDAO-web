// Sniff, the original basset-hound detective (THEME.md §1.3), drawn in code.
// Every pose shares one face and one body (stocky basset, long ears, teal trench coat); the pose
// changes the head angle, ears, arms and the prop so each job reads at 96–160px:
// sniffing = loading, thinking = empty, alert = action needed, triumphant = success,
// sad = denied/expired, shrug = unavailable. No gradients or ids, so many can share a page.

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

export const POSES: readonly Pose[] = [
  'idle',
  'sniffing',
  'thinking',
  'alert',
  'triumphant',
  'sad',
  'asleep',
  'confused',
  'shrug',
];

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

const C = {
  fur: '#d9a066',
  furDark: '#b9813f',
  cream: '#f3e2c4',
  ear: '#8a5a2b',
  ink: '#1b1410',
  coat: '#2ec4b6',
  coatShade: '#1f9e93',
  coatDeep: '#17706a',
  brass: '#c99a32',
  brassDark: '#8a6414',
  glass: '#dff6f3',
};

type Head = {
  /** rotation in degrees around the neck */
  r: number;
  dx: number;
  dy: number;
  ears: 'down' | 'up' | 'droop';
  /** pupil offset */
  look: [number, number];
  eyes: 'open' | 'closed' | 'wide';
  brows: 'kind' | 'sad' | 'raised' | 'focus';
  mouth?: 'smile' | 'frown' | 'o';
};

const HEAD: Record<Pose, Head> = {
  idle: { r: 0, dx: 0, dy: 0, ears: 'down', look: [0, 0], eyes: 'open', brows: 'kind' },
  sniffing: { r: 34, dx: 14, dy: 16, ears: 'down', look: [1, 2], eyes: 'open', brows: 'focus' },
  thinking: { r: -10, dx: 0, dy: 0, ears: 'down', look: [1.5, -1.8], eyes: 'open', brows: 'raised' },
  alert: { r: 6, dx: 0, dy: 3, ears: 'up', look: [1.6, 0], eyes: 'wide', brows: 'raised', mouth: 'o' },
  triumphant: { r: -6, dx: -2, dy: 3, ears: 'up', look: [1, -1.5], eyes: 'open', brows: 'kind', mouth: 'smile' },
  sad: { r: 8, dx: 0, dy: 7, ears: 'droop', look: [0, 2], eyes: 'open', brows: 'sad', mouth: 'frown' },
  asleep: { r: 12, dx: 0, dy: 4, ears: 'down', look: [0, 0], eyes: 'closed', brows: 'kind' },
  confused: { r: -12, dx: 0, dy: 0, ears: 'down', look: [-1.2, -1], eyes: 'open', brows: 'raised' },
  shrug: { r: 8, dx: 0, dy: 3, ears: 'droop', look: [0, 0], eyes: 'open', brows: 'raised', mouth: 'frown' },
};

/** Sleeve from the shoulder through a bend to the paw. */
function Arm({ d, paw }: { d: string; paw: [number, number] }) {
  return (
    <g>
      <path d={d} stroke={C.coatDeep} strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d={d} stroke={C.coatShade} strokeWidth="7" fill="none" strokeLinecap="round" />
      <circle cx={paw[0]} cy={paw[1]} r="4.6" fill={C.fur} stroke={C.furDark} strokeWidth="1" />
    </g>
  );
}

function Magnifier({ x, y, rot = 0, r = 7 }: { x: number; y: number; rot?: number; r?: number }) {
  // (x, y) is the grip; the lens sits up the handle.
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={`M0 0 L0 ${-r - 6}`} stroke={C.brassDark} strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="0" cy={-r * 2 - 6} r={r} fill={C.glass} fillOpacity="0.55" stroke={C.brass} strokeWidth="3" />
      <path
        d={`M${-r * 0.45} ${-r * 2 - 8} q2 -3 5 -3`}
        stroke="#fff"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        opacity="0.9"
      />
    </g>
  );
}

function SniffHeadGroup({ h }: { h: Head }) {
  // Local head coordinates are the old 120×120 head (centre ≈ 60,58), scaled into the figure.
  const t = `translate(${60 + h.dx} ${36 + h.dy}) rotate(${h.r}) scale(0.66) translate(-60 -62)`;
  const [lx, ly] = h.look;
  const eyeRy = h.eyes === 'wide' ? 5.6 : 4.6;
  return (
    <g transform={t}>
      {/* ears (behind the head) */}
      <g fill={C.ear}>
        {h.ears === 'up' ? (
          <>
            <path d="M34 42c-12-10-18-30-8-35 7-3 16 12 19 28Z" />
            <path d="M86 42c12-10 18-30 8-35-7-3-16 12-19 28Z" />
          </>
        ) : (
          <>
            <path
              d="M33 34c-19 3-25 42-16 70 4 11 15 12 19 1l9-56Z"
              transform={h.ears === 'droop' ? 'rotate(12 33 34)' : undefined}
            />
            <path
              d="M87 34c19 3 25 42 16 70-4 11-15 12-19 1l-9-56Z"
              transform={h.ears === 'droop' ? 'rotate(-12 87 34)' : undefined}
            />
          </>
        )}
      </g>
      {/* head, cream blaze and muzzle */}
      <path d="M36 38c0-14 11-22 24-22s24 8 24 22v30c0 18-11 32-24 32S36 86 36 68Z" fill={C.fur} />
      <path d="M56 22h8l3 40H53Z" fill={C.cream} opacity="0.85" />
      <path d="M44 72c0-7 7-10 16-10s16 3 16 10v8c0 12-7 19-16 19s-16-7-16-19Z" fill={C.cream} />
      {/* jowls */}
      <path d="M44 80q-3 10 4 15M76 80q3 10-4 15" stroke={C.furDark} strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="60" cy="70" rx="8.5" ry="6" fill={C.ink} />
      <ellipse cx="57.5" cy="68" rx="2.4" ry="1.4" fill="#fff" opacity="0.5" />
      {h.mouth === 'smile' && (
        <path d="M51 82q9 9 18 0" stroke={C.ink} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      )}
      {h.mouth === 'frown' && (
        <path d="M52 87q8-6 16 0" stroke={C.ink} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      )}
      {h.mouth === 'o' && <ellipse cx="60" cy="85" rx="3.4" ry="4" fill={C.ink} />}
      {/* eyes: droopy, kind */}
      {h.eyes === 'closed' ? (
        <g stroke={C.ink} strokeWidth="2.6" fill="none" strokeLinecap="round">
          <path d="M45 52q5 4 10 0M65 52q5 4 10 0" />
        </g>
      ) : (
        <g>
          {/* red lower lids: basset droop */}
          <path d="M44 55q6 6 12 0M64 55q6 6 12 0" stroke="#b5654a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <ellipse cx={50 + lx} cy={52 + ly} rx="4.4" ry={eyeRy} fill={C.ink} />
          <ellipse cx={70 + lx} cy={52 + ly} rx="4.4" ry={eyeRy} fill={C.ink} />
          <circle cx={48.6 + lx} cy={50.2 + ly} r="1.3" fill="#fff" />
          <circle cx={68.6 + lx} cy={50.2 + ly} r="1.3" fill="#fff" />
          {h.eyes !== 'wide' && (
            // heavy upper lids
            <path d="M44.5 49.5q5.5-4 11 0v-3h-11ZM64.5 49.5q5.5-4 11 0v-3h-11Z" fill={C.fur} />
          )}
          <path
            d={
              h.brows === 'sad'
                ? 'M44 46l11-5M76 46l-11-5'
                : h.brows === 'raised'
                  ? 'M44 42q6-5 12 0M64 42q6-5 12 0'
                  : h.brows === 'focus'
                    ? 'M44 44l11 2M76 44l-11 2'
                    : 'M44 45q6-4 12 0M64 45q6-4 12 0'
            }
            stroke={C.ear}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      )}
      {/* detective hat in coat teal */}
      <path d="M31 37Q60 22 89 37L86 28Q60 8 34 28Z" fill={C.coat} />
      <path d="M40 27Q60 12 80 27L78 23Q60 9 42 23Z" fill={C.coatDeep} />
    </g>
  );
}

/** The trench coat body: flared coat, shoulders, collar, belt, buttons, feet. */
function Body({ lean = 0 }: { lean?: number }) {
  return (
    <g transform={lean ? `rotate(${lean} 60 110)` : undefined}>
      {/* feet peeking under the hem */}
      <ellipse cx="45" cy="109" rx="10" ry="5" fill={C.fur} stroke={C.furDark} strokeWidth="1" />
      <ellipse cx="75" cy="109" rx="10" ry="5" fill={C.fur} stroke={C.furDark} strokeWidth="1" />
      {/* coat */}
      <path d="M36 60Q60 52 84 60L99 104Q60 112 21 104Z" fill={C.coat} />
      <path d="M60 56Q74 56 84 60L99 104Q80 109 60 109Z" fill={C.coatShade} />
      {/* front opening and hem vent */}
      <path d="M60 70V108" stroke={C.coatDeep} strokeWidth="1.6" />
      {/* collar / lapels */}
      <path d="M44 57L60 76L52 56Z" fill={C.coatDeep} />
      <path d="M76 57L60 76L68 56Z" fill={C.coatDeep} />
      <path d="M52 56L60 70L68 56Z" fill={C.cream} />
      {/* belt with brass buckle */}
      <path d="M27 84Q60 90 93 84L94 90Q60 96 26 90Z" fill={C.coatDeep} />
      <rect x="55" y="85" width="10" height="8" rx="1.5" fill="none" stroke={C.brass} strokeWidth="2" />
      {/* buttons */}
      <circle cx="53" cy="79" r="1.8" fill={C.brass} />
      <circle cx="67" cy="79" r="1.8" fill={C.brass} />
      <circle cx="53" cy="99" r="1.8" fill={C.brass} />
      <circle cx="67" cy="99" r="1.8" fill={C.brass} />
    </g>
  );
}

function Pose({ pose }: { pose: Pose }) {
  const h = HEAD[pose];
  switch (pose) {
    case 'sniffing':
      return (
        <>
          <Body lean={8} />
          <Arm d="M38 64Q30 78 34 90" paw={[34, 91]} />
          <SniffHeadGroup h={h} />
          {/* magnifier held low over the trail */}
          <Arm d="M84 64Q96 78 98 94" paw={[98, 95]} />
          <Magnifier x={98} y={97} rot={140} r={6.5} />
          <g stroke="var(--fog-400, #7a86b8)" strokeWidth="2" fill="none" strokeLinecap="round">
            <path d="M96 118q4-3 8 0q4 3 8 0" />
            <path d="M8 116q4-3 8 0q4 3 8 0" opacity="0.6" />
          </g>
        </>
      );
    case 'thinking':
      return (
        <>
          <Body />
          <Arm d="M84 64Q92 80 88 92" paw={[88, 93]} />
          <SniffHeadGroup h={h} />
          {/* paw on chin */}
          <Arm d="M38 64Q30 80 46 72Q52 68 52 62" paw={[52, 61]} />
          <g fill="var(--ghost-300, #b8a9ff)">
            <circle cx="92" cy="24" r="2.4" />
            <circle cx="100" cy="15" r="3.4" />
            <circle cx="110" cy="6" r="4.4" />
          </g>
        </>
      );
    case 'alert':
      return (
        <>
          {/* flashlight beam */}
          <path d="M104 58L120 40V84Z" fill="var(--beam-400, #ffc857)" opacity="0.5" />
          <Body />
          <Arm d="M38 64Q30 78 34 90" paw={[34, 91]} />
          <SniffHeadGroup h={h} />
          <Arm d="M84 64Q94 68 98 60" paw={[98, 60]} />
          <g transform="rotate(-8 100 60)">
            <rect x="94" y="55" width="13" height="9" rx="2" fill={C.brass} stroke={C.brassDark} strokeWidth="1.2" />
            <rect x="105" y="53.5" width="3.4" height="12" rx="1" fill="#fff4cf" />
          </g>
        </>
      );
    case 'triumphant':
      return (
        <>
          <Body />
          {/* paw on hip */}
          <Arm d="M38 64Q24 76 34 84" paw={[36, 84]} />
          <SniffHeadGroup h={h} />
          {/* arm raised with the pulled-off coin mask */}
          <Arm d="M84 64Q96 52 98 34" paw={[98, 33]} />
          <g transform="translate(98 18) rotate(16)">
            <ellipse cx="0" cy="0" rx="15" ry="11" fill="#e8b84a" stroke={C.brassDark} strokeWidth="2" />
            <ellipse cx="0" cy="0" rx="10.5" ry="7" fill="none" stroke={C.brassDark} strokeWidth="1" opacity="0.6" />
            <ellipse cx="-5.5" cy="-1" rx="3.4" ry="2.3" fill={C.ink} />
            <ellipse cx="5.5" cy="-1" rx="3.4" ry="2.3" fill={C.ink} />
            <path d="M-15 0h-5M15 0h5" stroke={C.ink} strokeWidth="1.4" strokeLinecap="round" />
          </g>
          <g stroke="var(--beam-400, #ffc857)" strokeWidth="2" strokeLinecap="round">
            <path d="M80 10l-4-4M118 14l3-3M116 32l4 1" />
          </g>
        </>
      );
    case 'sad':
      return (
        <>
          <Body />
          <Arm d="M38 64Q34 80 38 94" paw={[38, 95]} />
          <SniffHeadGroup h={h} />
          <Arm d="M82 64Q88 80 84 94" paw={[84, 95]} />
          {/* magnifier dangling, pointing at the ground */}
          <Magnifier x={84} y={96} rot={180} r={5.5} />
        </>
      );
    case 'shrug':
      return (
        <>
          <Body />
          <Arm d="M38 64Q22 72 18 58" paw={[18, 56]} />
          <Arm d="M82 64Q98 72 102 58" paw={[102, 56]} />
          <SniffHeadGroup h={h} />
          <g stroke="var(--fog-400, #7a86b8)" strokeWidth="2" strokeLinecap="round">
            <path d="M10 46l-3-4M18 42v-5M26 46l3-4M94 46l-3-4M102 42v-5M110 46l3-4" />
          </g>
        </>
      );
    case 'asleep':
      return (
        <>
          <Body />
          <Arm d="M38 64Q30 82 46 88" paw={[48, 88]} />
          <Arm d="M82 64Q90 82 74 88" paw={[72, 88]} />
          <SniffHeadGroup h={h} />
          <g fill="var(--ghost-300, #b8a9ff)" fontFamily="var(--font-display)" fontSize="14">
            <text x="90" y="24">
              z
            </text>
            <text x="102" y="12" fontSize="10">
              z
            </text>
          </g>
        </>
      );
    case 'confused':
      return (
        <>
          <Body />
          <Arm d="M84 64Q92 80 88 92" paw={[88, 93]} />
          <SniffHeadGroup h={h} />
          {/* scratching the head */}
          <Arm d="M38 64Q22 50 32 32" paw={[33, 31]} />
          <text x="92" y="30" fontFamily="var(--font-display)" fontSize="24" fill="var(--beam-400, #ffc857)">
            ?
          </text>
        </>
      );
    default:
      return (
        <>
          <Body />
          <Arm d="M38 64Q30 78 34 90" paw={[34, 91]} />
          <SniffHeadGroup h={h} />
          <Arm d="M84 64Q92 78 90 90" paw={[90, 91]} />
          <Magnifier x={90} y={92} rot={28} r={6.5} />
        </>
      );
  }
}

export function SniffPose({
  pose = 'idle',
  size = 120,
  decorative = false,
}: {
  pose?: Pose;
  size?: number;
  decorative?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : LABEL[pose]}
      data-pose={pose}
    >
      <ellipse cx="60" cy="113" rx="38" ry="4.5" fill="#0b1026" opacity="0.22" />
      <Pose pose={pose} />
    </svg>
  );
}
