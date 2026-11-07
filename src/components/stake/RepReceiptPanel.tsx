'use client';

import { useState } from 'react';
import { getAddress, isAddress, type Address } from 'viem';
import { Banner } from '@/components/Banner';
import { AmountField, ApprovalToggle, validAmount, WritesBlockedNote } from '@/components/forms';
import { Disclosure } from '@/components/ui';
import { TxPlanStepper, usePlan } from '@/components/TxPlanStepper';
import { formatDate, formatUsdc } from '@/lib/format';
import { localStakeOpen, type MarketView } from '@/protocol';
import { useActiveAccount, useChainTime, usePosition, useProtocol, useWritesAllowed } from '@/protocol/hooks';
import { SidePicker, type SideKey } from './SidePicker';

type Action = 'deposit' | 'stake' | 'withdraw' | 'transfer';
const ACTIONS: [Action, string][] = [
  ['deposit', 'Deposit dUSD'],
  ['stake', 'Stake REP'],
  ['withdraw', 'Withdraw'],
  ['transfer', 'Transfer REP'],
];

/**
 * V2 REP: StakeReceiptREP, a 1:1 receipt for dUSD deposited in the vault but not staked. Unrelated
 * to the V1 World ID reputation badge. deposit mints REP, stakeFromREP burns it into a position +
 * YT (no REP approval), withdraw burns it for dUSD at any time.
 */
export function RepReceiptPanel({ market: m }: { market: MarketView }) {
  const { protocol } = useProtocol();
  const { address } = useActiveAccount();
  const position = usePosition(m.reportId, m.blockNumber);
  const now = useChainTime() ?? m.chainTime;
  const writes = useWritesAllowed();
  const plan = usePlan();
  const [action, setAction] = useState<Action>('deposit');
  const [amountStr, setAmountStr] = useState('');
  const [side, setSide] = useState<SideKey | null>(null);
  const [to, setTo] = useState('');
  const [unlimited, setUnlimited] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const pos = position.data;
  const balance = action === 'deposit' ? pos?.dusdBalance : pos?.repReceipt;
  const amount = validAmount(amountStr, balance);
  const stakeOpen = localStakeOpen(m, now);
  const toAddr: Address | null = isAddress(to.trim()) ? getAddress(to.trim()) : null;
  const ready =
    !!address &&
    !!amount &&
    writes.allowed &&
    !plan.running &&
    (action !== 'stake' || (!!side && stakeOpen)) &&
    (action !== 'transfer' || (!!toAddr && toAddr.toLowerCase() !== address.toLowerCase()));

  const submit = async () => {
    if (!address || !amount) return;
    setDone(null);
    const r = await plan.start(() => {
      if (action === 'deposit') return protocol.depositRep!(amount, address, { unlimited });
      if (action === 'stake') return protocol.stakeFromRep!(m.reportId, side === 'yes', amount, address);
      if (action === 'withdraw') return protocol.withdrawRep!(amount, address);
      return protocol.transferRep!(toAddr!, amount, address);
    });
    if (!r.ok) return;
    setAmountStr('');
    setDone(
      action === 'deposit'
        ? `Minted ${formatUsdc(amount)} REP for the dUSD you deposited.`
        : action === 'stake'
          ? `You got ${formatUsdc(r.effect.staked?.amount ?? amount)} YT (yield token) — it's transferable; your ${side === 'yes' ? 'Yes' : 'No'} position is not.`
          : action === 'withdraw'
            ? `Burned ${formatUsdc(amount)} REP and returned ${formatUsdc(amount)} dUSD.`
            : `Sent ${formatUsdc(amount)} REP.`,
    );
  };

  if (!address) return null;
  return (
    <section aria-labelledby="rep-h" className="glass space-y-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="rep-h" className="text-lg font-semibold">
          REP receipts
        </h2>
        <span className="num text-[15px] font-semibold">{pos ? formatUsdc(pos.repReceipt) : '…'} REP</span>
      </div>
      <p className="text-muted text-sm">A 1:1 receipt for dUSD you deposited but haven&apos;t staked yet. Withdraw any time.</p>
      <Disclosure summary="Deposit, stake, withdraw or transfer REP" defaultOpen={!!pos && pos.repReceipt > 0n}>
      <div className="space-y-4">
      <div role="radiogroup" aria-label="REP action" className="flex flex-wrap gap-2">
        {ACTIONS.map(([a, label]) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={action === a}
            onClick={() => {
              setAction(a);
              setDone(null);
            }}
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${action === a ? 'border-beam bg-[color-mix(in_srgb,var(--beam-400)_14%,transparent)]' : 'border-line text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {action === 'stake' && (
        <>
          <SidePicker value={side} onChange={setSide} disabled={plan.running || !stakeOpen} />
          {!stakeOpen && <p className="text-muted text-sm">Stakes locked at {formatDate(m.lockTime)}. REP can still be withdrawn or transferred.</p>}
          <p className="text-muted text-xs">Staking REP burns your own REP, so no approval is needed. You get the position and the same amount of YT.</p>
        </>
      )}
      {action === 'transfer' && (
        <label className="block text-sm">
          <span className="text-muted">Recipient (Ethereum Sepolia address)</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x…"
            className="num border-line focus:border-beam mt-1 w-full rounded-xl border bg-transparent px-3 py-2 outline-none"
          />
          {to && !toAddr && <span className="text-mask-ink">Not a valid address.</span>}
        </label>
      )}
      <AmountField label={action === 'deposit' ? 'Amount (dUSD)' : 'Amount (REP)'} unit={action === 'deposit' ? 'dUSD' : 'REP'} value={amountStr} onChange={setAmountStr} balance={balance} />
      {action === 'deposit' && <ApprovalToggle unlimited={unlimited} onChange={setUnlimited} />}
      <WritesBlockedNote />
      <button
        type="button"
        disabled={!ready}
        onClick={() => void submit()}
        className="bg-beam text-on-beam w-full rounded-xl px-4 py-2.5 font-semibold hover:brightness-105 disabled:opacity-50"
      >
        {plan.running
          ? 'Working…'
          : action === 'deposit'
            ? `Deposit ${amount ? formatUsdc(amount) : ''} dUSD for REP`
            : action === 'stake'
              ? side
                ? `Stake ${amount ? formatUsdc(amount) : ''} REP on ${side === 'yes' ? 'Yes' : 'No'}`
                : 'Pick Yes or No'
              : action === 'withdraw'
                ? `Withdraw ${amount ? formatUsdc(amount) : ''} dUSD`
                : 'Transfer REP'}
      </button>
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
      {done && <Banner tone="success" title={done} />}
      </div>
      </Disclosure>
    </section>
  );
}
