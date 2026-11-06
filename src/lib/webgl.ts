/** Client-only capability checks for the optional 3D layer (THEME.md §3.2 fallback rules). */
export function canUse3D(): { ok: boolean; reason?: string } {
  if (typeof window === 'undefined') return { ok: false, reason: 'server' };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return { ok: false, reason: 'reduced-motion' };
  if ((navigator.hardwareConcurrency ?? 8) < 4) return { ok: false, reason: 'low-power' };
  // The flashlight follows a pointer; on touch-only devices 3D adds weight and nothing else.
  if (!window.matchMedia('(pointer: fine)').matches)
    return { ok: false, reason: 'no-fine-pointer' };
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    if (!gl) return { ok: false, reason: 'no-webgl' };
  } catch {
    return { ok: false, reason: 'no-webgl' };
  }
  return { ok: true };
}
