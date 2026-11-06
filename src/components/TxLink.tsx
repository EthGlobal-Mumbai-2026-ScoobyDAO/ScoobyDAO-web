import { ExternalLink } from 'lucide-react';
import { explorer, explorerName } from '@/lib/explorer';
import { shortHex } from '@/lib/format';

type Kind = 'tx' | 'address' | 'token' | 'block';

export function TxLink({
  value,
  kind = 'tx',
  label,
  full = false,
  chainId,
  href,
  simulated,
}: {
  value: string;
  kind?: Kind;
  label?: string;
  full?: boolean;
  chainId?: number;
  /** Override (e.g. a mainnet token explorer for the reported token). */
  href?: string;
  /** Fixture-mode value: not a real transaction, so no explorer link. */
  simulated?: boolean;
}) {
  if (simulated)
    return (
      <span className="num text-muted" title="Fixture mode: not a real transaction">
        fixture tx {shortHex(value, 8, 6)}
      </span>
    );
  return (
    <a
      href={href ?? explorer[kind](value, chainId)}
      target="_blank"
      rel="noreferrer"
      className="num text-beam-ink inline-flex items-center gap-1 break-all underline decoration-[color-mix(in_srgb,currentColor_40%,transparent)] underline-offset-4 hover:decoration-current"
    >
      {label ?? (full ? value : shortHex(value, 8, 6))}
      <ExternalLink size={13} className="shrink-0" aria-hidden />
      <span className="sr-only">(opens {href ? 'explorer' : explorerName(chainId)})</span>
    </a>
  );
}
