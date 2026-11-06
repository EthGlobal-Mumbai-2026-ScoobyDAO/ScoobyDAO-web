'use client';

import { useRouter } from 'next/navigation';
import type { ReportChoice } from '@/protocol/reportDiscovery';

export function ReportDropdown({ choices, deployment, id }: { choices: ReportChoice[]; deployment: string; id: string }) {
  const router = useRouter();
  const value = `${deployment}:${id}`;
  return <div className="mx-auto flex max-w-6xl flex-wrap items-end gap-4 px-4 pt-8">
    <label className="block max-w-xl space-y-2 text-sm font-semibold" htmlFor="report-select">
      <span>Select report</span>
      <select id="report-select" value={value} onChange={event => {
        const [nextDeployment, nextId] = event.target.value.split(':');
        router.push(`/markets/${nextDeployment}/${nextId}`);
      }} className="border-line bg-surface text-text block w-full rounded-xl border p-3">
        {choices.map(choice => <option key={`${choice.deployment}:${choice.id}`} value={`${choice.deployment}:${choice.id}`}>
          {choice.deployment === 'flexible' ? 'Flexible' : 'Original'} registry · report #{choice.id} · {choice.tradable ? 'market deployed' : 'market setup pending'}
        </option>)}
      </select>
    </label>
  </div>;
}
