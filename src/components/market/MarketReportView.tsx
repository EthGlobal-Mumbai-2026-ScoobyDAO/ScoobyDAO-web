'use client';

import { OnchainDashboard } from '@/components/onchain/OnchainDashboard';
import { StakeScreen } from '@/components/stake/StakeScreen';
import { MarketScreen } from '@/components/market/MarketScreen';
import { ResultScreen } from '@/components/result/ResultScreen';
import { ChainsScreen } from './ChainsScreen';
import { ReportDropdown } from './ReportDropdown';
import { TxProvider } from '@/lib/tx';
import { ProtocolOverrideProvider } from '@/protocol/hooks';
import type { ReportChoice } from '@/protocol/reportDiscovery';
import { v2, v2Flexible } from '@/protocol/v2';
import { v2ForBundle } from '@/protocol/v2';
import { bundleForMarket } from '@/protocol/dynamicMarket';
import { useMemo } from 'react';
import { MarketSetup } from './MarketSetup';

export function MarketReportView({ deployment, reportId, tab, choices }: { deployment: 'original' | 'flexible'; reportId: string; tab: 'overview' | 'stake' | 'market' | 'result' | 'chains'; choices: ReportChoice[] }) {
  const base = `/markets/${deployment}` as const;
  const choice = choices.find(x => x.deployment === deployment && x.id === reportId);
  const protocol = useMemo(() => choice?.market ? v2ForBundle(bundleForMarket(choice)) : deployment === 'flexible' ? v2Flexible : v2, [choice, deployment]);
  const view = tab === 'overview' ? <OnchainDashboard id={reportId} base={base} />
    : tab === 'stake' ? <StakeScreen id={reportId} base={base} />
      : tab === 'market' ? <MarketScreen id={reportId} base={base} />
        : tab === 'result' ? <ResultScreen id={reportId} base={base} />
          : <ChainsScreen id={reportId} base={base} />;
  return <ProtocolOverrideProvider protocol={protocol}>
    <TxProvider bundle={protocol.deploymentBundle}>
      <ReportDropdown choices={choices} deployment={deployment} id={reportId} />
      {choice && ((choice.market && !choice.ccipReady) || !choice.tradable) && <MarketSetup choice={choice} />}
      {view}
    </TxProvider>
  </ProtocolOverrideProvider>;
}
