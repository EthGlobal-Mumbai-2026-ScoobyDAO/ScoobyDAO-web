import { decodeAbiParameters, encodeAbiParameters, keccak256, slice } from 'viem';
import { describe, expect, it } from 'vitest';
import { ACTION, COMMAND_V4_SWAP, encodeExactInSingle, poolIdOf, poolKeyFor } from './v4';

const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const SHARE = '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF';
const HOOK = '0x0000000000000000000000000000000000004444';

describe('poolKeyFor / poolIdOf', () => {
  it('sorts currencies by address', () => {
    const k = poolKeyFor(SHARE, USDC, HOOK);
    expect(k.currency0).toBe(USDC);
    expect(k.currency1).toBe(SHARE);
  });

  it('pool id is keccak of the abi-encoded 5-word PoolKey', () => {
    const k = poolKeyFor(SHARE, USDC, HOOK);
    const manual = keccak256(
      encodeAbiParameters(
        [
          { type: 'address' },
          { type: 'address' },
          { type: 'uint24' },
          { type: 'int24' },
          { type: 'address' },
        ],
        [k.currency0, k.currency1, k.fee, k.tickSpacing, k.hooks],
      ),
    );
    expect(poolIdOf(k)).toBe(manual);
  });
});

describe('encodeExactInSingle', () => {
  it('builds V4_SWAP with SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL in canonical layout', () => {
    const key = poolKeyFor(SHARE, USDC, HOOK);
    const { commands, inputs } = encodeExactInSingle({
      key,
      zeroForOne: true,
      amountIn: 5_000_000n,
      minAmountOut: 4_900_000n,
    });
    expect(commands).toBe(`0x${COMMAND_V4_SWAP.toString(16)}`);
    // decodeActionsRouterParams expects abi.encode(bytes actions, bytes[] params): first word 0x40
    expect(BigInt(slice(inputs[0], 0, 32))).toBe(0x40n);
    const [actions, params] = decodeAbiParameters(
      [{ type: 'bytes' }, { type: 'bytes[]' }],
      inputs[0],
    );
    expect(actions).toBe(
      `0x${[ACTION.SWAP_EXACT_IN_SINGLE, ACTION.SETTLE_ALL, ACTION.TAKE_ALL].map((a) => a.toString(16).padStart(2, '0')).join('')}`,
    );
    const [settleCurrency, settleAmount] = decodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      params[1],
    );
    const [takeCurrency, takeMin] = decodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      params[2],
    );
    expect(settleCurrency).toBe(USDC); // zeroForOne: pay currency0
    expect(settleAmount).toBe(5_000_000n);
    expect(takeCurrency).toBe(SHARE);
    expect(takeMin).toBe(4_900_000n);
  });
});
