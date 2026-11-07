'use client';

import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';

// Positions keep clear of the left-aligned headline and of Sniff; only the first shows on small screens.
const CLUES: { text: string; x: string; y: string; mobile?: boolean }[] = [
  { text: 'unknown: LP lock status', x: '64%', y: '15%', mobile: true },
  { text: 'counterevidence: 2 claims', x: '89%', y: '46%' },
  { text: 'evidence sha256: a14c…87f4', x: '61%', y: '79%' },
  { text: 'pillar: technical health · partial', x: '88%', y: '30%' },
];

/**
 * Landing hero: night scene + flashlight. The pointer drives CSS variables directly
 * (no React re-render per move). Reduced motion: beam stays put, no parallax.
 */
export function Hero({ scene }: { scene: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    let target = { x: 0.7, y: 0.42 };
    const apply = () => {
      frame = 0;
      el.style.setProperty('--fx', `${target.x * 100}%`);
      el.style.setProperty('--fy', `${target.y * 100}%`);
      el.style.setProperty('--px', String((target.x - 0.5) * -2));
      el.style.setProperty('--py', String((target.y - 0.5) * -2));
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      if (!frame) frame = requestAnimationFrame(apply);
    };
    el.addEventListener('pointermove', onMove);
    return () => {
      el.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section
      ref={ref}
      aria-labelledby="hero-h"
      className="hero relative isolate flex min-h-[min(calc(100svh-4rem),760px)] items-end overflow-hidden text-[#e8ecff] sm:items-center"
      style={{
        ['--fx' as string]: '70%',
        ['--fy' as string]: '42%',
        ['--r' as string]: 'clamp(140px, 22vw, 300px)',
      }}
    >
      {scene}
      {/* Hidden clues: only legible inside the beam */}
      <div aria-hidden className="hero-clues pointer-events-none absolute inset-0">
        {CLUES.map((c) => (
          <span
            key={c.text}
            className={`num absolute -translate-x-1/2 rotate-[-3deg] rounded-sm whitespace-nowrap ${c.mobile ? '' : 'hidden sm:block'} bg-[#f6f1e3] px-2 py-1 text-xs text-[#2a2418] shadow-lg sm:text-sm`}
            style={{ left: c.x, top: c.y }}
          >
            {c.text}
          </span>
        ))}
      </div>
      {/* Darkness with a beam-shaped hole, plus a warm tint where the beam lands */}
      <div aria-hidden className="hero-dark pointer-events-none absolute inset-0" />
      <div aria-hidden className="hero-beam pointer-events-none absolute inset-0" />

      <div className="relative mx-auto w-full max-w-6xl px-4 pt-24 pb-16 sm:py-24">
        <h1
          id="hero-h"
          className="font-display max-w-[14ch] text-[clamp(2.6rem,7vw,5.6rem)] leading-[0.95] drop-shadow-[0_4px_24px_rgb(0_0_0/0.6)]"
        >
          Every rug has a villain behind the mask.
        </h1>
        <p className="mt-5 max-w-[34rem] text-lg text-[#c9d0f0] drop-shadow-[0_2px_10px_rgb(0_0_0/0.8)] sm:text-xl">
          AI agents investigate suspicious tokens. A <span className="whitespace-nowrap">World ID–verified</span> human signs off. The market
          decides.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/cases"
            className="bg-beam text-on-beam rounded-xl px-6 py-3.5 text-lg font-semibold shadow-[0_0_40px_-6px_rgb(255_200_87/0.6)] hover:brightness-105"
          >
            Browse cases
          </Link>
          <Link
            href="/markets"
            className="rounded-xl border border-[#7a86b8] bg-[#0b1026]/60 px-6 py-3.5 text-lg font-semibold backdrop-blur hover:border-[#e8ecff]"
          >
            See live markets
          </Link>
        </div>
      </div>
    </section>
  );
}
