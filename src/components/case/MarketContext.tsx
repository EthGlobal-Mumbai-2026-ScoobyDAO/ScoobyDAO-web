'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ReportChoice } from '@/protocol/reportDiscovery';

export interface MarketChoices {
  choices: ReportChoice[];
  deployment: ReportChoice['deployment'];
  id: string;
}

const Ctx = createContext<MarketChoices | null>(null);

/** Lets the market header show the market picker and resolve the market's name on /markets/* pages. */
export function MarketChoicesProvider({ value, children }: { value: MarketChoices; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useMarketChoices = () => useContext(Ctx);

export const choiceKey = (c: Pick<ReportChoice, 'deployment' | 'id'>) => `${c.deployment}:${c.id}`;

/** Targets for useLinkedReports: only catalog markets can be linked to a backend report. */
export const linkTargets = (choices: ReportChoice[]) =>
  choices.map((c) => ({ key: choiceKey(c), id: c.id, claimHash: c.report?.claimHash, linkable: !!c.market }));
