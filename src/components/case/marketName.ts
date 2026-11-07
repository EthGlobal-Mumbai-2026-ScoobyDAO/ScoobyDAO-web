import type { WebReport } from '@/lib/types';

/** A claim shortened for one line ("SHIB — drops 80% within…"). */
export function shortClaim(text: string, max = 56): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Plain market name. A verified backend report gives "SHIB — {short claim}"; otherwise "Demo market #3".
 * The pre-catalog report on the original deployment is "Original demo #1" so the two #1s stay distinct.
 */
export function marketName({ id, deployment, linked }: { id: bigint | string; deployment?: 'original' | 'flexible'; linked?: Pick<WebReport, 'claimManifest'> }): string {
  const symbol = linked?.claimManifest.symbol;
  if (linked && symbol) return `${symbol} — ${shortClaim(linked.claimManifest.claimText)}`;
  if (linked) return shortClaim(linked.claimManifest.claimText);
  return deployment === 'original' ? `Original demo #${id}` : `Demo market #${id}`;
}

/** Big page title: the token symbol when linked, else the demo name. */
export function marketTitle(args: Parameters<typeof marketName>[0]): string {
  const symbol = args.linked?.claimManifest.symbol;
  return symbol ?? marketName({ ...args, linked: undefined });
}
