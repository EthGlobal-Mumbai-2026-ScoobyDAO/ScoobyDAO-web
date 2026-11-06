'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { afterFirstPaint, canUse3D } from '@/lib/webgl';
import { HeroParallaxFallback } from './HeroParallaxFallback';

const HeroScene3D = dynamic(() => import('./HeroScene3D'), { ssr: false });

/**
 * Always paints the 2D parallax scene first. On capable devices (WebGL, ≥4 cores,
 * no reduced motion) it then loads the 3D scene and fades it in over the fallback.
 */
export function HeroSceneGate() {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<{ host: HTMLElement; hasModel: boolean } | null>(null);

  useEffect(() => {
    const host = ref.current?.closest<HTMLElement>('.hero');
    if (!host || !canUse3D().ok) return;
    let cancelled = false;
    const stop = afterFirstPaint(async () => {
      // public/models/manifest.json lists which optional models exist (avoids a 404 probe).
      const hasModel = await fetch('/models/manifest.json')
        .then((r) => (r.ok ? r.json() : {}))
        .then((m: { sniff?: boolean }) => m.sniff === true)
        .catch(() => false);
      if (cancelled) return;
      host.dataset.scene = '3d';
      setMode({ host, hasModel });
    });
    return () => {
      cancelled = true;
      stop();
      delete host.dataset.scene;
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="absolute inset-0">
      <HeroParallaxFallback />
      {mode && (
        <div className="absolute inset-0 animate-[fadein_1.2s_ease-out_both]">
          <HeroScene3D host={mode.host} hasModel={mode.hasModel} />
        </div>
      )}
    </div>
  );
}
