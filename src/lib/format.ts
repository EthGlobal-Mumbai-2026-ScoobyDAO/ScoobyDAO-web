import { formatUnits, parseUnits } from 'viem';

/** dUSD, YT and Yes/No positions all use 6 decimals. */
export const DUSD_DECIMALS = 6;

export function toUnits(value: bigint | string): bigint {
  return typeof value === 'bigint' ? value : BigInt(value || '0');
}

/** 1250000000n → "1,250.00". `exact` shows all 6 decimals (for payouts). */
export function formatUsdc(value: bigint | string, opts: { exact?: boolean } = {}): string {
  const raw = formatUnits(toUnits(value), DUSD_DECIMALS);
  const [int, frac = ''] = raw.split('.');
  const intFmt = BigInt(int.replace('-', '')).toLocaleString('en-US');
  const sign = int.startsWith('-') ? '-' : '';
  const decimals = opts.exact ? frac.padEnd(DUSD_DECIMALS, '0') : frac.padEnd(2, '0').slice(0, 2);
  return `${sign}${intFmt}.${decimals}`;
}

/** User input → base units. Returns null for empty/invalid/too-precise input. */
export function parseUsdc(input: string): bigint | null {
  const s = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{0,6})?$/.test(s)) return null;
  try {
    return parseUnits(s, DUSD_DECIMALS);
  } catch {
    return null;
  }
}

export function shortHex(hex: string | undefined, head = 6, tail = 4): string {
  if (!hex) return '—';
  if (hex.length <= head + tail + 2) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

export function formatPercent(p: number | undefined): string {
  if (p === undefined || Number.isNaN(p)) return '—';
  return `${Math.round(p * 100)}%`;
}

/** Seconds → "2d 4h", "3h 12m", "4m 05s". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** dUSD per YT from a 1e18-scaled price, e.g. "0.0600". */
export function formatWad(wad: bigint | undefined, dp = 4): string {
  if (wad === undefined) return '—';
  const s = formatUnits(wad, 18);
  const [i, f = ''] = s.split('.');
  return `${i}.${f.padEnd(dp, '0').slice(0, dp)}`;
}

/** 18-decimal ETH for fees, e.g. "0.0020". */
export const formatEth = (wei: bigint, dp = 4) => formatWad(wei, dp);
