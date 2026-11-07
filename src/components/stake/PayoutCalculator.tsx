'use client';

import { useId, useState } from 'react';
import { InfoTip, SegmentedControl } from '@/components/ui';
import { formatUsdc, parseUsdc } from '@/lib/format';
import { previewStake, type Totals } from '@/lib/payout';
import type { SideKey } from './SidePicker';

/** The rules in one popover, so cards can stay at two lines. */
export function PayoutRulesTip() {
  return (
    <InfoTip label="How payouts work">
      <strong className="block">How payouts work</strong>
      <span className="text-muted mt-1 block">
        After maturity the resolver proposes Yes, No or Void; anyone can challenge during the challenge window, then anyone can finalize. Winners get their
        stake back plus 80% of the losing pool, pro rata; the fee is 20% of the losing pool only. Losers get 0.
      </span>
      <span className="text-muted mt-1 block">Example: Yes 80, No 20, Yes wins → fee 4, each Yes unit redeems 1.20.</span>
      <span className="text-muted mt-1 block">
        Void (one side empty, or no final result by the deadline) returns stakes with no fee. A simulated loss scales every payout down. Claims stay open 90
        days after the result.
      </span>
    </InfoTip>
  );
}

/**
 * "What would I get?" — enter an amount and a side, see the payout if Yes wins and if No wins at today's totals, using
 * the contract's math in src/lib/payout.ts unchanged.
 */
export function PayoutCalculator({ totals, projectedPrincipal, defaultAmount = '10' }: { totals: Totals; projectedPrincipal?: bigint; defaultAmount?: string }) {
  const id = useId();
  const [side, setSide] = useState<SideKey>('yes');
  const [value, setValue] = useState(defaultAmount);
  const amount = parseUsdc(value);
  const valid = amount !== null && amount > 0n;
  const p = valid ? previewStake(totals, side, amount, projectedPrincipal) : undefined;
  const scaled = projectedPrincipal !== undefined && projectedPrincipal < totals.yes + totals.no;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={id} className="min-w-0 flex-1">
          <span className="text-muted block text-[13px]">If I stake</span>
          <span className="border-line focus-within:border-beam mt-1 flex items-center rounded-xl border px-3">
            <input
              id={id}
              inputMode="decimal"
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={!valid && value !== ''}
              className="num w-full min-w-0 bg-transparent py-2 text-lg outline-none"
            />
            <span className="text-muted text-sm">dUSD</span>
          </span>
        </label>
        <SegmentedControl
          label="Side"
          value={side}
          onChange={setSide}
          items={[
            { key: 'yes', label: 'on Yes' },
            { key: 'no', label: 'on No' },
          ]}
        />
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {(['yes', 'no'] as const).map((s) => {
          const v = p ? (s === 'yes' ? p.ifYes : p.ifNo) : undefined;
          const win = s === side;
          return (
            <div key={s} className={`rounded-xl border p-3 ${win ? 'border-[color-mix(in_srgb,var(--beam-400)_45%,transparent)]' : 'border-line'}`}>
              <dt className={`text-[13px] ${s === 'yes' ? 'text-beam-ink' : 'text-clue-ink'}`}>If {s === 'yes' ? 'Yes' : 'No'} wins</dt>
              <dd className="num mt-1 text-xl font-semibold">{v !== undefined ? formatUsdc(v, { exact: true }) : '—'}</dd>
              <dd className="text-muted text-[13px]">dUSD back</dd>
            </div>
          );
        })}
      </dl>
      <p className="text-muted flex items-start gap-1.5 text-[13px]">
        <span>
          {!valid && value !== ''
            ? 'Enter an amount with at most 6 decimals.'
            : `Winners get their stake back plus 80% of the losing pool. Void returns ${p ? formatUsdc(p.ifVoid, { exact: true }) : 'your stake'}.${scaled ? ' Scaled down for a simulated loss.' : ''}`}
        </span>
        <PayoutRulesTip />
      </p>
    </div>
  );
}
