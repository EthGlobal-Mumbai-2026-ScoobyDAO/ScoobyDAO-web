import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  };
}

/** Coin-shaped villain mask, lifted off. Used for Final · Yes ("Unmasked"). */
export function MaskOffIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 10c0-3 3.5-5 8-5s8 2 8 5-3 6-8 6-8-3-8-6Z" transform="rotate(-14 12 10)" />
      <path d="M8.2 9.6l2 .6M13.8 8.4l2-.4" transform="rotate(-14 12 10)" />
      <path d="M7 20h10" />
      <path d="M12 16.5V20" />
    </svg>
  );
}

/** Sniff's head: droopy basset ears, nose. Logo placeholder until art exists. */
export function SniffHead({ size = 28, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden {...rest}>
      <path d="M7 9c-4 1-5 8-3 13 1 2 3 2 4 0l2-9Z" fill="#8a5a2b" />
      <path d="M25 9c4 1 5 8 3 13-1 2-3 2-4 0l-2-9Z" fill="#8a5a2b" />
      <path d="M9 10c0-4 3-6 7-6s7 2 7 6v8c0 5-3 9-7 9s-7-4-7-9Z" fill="#d9a066" />
      <path d="M12 19c0-1.5 1.8-2 4-2s4 .5 4 2v2c0 3-1.8 5-4 5s-4-2-4-5Z" fill="#f3e2c4" />
      <ellipse cx="16" cy="19" rx="2.2" ry="1.5" fill="#1b1410" />
      <path
        d="M12 13.5q1.2-1 2.4 0M17.6 13.5q1.2-1 2.4 0"
        stroke="#1b1410"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M8.5 9.5Q16 5 23.5 9.5L23 7Q16 2 9 7Z" fill="#2ec4b6" />
    </svg>
  );
}
