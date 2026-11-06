import type { Metadata } from 'next';
import { AcceleratedMarket } from '@/components/market/AcceleratedMarket';
import { MarketScreen } from '@/components/market/MarketScreen';
import { marketCatalog } from '@/protocol/marketCatalog';

export const metadata: Metadata = { title: 'Live markets' };

const utc = (timestamp: number) => new Date(timestamp * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');

export default async function Page({ searchParams }: { searchParams: Promise<{ report?: string }> }) {
  const { report } = await searchParams;
  const selected = report === 'original' ? 'original' : 'accelerated';
  return <>
    <section className="mx-auto max-w-6xl space-y-5 px-4 pt-10">
      <div><p className="text-beam-ink text-sm font-semibold uppercase">Ethereum Sepolia · V2</p><h1 className="font-display text-4xl">Live markets</h1><p className="text-muted mt-2">Choose a report to view its market and trade YT. Each report has its own vault, token and pool.</p></div>
      <nav aria-label="Choose report" className="grid gap-3 md:grid-cols-2">
        {marketCatalog.map(market => <a key={market.key} href={`/markets?report=${market.key}`} aria-current={selected === market.key ? 'page' : undefined} className={`glass block space-y-2 p-5 hover:border-[var(--beam-400)] ${selected === market.key ? 'ring-2 ring-[var(--beam-400)]' : ''}`}>
          <span className="text-beam-ink text-sm font-semibold">{market.label}</span><strong className="block text-lg">{market.title}</strong><span className="text-muted block text-sm">Maturity: {utc(market.maturity)}</span><span className="text-muted block text-xs">Vault {market.vault}</span>
        </a>)}
      </nav>
    </section>
    {selected === 'accelerated' ? <AcceleratedMarket /> : <MarketScreen id="1" base="/onchain" />}
  </>;
}
