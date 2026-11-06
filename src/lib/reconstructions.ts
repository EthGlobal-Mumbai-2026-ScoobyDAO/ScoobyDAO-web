export type ReconstructionRow = { day: string; values: number[] };
/** Strictly parse the 50-column, unquoted reconstruction CSV. Values are simple-return fractions. */
export function parseReconstructions(csv: string): ReconstructionRow[] {
  if (csv.length > 5_000_000 || csv.includes('"'))
    throw new Error('Unsupported reconstruction data');
  const lines = csv
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/);
  const header = lines.shift()?.split(',');
  if (
    !header ||
    header.length !== 51 ||
    header[0] !== 'datetime' ||
    header.slice(1).some((name, i) => name !== `TOKEN_recreation_${i + 1}`) ||
    lines.length < 2 ||
    lines.length > 4000
  )
    throw new Error('Invalid reconstruction data');
  let previous = -Infinity;
  return lines.map((line) => {
    const cols = line.split(',');
    const day = cols[0];
    const date = Date.parse(day + 'T00:00:00Z');
    if (
      cols.length !== 51 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(date) ||
      date <= previous ||
      new Date(date).toISOString().slice(0, 10) !== day
    )
      throw new Error('Invalid reconstruction date');
    previous = date;
    const values = cols.slice(1).map((v) => {
      if (!v.trim()) throw new Error('Missing reconstruction');
      const n = Number(v);
      if (!Number.isFinite(n) || n < -1) throw new Error('Invalid reconstruction');
      return n;
    });
    return { day, values };
  });
}
