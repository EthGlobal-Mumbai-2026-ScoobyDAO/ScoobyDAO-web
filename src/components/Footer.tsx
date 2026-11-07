import { BUILT_WITH, REPOS } from '@/lib/site';
import { env } from '@/lib/env';
import { deployed, deployedArb, V2_INFO } from '@/protocol';
import Link from 'next/link';
import { SniffHead } from './icons';
import { TxLink } from './TxLink';
import { HonestyChips } from './ui/HonestyChips';
import { TechnicalDetails } from './ui/Disclosure';

const V1_SHOWN = [
  ['ReportRegistry', deployed.ReportRegistry, 11155111],
  ['VoteMarket', deployed.VoteMarket, 11155111],
  ['Settlement', deployed.Settlement, 11155111],
  ['DemoUSD (dUSD, test token)', deployed.DemoUSD, 11155111],
  ['CCIPStakeReceiver', deployed.CCIPStakeReceiver, 11155111],
  ['CCIPStakeSender (Arbitrum Sepolia)', deployedArb.CCIPStakeSender, 421614],
] as const;

const V2_SHOWN = [
  ['ReportRegistry', V2_INFO.sepolia.ReportRegistry, 11155111],
  ['RiskFiStakeVaultV2', V2_INFO.sepolia.RiskFiStakeVaultV2, 11155111],
  ['YieldCurveHookV2', V2_INFO.sepolia.YieldCurveHookV2, 11155111],
  ['CCIPStakeReceiverV2', V2_INFO.sepolia.CCIPStakeReceiverV2, 11155111],
  ['CCIPStakeSenderV2 (Arbitrum Sepolia)', V2_INFO.arbitrumSepolia.CCIPStakeSenderV2, 421614],
] as const;

const PRODUCT = [
  { href: '/cases', label: 'Case board' },
  { href: '/markets', label: 'Markets' },
  { href: '/reports', label: 'Reports' },
  { href: '/me', label: 'My positions' },
  { href: '/#how-it-works', label: 'How it works' },
];

export function Footer() {
  const isV2 = env.chainMode === 'live' && env.protocol === 'v2';
  const SHOWN: readonly (readonly [string, `0x${string}` | undefined, number])[] = isV2
    ? V2_SHOWN
    : V1_SHOWN;
  const any = SHOWN.some(([, a]) => !!a);
  return (
    <footer className="border-line mt-16 border-t">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-12 text-sm sm:px-6 md:grid-cols-[1.3fr_1fr_1fr_1.4fr]">
        <div>
          <p className="flex items-center gap-2">
            <SniffHead size={28} />
            <span className="font-display text-xl">ScoobyDAO</span>
          </p>
          <p className="text-muted mt-2 max-w-xs">Sniff out the rug before it pulls.</p>
          <p className="text-muted mt-4 max-w-xs">
            Built with{' '}
            {BUILT_WITH.map((b, i) => (
              <span key={b.name}>
                <span className="text-text">{b.name}</span>
                {i < BUILT_WITH.length - 2 ? ' · ' : i === BUILT_WITH.length - 2 ? ' · ' : ''}
              </span>
            ))}
            . Built at ETHGlobal Mumbai 2026. Not financial advice.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Product</h2>
          <ul className="mt-3 space-y-2">
            {PRODUCT.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-muted hover:text-text">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-semibold">For reviewers</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/admin" className="text-muted hover:text-text">
                Reviewer
              </Link>
            </li>
            {env.operatorView && (
              <li>
                <Link href="/operator" className="text-muted hover:text-text">
                  Operator
                </Link>
              </li>
            )}
          </ul>
          <h2 className="mt-6 font-semibold">Source</h2>
          <ul className="mt-3 space-y-2">
            {REPOS.map((r) => (
              <li key={r.name}>
                {r.url ? (
                  <a href={r.url} className="text-beam-ink underline-offset-4 hover:underline">
                    {r.name}
                  </a>
                ) : (
                  <span className="text-muted">{r.name}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <TechnicalDetails title={`Contracts (${isV2 ? 'V2' : 'V1'}, testnets)`}>
            {any ? (
              <dl className="space-y-1.5">
                {SHOWN.map(([k, a, chainId]) => (
                  <div key={k} className="flex flex-wrap justify-between gap-x-3">
                    <dt className="text-muted num text-xs">{k}</dt>
                    <dd>
                      {a ? (
                        <TxLink kind="address" value={a} chainId={chainId} />
                      ) : (
                        <span className="text-muted">Not deployed yet</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-muted">
                Not deployed yet. Addresses appear here after the contracts sync.
              </p>
            )}
          </TechnicalDetails>
          <HonestyChips className="mt-4" facts={['testIdentities']} />
        </div>
      </div>
    </footer>
  );
}
