'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { canUse3D } from '@/lib/webgl';

const MaskPop3DScene = dynamic(() => import('./MaskPop3DScene'), { ssr: false });

const seenKey = (claimId: string) => `scoobydao:maskpop:${claimId}`;

/**
 * "Mask pops off" when a case resolves Pass (THEME.md §3.1, §5.5). Plays once per case per
 * session. 3D on capable devices; CSS pop otherwise; static mask with reduced motion.
 */
export function MaskPop({ claimId, className = '' }: { claimId: string; className?: string }) {
  const [mode, setMode] = useState<'3d' | 'css' | 'static' | null>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(seenKey(claimId)) === '1';
      sessionStorage.setItem(seenKey(claimId), '1');
    } catch {
      /* storage blocked: just play */
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- decided once from browser capabilities
    setMode(seen || reduce ? 'static' : canUse3D().ok ? '3d' : 'css');
  }, [claimId]);

  if (!mode) return <div className={className} aria-hidden />;
  return (
    <div className={className} aria-hidden>
      {mode === '3d' ? <MaskPop3DScene /> : <CoinMask animate={mode === 'css'} />}
    </div>
  );
}

function CoinMask({ animate }: { animate: boolean }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={`h-full w-full ${animate ? 'animate-[maskpop_1.6s_cubic-bezier(.2,.9,.3,1.2)_both]' : 'rotate-[-14deg]'}`}
    >
      <ellipse cx="60" cy="58" rx="46" ry="40" fill="#e8b84a" stroke="#8a5a00" strokeWidth="4" />
      <ellipse cx="44" cy="52" rx="9" ry="6" fill="#1b1410" />
      <ellipse cx="76" cy="52" rx="9" ry="6" fill="#1b1410" />
      <path
        d="M42 74q18 10 36 0"
        stroke="#1b1410"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
