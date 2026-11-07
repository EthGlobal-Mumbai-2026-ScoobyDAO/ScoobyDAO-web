import { ImageResponse } from 'next/og';
import { SniffHead } from '@/components/icons';

export const alt = 'ScoobyDAO: Sniff out the rug before it pulls.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Brand fonts from Google Fonts when reachable at build time; the default sans otherwise.
async function googleFont(family: string, text?: string): Promise<ArrayBuffer | null> {
  try {
    const q = `family=${family}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?${q}`, { signal: AbortSignal.timeout(4000) })
    ).text();
    const url = css.match(/src: url\((.+?)\) format/)?.[1];
    return url ? await (await fetch(url, { signal: AbortSignal.timeout(4000) })).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image() {
  const [inter, interBold, bungee] = await Promise.all([
    googleFont('Inter:wght@400'),
    googleFont('Inter:wght@700'),
    googleFont('Bungee', 'ScoobyDAO'),
  ]);
  const fonts = [
    ...(inter ? [{ name: 'Inter', data: inter, weight: 400 as const, style: 'normal' as const }] : []),
    ...(interBold ? [{ name: 'Inter', data: interBold, weight: 700 as const, style: 'normal' as const }] : []),
    ...(bungee ? [{ name: 'Bungee', data: bungee, weight: 400 as const, style: 'normal' as const }] : []),
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '72px 88px',
          background: '#0B1026',
          color: '#E8ECFF',
          fontFamily: 'Inter',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 700 }}>
          <div
            style={{
              fontSize: 112,
              lineHeight: 1,
              fontFamily: bungee ? 'Bungee' : undefined,
              fontWeight: 800,
            }}
          >
            ScoobyDAO
          </div>
          <div style={{ marginTop: 32, fontSize: 44, fontWeight: 700, color: '#FFC857' }}>
            Sniff out the rug before it pulls.
          </div>
          <div style={{ marginTop: 24, fontSize: 28, lineHeight: 1.35, color: '#B7C0E8' }}>
            AI agents investigate suspicious tokens. A World ID–verified human signs off. The market
            decides.
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            width: 320,
            height: 320,
            borderRadius: 160,
            alignItems: 'center',
            justifyContent: 'center',
            background: '#151B3D',
            border: '4px solid #FFC857',
          }}
        >
          <SniffHead size={250} />
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
