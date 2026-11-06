'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { canUse3D } from '@/lib/webgl';
import { HeroParallaxFallback } from './HeroParallaxFallback';
import type { HeroScene3DProps } from './HeroScene3D';
import { StandingSniff } from './StandingSniff';

type Scene = ComponentType<HeroScene3DProps>;

/**
 * The 2D night scene, parallax and CSS flashlight are always the background. Sniff has one
 * slot in the yard:
 * - Devices that will get 3D (fine pointer, no reduced motion, WebGL, ≥4 cores) never see the
 *   2D figure: CSS hides it from first paint, the 3D chunk starts loading right after
 *   hydration, and Sniff fades in once, in 3D.
 * - Everyone else sees the 2D figure immediately (CSS shows it for coarse pointers and reduced
 *   motion before JS runs; JS reveals it if WebGL/cores rule 3D out).
 */
export function HeroSceneGate() {
  const ref = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<{ Scene: Scene; host: HTMLElement; hasModel: boolean } | null>(
    null,
  );
  const [no3D, setNo3D] = useState(false);
  const [ready3D, setReady3D] = useState(false);

  useEffect(() => {
    const host = ref.current?.closest<HTMLElement>('.hero');
    if (!host) return;
    if (!canUse3D().ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- capability is only knowable in the browser
      setNo3D(true);
      return;
    }
    let cancelled = false;
    // Code and model manifest load in parallel, straight after hydration.
    Promise.all([
      import('./HeroScene3D'),
      fetch('/models/manifest.json')
        .then((r) => (r.ok ? r.json() : {}))
        .then((m: { sniff?: boolean }) => m.sniff === true)
        .catch(() => false),
    ])
      .then(([mod, hasModel]) => !cancelled && setScene({ Scene: mod.default, host, hasModel }))
      .catch(() => !cancelled && setNo3D(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const Scene = scene?.Scene;
  return (
    <div ref={ref} aria-hidden className="absolute inset-0">
      <HeroParallaxFallback
        sniff={
          <>
            <div
              className={`hero-sniff-2d absolute inset-0 transition-opacity duration-300 ${no3D ? 'is-on' : ''}`}
            >
              <StandingSniff />
            </div>
            {Scene && scene && (
              <div
                className={`absolute inset-[-25%] transition-opacity duration-300 ${ready3D ? 'opacity-100' : 'opacity-0'}`}
              >
                <Scene
                  host={scene.host}
                  hasModel={scene.hasModel}
                  onReady={() => setReady3D(true)}
                  onFail={() => setNo3D(true)}
                />
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
