/** Client-only capability checks for the optional 3D layer (THEME.md §3.2 fallback rules). */
export function canUse3D(): { ok: boolean; reason?: string } {
  if (typeof window === 'undefined') return { ok: false, reason: 'server' };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return { ok: false, reason: 'reduced-motion' };
  if ((navigator.hardwareConcurrency ?? 8) < 4) return { ok: false, reason: 'low-power' };
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    if (!gl) return { ok: false, reason: 'no-webgl' };
  } catch {
    return { ok: false, reason: 'no-webgl' };
  }
  return { ok: true };
}

/** Resolves after first paint and an idle slot, so 3D never competes with LCP. */
export function afterFirstPaint(cb: () => void): () => void {
  let idle: number | undefined;
  const raf = requestAnimationFrame(() => {
    const ric = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 200));
    idle = ric(cb, { timeout: 2000 } as IdleRequestOptions) as unknown as number;
  });
  return () => {
    cancelAnimationFrame(raf);
    if (idle !== undefined) (window.cancelIdleCallback ?? clearTimeout)(idle);
  };
}
