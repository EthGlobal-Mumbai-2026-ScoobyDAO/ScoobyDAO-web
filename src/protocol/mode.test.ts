import { afterEach, describe, expect, it, vi } from 'vitest';

// Live mode: the chain protocol depends only on NEXT_PUBLIC_CHAIN_MODE and NEXT_PUBLIC_PROTOCOL.
// A failing backend /health must never switch staking, market, CCIP or claims to the fixture chain.
const config = vi.hoisted(() => ({
  apiUrl: 'http://127.0.0.1:8000/web/v1',
  chainMode: 'live' as 'live' | 'fixture',
  protocol: 'v2' as 'v1' | 'v2',
  forceFixtures: false,
  ccipApiUrl: 'https://api.ccip.chain.link',
  lpEnabled: true,
  operatorView: false,
  reputationBadgeEnabled: false,
  faucetUrl: '',
  walletConnectProjectId: '',
}));
vi.mock('@/lib/env', () => ({ env: config }));

import { usingFixtures } from '@/lib/api';
import { selectProtocol } from './index';

afterEach(() => {
  config.chainMode = 'live';
  config.protocol = 'v2';
  config.forceFixtures = false;
  vi.unstubAllGlobals();
});

describe('protocol selection', () => {
  it('a failing backend /health keeps the live V2 chain protocol (and no fixture backend)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    expect(selectProtocol().kind).toBe('v2');
    await expect(usingFixtures()).resolves.toBe(false);
    expect(selectProtocol().kind).toBe('v2');
    // Nothing probes /health to decide the mode.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a backend in fixture mode does not change the chain protocol either', () => {
    config.forceFixtures = true;
    expect(selectProtocol().kind).toBe('v2');
  });

  it('only the env switches choose v1 or the fixture chain', () => {
    config.protocol = 'v1';
    expect(selectProtocol().kind).toBe('v1');
    config.chainMode = 'fixture';
    expect(selectProtocol().kind).toBe('fixture');
  });
});
