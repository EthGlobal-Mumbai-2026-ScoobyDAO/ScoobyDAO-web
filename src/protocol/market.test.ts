import { getAddress } from 'viem';
import { describe, expect, it } from 'vitest';
import { constantProductOut, impliedAprFromPrice, marketBlock, minOutFor, spotPriceWad, yieldPoolKey, zeroForOneFor } from './market';

const USDC = getAddress('0x3d1f1bffb82a244bf58ff42a3202e7d25aeb2525');
const YT = getAddress('0x00000000000000000000000000000000000000a7');
const HOOK = getAddress('0x0000000000000000000000000000000000002088');

describe('quote → minOut', () => {
  it('matches YieldMarketHook.beforeSwap integer math', () => {
    // netIn = 10e6 * (1e6 - 3000) / 1e6 = 9_970_000; out = 400e6 * 9.97e6 / (24e6 + 9.97e6) = 117_397_703
    expect(constantProductOut(10_000_000n, 24_000_000n, 400_000_000n, 3000)).toBe(117_397_703n);
  });
  it('returns 0 when the hook would revert SWAP_LIMIT', () => {
    expect(constantProductOut(0n, 1n, 1n, 0)).toBe(0n);
    expect(constantProductOut(1n, 1_000_000n, 1n, 0)).toBe(0n);
  });
  it('applies slippage in bps with floor', () => {
    expect(minOutFor(117_397_703n, 50)).toBe(116_810_714n);
    expect(minOutFor(1_000n, 0)).toBe(1_000n);
    expect(minOutFor(999n, 100)).toBe(989n);
  });
  it('spot price and implied APR', () => {
    expect(spotPriceWad(24_000_000n, 400_000_000n)).toBe(60_000_000_000_000_000n);
    expect(impliedAprFromPrice(60_000_000_000_000_000n, 365 * 86_400)).toBe(60_000_000_000_000_000n);
    expect(impliedAprFromPrice(1n, 0)).toBeUndefined();
  });
});

describe('PoolKey as YieldHookFactory builds it', () => {
  it('sorts currencies, fee 0, tickSpacing 1', () => {
    const k = yieldPoolKey(USDC, YT, HOOK);
    expect(k).toEqual({ currency0: YT, currency1: USDC, fee: 0, tickSpacing: 1, hooks: HOOK });
    expect(zeroForOneFor(k, 'buy', USDC)).toBe(false); // dUSD is currency1
    expect(zeroForOneFor(k, 'sell', USDC)).toBe(true);
  });
});

describe('disabled reasons', () => {
  const base = { maturity: 2_000, lockTime: 1_000 };
  it('one per reason', () => {
    expect(marketBlock({ ...base }, 500)).toBe('not_locked');
    expect(marketBlock({ ...base }, 1_500)).toBe('not_deployed');
    expect(marketBlock({ ...base, market: { configured: true, maturity: 2_000 } }, 1_500)).toBe('no_router');
    expect(marketBlock({ ...base, market: { router: '0x1', configured: false, maturity: 2_000 } }, 1_500)).toBe('not_configured');
    expect(marketBlock({ ...base, market: { router: '0x1', configured: true, maturity: 2_000 } }, 2_000)).toBe('matured');
    expect(marketBlock({ ...base, market: { router: '0x1', configured: true, maturity: 2_000 } }, 1_999)).toBeNull();
  });
});
