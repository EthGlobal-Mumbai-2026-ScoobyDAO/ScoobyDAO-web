import { BUILT_WITH, REPOS } from '@/lib/site';
import { deployed, deployedArb } from '@/protocol';
import { TxLink } from './TxLink';

const SHOWN = [
  ['ReportRegistry', deployed.ReportRegistry, 11155111],
  ['VoteMarket', deployed.VoteMarket, 11155111],
  ['Settlement', deployed.Settlement, 11155111],
  ['DemoUSD (dUSD, test token)', deployed.DemoUSD, 11155111],
  ['CCIPStakeReceiver', deployed.CCIPStakeReceiver, 11155111],
  ['CCIPStakeSender (Arbitrum Sepolia)', deployedArb.CCIPStakeSender, 421614],
] as const;

export function Footer() {
  const any = SHOWN.some(([, a]) => !!a);
  return (
    <footer className="border-line border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 text-sm sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1.4fr]">
        <div>
          <p className="font-display text-xl">Unmasked</p>
          <p className="text-muted mt-2 max-w-xs">
            Built at ETHGlobal Mumbai 2026. Testnet demo on Ethereum Sepolia and Arbitrum Sepolia with
            dUSD, a test token (not USDC). Not available where prohibited.
            Nothing here is financial advice.
          </p>
          <p className="text-muted mt-4">
            Built with{' '}
            {BUILT_WITH.map((b, i) => (
              <span key={b.name}>
                <span className="text-text">{b.name}</span> ({b.role})
                {i < BUILT_WITH.length - 2 ? ', ' : i === BUILT_WITH.length - 2 ? ' and ' : '.'}
              </span>
            ))}
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Source</h2>
          <ul className="mt-3 space-y-2">
            {REPOS.map((r) => (
              <li key={r.name}>
                {r.url ? (
                  <a href={r.url} className="text-beam-ink underline-offset-4 hover:underline">
                    {r.name}
                  </a>
                ) : (
                  <span>{r.name}</span>
                )}
                <span className="text-muted"> · {r.what}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-semibold">Contracts (V1, testnets)</h2>
          {any ? (
            <dl className="mt-3 space-y-1.5">
              {SHOWN.map(([k, a, chainId]) => (
                <div key={k} className="flex flex-wrap justify-between gap-x-3">
                  <dt className="text-muted">{k}</dt>
                  <dd>{a ? <TxLink kind="address" value={a} chainId={chainId} /> : <span className="text-muted">Not deployed yet</span>}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-muted mt-3">
              Not deployed yet. Addresses appear here after the contracts sync.
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
