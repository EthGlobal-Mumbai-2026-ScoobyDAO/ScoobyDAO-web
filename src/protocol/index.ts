import { env } from '@/lib/env';
import { fixture } from './fixture';
import type { Protocol } from './types';
import { v1 } from './v1';
import { v2 } from './v2';

export * from './types';
export * from './phase';
export * from './market';
export {
  buildIntentV1,
  buildIntentV2,
  ccipPending,
  ccipStatus,
  isSlow,
  isSlowStake,
  loadTracked,
  newRemoteAttempt,
  saveTracked,
  randomNonce,
  withFeeBuffer,
  CCIP_GAS_LIMIT,
  CCIP_SLOW_MINUTES,
  type TrackedCcip,
} from './ccip';
export { FIXTURE_ACCOUNT, HELD_MESSAGE_ID, subscribeFixture, warpFixture } from './fixture';
export { decodeEffects, withKnownErrors } from './effects';
export { deploymentQuery, writeBlockReason, type DeploymentCheckItem, type DeploymentReport } from './deployment';
export { V2_INFO, V2_FLEX_INFO, isV2Example, isSameAddress } from './v2';
export { sepolia as deployed, arbitrumSepolia as deployedArb, ccipV1Deployed } from '@/contracts/addresses';

/**
 * The chain protocol comes only from NEXT_PUBLIC_CHAIN_MODE (live | fixture, default live) and
 * NEXT_PUBLIC_PROTOCOL (v2 | v1, default v2). Backend availability never changes it: a failing
 * /health only affects backend-sourced pages, never staking, trading, CCIP or claims.
 */
export function selectProtocol(): Protocol {
  if (env.chainMode === 'fixture') return fixture;
  return env.protocol === 'v1' ? v1 : v2;
}

export const fixtureProtocol = fixture;
