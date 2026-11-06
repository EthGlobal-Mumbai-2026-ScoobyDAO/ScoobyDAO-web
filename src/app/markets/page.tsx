import { redirect } from 'next/navigation';
import { listReportChoices } from '@/protocol/reportDiscovery';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ report?: string }> }) {
  const { report } = await searchParams;
  const choices = await listReportChoices();
  const requested = report === 'original' ? choices.find(x => x.deployment === 'original' && x.tradable) : choices.find(x => x.deployment === 'flexible' && x.tradable);
  const first = requested ?? choices.find(x => x.tradable) ?? choices[0];
  redirect(first ? `/markets/${first.deployment}/${first.id}` : '/reports');
}
