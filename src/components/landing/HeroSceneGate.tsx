'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { afterFirstPaint, canUse3D } from '@/lib/webgl';
import { HeroParallaxFallback } from './HeroParallaxFallback';
import { StandingSniff } from './StandingSniff';

const HeroScene3D = dynamic(() => import('./HeroScene3D'), { ssr: false });

/**
 * The 2D night scene, parallax and CSS flashlight are always the background. Sniff stands
 * in the yard as a 2D figure from first paint. On capable devices (WebGL, ≥4 cores, a fine
 * pointer, no reduced motion) a transparent 3D Sniff loads on the first pointer move over
 * the hero and crossfades in over the 2D one, in the same spot. Nothing else changes.
 */
export function HeroSceneGate() {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<{ host: HTMLElement; hasModel: boolean } | null>(null);
  const [ready3D, setReady3D] = useState(false);

  useEffect(() => {
    const host = ref.current?.closest<HTMLElement>('.hero');
    if (!host || !canUse3D().ok) return;
    let cancelled = false;
    let stop = () => {};
    const load = async () => {
      // public/models/manifest.json lists which optional models exist (avoids a 404 probe).
      const hasModel = await fetch('/models/manifest.json')
        .then((r) => (r.ok ? r.json() : {}))
        .then((m: { sniff?: boolean }) => m.sniff === true)
        .catch(() => false);
      if (!cancelled) setMode({ host, hasModel });
    };
    // Load three.js on intent (first pointer move over the hero), never during first load.
    const onIntent = () => {
      host.removeEventListener('pointermove', onIntent);
      stop = afterFirstPaint(load);
    };
    host.addEventListener('pointermove', onIntent);
    return () => {
      cancelled = true;
      host.removeEventListener('pointermove', onIntent);
      stop();
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="absolute inset-0">
      <HeroParallaxFallback
        sniff={
          <>
            <div
              className={`absolute inset-0 transition-opacity duration-700 ${ready3D ? 'opacity-0' : 'opacity-100'}`}
            >
              <StandingSniff />
            </div>
            {mode && (
              <div
                className={`absolute inset-[-25%] transition-opacity duration-700 ${ready3D ? 'opacity-100' : 'opacity-0'}`}
              >
                <HeroScene3D
                  host={mode.host}
                  hasModel={mode.hasModel}
                  onReady={() => setReady3D(true)}
                />
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
