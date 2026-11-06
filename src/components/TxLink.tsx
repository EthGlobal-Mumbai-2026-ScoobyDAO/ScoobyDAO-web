import { ExternalLink } from 'lucide-react';
import { explorer } from '@/lib/explorer';
import { shortHex } from '@/lib/format';

type Kind = 'tx' | 'address' | 'token' | 'block';

export function TxLink({
  value,
  kind = 'tx',
  label,
  full = false,
}: {
  value: string;
  kind?: Kind;
  label?: string;
  full?: boolean;
}) {
  const href = explorer[kind](value);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="num text-beam-ink inline-flex items-center gap-1 break-all underline decoration-[color-mix(in_srgb,currentColor_40%,transparent)] underline-offset-4 hover:decoration-current"
    >
      {label ?? (full ? value : shortHex(value, 8, 6))}
      <ExternalLink size={13} className="shrink-0" aria-hidden />
      <span className="sr-only">(opens Etherscan)</span>
    </a>
  );
}
