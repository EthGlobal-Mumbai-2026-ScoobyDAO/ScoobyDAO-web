import { describe, expect, it } from 'vitest';
import { parseReconstructions } from './reconstructions';
const header = [
  'datetime',
  ...Array.from({ length: 50 }, (_, i) => `TOKEN_recreation_${i + 1}`),
].join(',');
const row = (day: string, n = '0.01') => [day, ...Array(50).fill(n)].join(',');
describe('reconstruction evidence', () => {
  it('reads 50 dated simple-return series', () => {
    const a = parseReconstructions(
      [header, row('2026-05-11'), row('2026-05-12', '-0.05')].join('\n'),
    );
    expect(a[1].values).toHaveLength(50);
    expect(a[1].values[0]).toBe(-0.05);
  });
  it('rejects impossible values, missing columns and unsorted days', () => {
    expect(() =>
      parseReconstructions([header, row('2026-05-11', '-1.1'), row('2026-05-12')].join('\n')),
    ).toThrow();
    expect(() =>
      parseReconstructions([header, '2026-05-11,0.1', row('2026-05-12')].join('\n')),
    ).toThrow();
    expect(() =>
      parseReconstructions([header, row('2026-05-12'), row('2026-05-11')].join('\n')),
    ).toThrow();
  });
});
