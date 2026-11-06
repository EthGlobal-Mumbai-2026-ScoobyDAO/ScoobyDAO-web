// Five layered placeholders (sky → moon → mansion → fog → trees) until real art exists (THEME.md §2.5, §7.5).
// Each layer shifts by its depth × the pointer offset (--px/--py, set by the hero). Original artwork.

const layer = (depth: number) => ({
  transform: `translate3d(calc(var(--px, 0) * ${depth}px), calc(var(--py, 0) * ${depth * 0.5}px), 0)`,
});

/** Sniff stands in the yard between the fog and the foreground trees; `sniff` fills that slot. */
export function HeroParallaxFallback({ sniff }: { sniff?: React.ReactNode }) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* 1 sky */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, #070b1d 0%, #0b1026 45%, #1a2150 100%)' }}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          {Array.from({ length: 70 }, (_, i) => {
            const x = (i * 37.7) % 100;
            const y = (i * 19.3) % 55;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={i % 9 === 0 ? 0.18 : 0.09}
                fill="#e8ecff"
                opacity={0.3 + ((i * 7) % 5) / 10}
              />
            );
          })}
        </svg>
      </div>
      {/* 2 moon */}
      <div className="absolute top-[9%] right-[14%] h-28 w-28 sm:h-40 sm:w-40" style={layer(6)}>
        <div
          className="h-full w-full rounded-full"
          style={{
            background: 'radial-gradient(circle at 38% 36%, #fffbe8, #f1e6c2 55%, #d8c99b)',
            boxShadow: '0 0 80px 20px rgb(255 240 200 / 0.12)',
          }}
        />
      </div>
      {/* 3 mansion on the hill */}
      <svg
        className="absolute bottom-0 left-0 h-[78%] w-full"
        viewBox="0 0 1600 700"
        preserveAspectRatio="xMidYMax slice"
        style={layer(14)}
      >
        <path
          d="M0 520 C300 460 520 430 760 440 C1000 450 1280 480 1600 520 V700 H0Z"
          fill="#10163a"
        />
        <g fill="#0a0e26">
          <rect x="980" y="250" width="300" height="210" />
          <polygon points="960,255 1130,150 1300,255" />
          <rect x="1040" y="160" width="40" height="70" />
          <rect x="1180" y="110" width="70" height="170" />
          <polygon points="1170,115 1215,55 1260,115" />
          <rect x="900" y="330" width="100" height="130" />
          <polygon points="890,335 950,285 1010,335" />
        </g>
        <rect x="1200" y="160" width="22" height="30" fill="#ffc857" opacity="0.9" />
        <rect
          x="1200"
          y="160"
          width="22"
          height="30"
          fill="#ffc857"
          opacity="0.35"
          filter="blur(6px)"
        />
        <g fill="#141b42">
          <rect x="1020" y="300" width="20" height="28" />
          <rect x="1090" y="300" width="20" height="28" />
          <rect x="1160" y="360" width="20" height="28" />
        </g>
      </svg>
      {/* 4 fog */}
      <div className="absolute inset-x-[-10%] bottom-[12%] h-[38%]" style={layer(22)}>
        <div
          className="h-full w-full"
          style={{
            background:
              'radial-gradient(60% 50% at 30% 70%, rgb(122 134 184 / 0.28), transparent 70%), radial-gradient(50% 40% at 75% 60%, rgb(184 169 255 / 0.16), transparent 70%)',
            filter: 'blur(8px)',
          }}
        />
      </div>
      {/* Sniff (2D figure, or 3D once loaded) */}
      {sniff && (
        <div
          className="absolute bottom-[13%] left-[60%] hidden aspect-[3/4] w-[clamp(150px,15vw,250px)] sm:block lg:left-[63%]"
          style={layer(26)}
        >
          <div className="absolute inset-x-[8%] bottom-[-3%] h-[10%] rounded-[50%] bg-black/55 blur-md" />
          {sniff}
        </div>
      )}
      {/* 5 foreground trees */}
      <svg
        className="absolute bottom-0 left-0 h-[46%] w-full"
        viewBox="0 0 1600 400"
        preserveAspectRatio="xMidYMax slice"
        style={layer(34)}
      >
        <g fill="#05081a" stroke="#05081a" strokeLinecap="round">
          <path d="M0 400V300C80 290 160 330 260 320S420 280 520 310 700 360 820 350 1100 300 1260 320 1480 340 1600 330V400Z" />
          <path
            d="M120 330V120M120 180L60 110M120 220L190 140M120 150L90 80M190 140L230 120"
            strokeWidth="14"
            fill="none"
          />
          <path
            d="M1460 330V90M1460 160L1400 80M1460 210L1540 130M1400 80L1370 60M1540 130L1580 120"
            strokeWidth="16"
            fill="none"
          />
        </g>
      </svg>
    </div>
  );
}
