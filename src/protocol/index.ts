import { v1Deployed, v2Deployed } from '@/contracts/addresses';
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
  loadTracked,
  saveTracked,
  CCIP_SLOW_MINUTES,
  type TrackedCcip,
} from './ccip';
export { FIXTURE_ACCOUNT, HELD_MESSAGE_ID, subscribeFixture, warpFixture } from './fixture';
export { decodeEffects } from './effects';
export { sepolia as deployed, arbitrumSepolia as deployedArb, ccipV1Deployed, ccipV2Deployed } from '@/contracts/addresses';

/** Which contracts a live session talks to. */
export const liveDeployed = env.protocol === 'v2' ? v2Deployed : v1Deployed;

/**
 * Fixture chain when NEXT_PUBLIC_USE_FIXTURES=true, when the selected protocol's addresses are
 * missing, or when the backend itself is in fixture mode (so fixture reports never point at
 * real report ids).
 */
export function selectProtocol(apiFixtures: boolean): Protocol {
  if (env.forceFixtures || apiFixtures || !liveDeployed) return fixture;
  return env.protocol === 'v2' ? v2 : v1;
}

export const fixtureProtocol = fixture;
