import Link from 'next/link';
import { SniffHead } from './icons';

export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2" aria-label="Unmasked home">
      <SniffHead size={30} className="transition-transform group-hover:-rotate-6" />
      <span className="font-display text-lg text-text">Unmasked</span>
    </Link>
  );
}
