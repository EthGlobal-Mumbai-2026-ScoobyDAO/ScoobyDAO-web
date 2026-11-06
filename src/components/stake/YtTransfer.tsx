'use client';

import { useState } from 'react';
import { getAddress, isAddress, type Address } from 'viem';
import { AmountField, validAmount, WritesBlockedNote } from '@/components/forms';
import { TxPlanStepper, usePlan } from '@/components/TxPlanStepper';
import { formatUsdc } from '@/lib/format';
import { useActiveAccount, useProtocol, useWritesAllowed } from '@/protocol/hooks';

/** YT is an ERC-20 and moves freely; the Yes/No position stays in the vault (no transfer function). */
export function YtTransfer({ ytBalance }: { ytBalance: bigint }) {
  const { protocol } = useProtocol();
  const { address } = useActiveAccount();
  const writes = useWritesAllowed();
  const plan = usePlan();
  const [to, setTo] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  if (!protocol.transferYt) return null;
  const toAddr: Address | null = isAddress(to.trim()) ? getAddress(to.trim()) : null;
  const amount = validAmount(amountStr, ytBalance);
  return (
    <details className="border-line rounded-xl border p-3 text-sm">
      <summary className="cursor-pointer font-semibold">Send YT to another wallet</summary>
      <div className="mt-3 space-y-3">
        <p className="text-muted">The yield token is transferable. Your Yes/No position is not: the vault has no function to move it.</p>
        <label className="block">
          <span className="text-muted">Recipient (Ethereum Sepolia)</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x…"
            className="num border-line focus:border-beam mt-1 w-full rounded-xl border bg-transparent px-3 py-2 outline-none"
          />
          {to && !toAddr && <span className="text-mask-ink">Not a valid address.</span>}
        </label>
        <AmountField label="Amount (YT)" unit="YT" value={amountStr} onChange={setAmountStr} balance={ytBalance} />
        <WritesBlockedNote />
        <button
          type="button"
          disabled={!address || !toAddr || !amount || plan.running || !writes.allowed || toAddr.toLowerCase() === address.toLowerCase()}
          onClick={async () => {
            setSent(null);
            const r = await plan.start(() => protocol.transferYt!(toAddr!, amount!, address!));
            if (r.ok) {
              setSent(`Sent ${formatUsdc(amount!)} YT. Your position didn't move.`);
              setAmountStr('');
            }
          }}
          className="border-line rounded-lg border px-3 py-1.5 font-semibold hover:border-[var(--fog-400)] disabled:opacity-50"
        >
          Send YT
        </button>
        <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
        {sent && (
          <p className="text-clue-ink" role="status">
            {sent}
          </p>
        )}
      </div>
    </details>
  );
}
