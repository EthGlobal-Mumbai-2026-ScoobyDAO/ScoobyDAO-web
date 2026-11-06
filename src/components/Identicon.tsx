/** Deterministic 5×5 mirrored identicon from an address: the token's "mugshot" on the board. */
export function Identicon({ address, size = 48 }: { address: string; size?: number }) {
  const hex = address.toLowerCase().replace(/^0x/, '').padEnd(40, '0');
  const hue = parseInt(hex.slice(0, 4), 16) % 360;
  const fg = `hsl(${hue} 55% 42%)`;
  const bg = `hsl(${(hue + 40) % 360} 35% 88%)`;
  const cells: [number, number][] = [];
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 3; x++) {
      if (parseInt(hex[y * 3 + x + 4], 16) % 2 === 0) {
        cells.push([x, y]);
        if (x < 2) cells.push([4 - x, y]);
      }
    }
  return (
    <svg width={size} height={size} viewBox="-1 -1 7 7" aria-hidden className="shrink-0 rounded-sm">
      <rect x="-1" y="-1" width="7" height="7" fill={bg} />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={fg} />
      ))}
    </svg>
  );
}
