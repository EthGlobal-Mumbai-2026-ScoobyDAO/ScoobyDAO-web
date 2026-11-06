import { Banner } from './Banner';
import { TxLink } from './TxLink';

/** THEME.md §5.6 headline + CLAUDE.md §3.4 detail line (see NOTES.md). */
export function FrozenBanner({
  block,
  what = 'staking and trading',
}: {
  block?: bigint;
  what?: string;
}) {
  const n = block !== undefined ? block.toLocaleString('en-US') : 'N';
  return (
    <Banner
      tone="frozen"
      size="xl"
      icon={null}
      title={
        <>
          <span aria-hidden>🪤 </span>Trap sprung — trading halted at block{' '}
          {block !== undefined ? <TxLink kind="block" value={block.toString()} label={n} /> : 'N'}
        </>
      }
    >
      <p>
        Claim triggered — {what} halted at block {n}.
      </p>
      <p className="text-muted mt-1 text-base">
        The resolver posted the evidence onchain. New stakes and swaps now revert. Reveal your stake
        so you can redeem when the case resolves.
      </p>
    </Banner>
  );
}
