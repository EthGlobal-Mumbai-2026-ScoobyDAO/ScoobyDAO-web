import original from '@/contracts/v2/addresses.json';
import accelerated from '@/contracts/accelerated/addresses.json';

/** Each tradable report needs its own deployed vault, YT and hook; IDs repeat across registries. */
export const marketCatalog = [
  {
    key: 'accelerated',
    label: 'One-hour demo · report #1',
    title: 'Accelerated YT/dUSD market',
    maturity: accelerated.ethereumSepolia.reportTimes.maturity,
    vault: accelerated.ethereumSepolia.contracts.RiskFiStakeVaultV2,
  },
  {
    key: 'original',
    label: 'Original V2 · report #1',
    title: 'Longer-running YT/dUSD market',
    maturity: original.ethereumSepolia.reportTimes.maturity,
    vault: original.ethereumSepolia.contracts.RiskFiStakeVaultV2,
  },
] as const;
