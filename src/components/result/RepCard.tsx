'use client';

import { BadgeCheck } from 'lucide-react';
import { useState } from 'react';
import { Banner } from '@/components/Banner';
import { DemoIdentityLabel } from '@/components/HonestyLabels';
import { TxPlanStepper, usePlan } from '@/components/TxPlanStepper';
import { api, ApiError } from '@/lib/api';
import { useFixturesMode } from '@/lib/queries';
import type { MarketView, PositionView } from '@/protocol';
import { useActiveAccount, useProtocol } from '@/protocol/hooks';

type State = 'idle' | 'verifying' | 'claiming' | 'success' | 'already' | 'cancelled' | 'ineligible';

/**
 * One REP badge per verified human per report (Reputation.claimWinnerREP). Behind
 * NEXT_PUBLIC_REP_ENABLED. The backend endpoint that verifies the World IDKit proof and signs the
 * authorization (proposed POST /web/v1/rep/authorize) doesn't exist yet, and IDKit 4.x needs a
 * backend-signed rp_context, so the live path is not wired; fixtures simulate the proof (NOTES.md).
 */
export function RepCard({ market: m, pos }: { market: MarketView; pos: PositionView }) {
  const { protocol } = useProtocol();
  const apiFixtures = useFixturesMode().data ?? false;
  const { address } = useActiveAccount();
  const plan = usePlan();
  const [state, setState] = useState<State>(pos.repBadge ? 'success' : 'idle');
  const winner = m.phase === 'final_yes' ? pos.yes > 0n : m.phase === 'final_no' ? pos.no > 0n : false;

  const claim = async (proof: unknown) => {
    if (!address || !protocol.claimRep) return;
    setState('verifying');
    try {
      const auth = await api.authorizeRep({ reportId: m.reportId.toString(), recipient: address, proof });
      setState('claiming');
      const r = await plan.start(() => protocol.claimRep!(auth));
      setState(r.ok ? 'success' : r.reason?.includes('ALREADY_CLAIMED') ? 'already' : r.reason?.includes('INELIGIBLE') ? 'ineligible' : 'idle');
    } catch (e) {
      setState(e instanceof ApiError && e.status === 409 ? 'already' : e instanceof ApiError && e.status === 400 ? 'cancelled' : 'idle');
    }
  };

  return (
    <div className="glass space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Claim REP badge</h3>
        <DemoIdentityLabel />
      </div>
      <p className="text-muted text-sm">One reputation badge per verified human (World ID) for this report.</p>
      {state === 'success' ? (
        <p className="text-clue-ink flex items-center gap-2 font-semibold" role="status">
          <BadgeCheck size={18} aria-hidden /> REP badge claimed.
        </p>
      ) : state === 'already' ? (
        <Banner tone="warning" title="This human already claimed a badge for this report" />
      ) : state === 'cancelled' || state === 'ineligible' ? (
        <Banner tone="info" title={state === 'cancelled' ? 'Verification cancelled' : 'Not eligible'}>
          {state === 'ineligible' ? 'Only winners of a final Yes/No result can claim.' : 'Nothing was claimed. You can try again.'}
        </Banner>
      ) : !winner ? (
        <p className="text-sm">Only winning positions of a final Yes/No result can claim a badge.</p>
      ) : !apiFixtures ? (
        <p className="text-sm">Waiting on the backend World ID verification service; not available live yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={state !== 'idle'}
            onClick={() => void claim({ fixture: true, protocol_version: '4.0' })}
            className="bg-beam text-on-beam rounded-xl px-4 py-2 text-sm font-semibold hover:brightness-105 disabled:opacity-60"
          >
            {state === 'verifying' ? 'Verifying…' : state === 'claiming' ? 'Claiming…' : 'Verify with World ID (demo)'}
          </button>
          <button type="button" onClick={() => void claim(null)} className="border-line rounded-xl border px-3 py-2 text-sm">
            Cancel
          </button>
        </div>
      )}
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
    </div>
  );
}
