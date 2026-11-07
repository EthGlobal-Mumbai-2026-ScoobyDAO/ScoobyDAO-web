'use client';

import { useEffect } from 'react';

/** How long to keep the target aligned while content above it (hero scene, Live now cards) settles. */
export const HASH_SETTLE_MS = 3000;

/** The element id named by a location hash, or null. */
export function hashTarget(hash: string): string | null {
  if (!hash || hash === '#') return null;
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
}

/**
 * Arriving at `/#how-it-works` from another page: Next's own hash scroll runs while the route is still loading, and
 * the cards above the section then grow, so the section ends up off screen. This scrolls to the hash after mount
 * and keeps it aligned while the layout settles, stopping at the first sign the user is scrolling themselves.
 */
export function HashScroll() {
  useEffect(() => {
    let stop = () => {};
    const follow = () => {
      stop();
      const id = hashTarget(window.location.hash);
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      const align = () => el.scrollIntoView({ block: 'start' });
      align();
      const ro = new ResizeObserver(align);
      ro.observe(document.body);
      const timer = window.setTimeout(() => stop(), HASH_SETTLE_MS);
      const userScroll = () => stop();
      const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
      events.forEach((e) => window.addEventListener(e, userScroll, { passive: true }));
      stop = () => {
        ro.disconnect();
        window.clearTimeout(timer);
        events.forEach((e) => window.removeEventListener(e, userScroll));
        stop = () => {};
      };
    };
    const raf = requestAnimationFrame(follow);
    window.addEventListener('hashchange', follow);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('hashchange', follow);
      stop();
    };
  }, []);
  return null;
}
