import {
  encodeAbiParameters,
  encodePacked,
  keccak256,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';

// Uniswap v4 swap plumbing, encoded with viem (no ethers-based SDK). Sources (checked 2026-11-06):
// - Universal Router commands: developers.uniswap.org/docs/protocols/universal-router/concepts/commands
// - V4Router actions + params: v4-periphery src/libraries/Actions.sol, IV4Router.sol
// - Quoter: v4-periphery IV4Quoter.quoteExactInputSingle(QuoteExactSingleParams)

export const COMMAND_V4_SWAP = 0x10;
export const ACTION = { SWAP_EXACT_IN_SINGLE: 0x06, SETTLE_ALL: 0x0c, TAKE_ALL: 0x0f } as const;

/** Canonical Permit2 (same address on every chain). */
export const PERMIT2: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
/** V4Quoter on Sepolia per Uniswap docs. Not in sepolia.json; see NOTES.md. */
export const V4_QUOTER: Address = '0x68aFa8b853cAa7a2D40B0F6AEE5C4DbC147C8244';

/**
 * Pool parameters the contracts' SeedPools script must use. Not published in sepolia.json
 * or ClaimView; checked at runtime by recomputing the pool id against ClaimView.pools.
 */
export const POOL_FEE = 3000;
export const POOL_TICK_SPACING = 60;

/**
 * Newer v4-periphery adds `uint256 minHopPriceX36` to ExactInputSingleParams; the released
 * routers used by Uniswap's swap guides take the 5-field struct. Flip if SwapRouter is newer.
 */
export const ROUTER_HAS_MIN_HOP_PRICE = false;

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

const POOL_KEY_COMPONENTS = [
  { name: 'currency0', type: 'address' },
  { name: 'currency1', type: 'address' },
  { name: 'fee', type: 'uint24' },
  { name: 'tickSpacing', type: 'int24' },
  { name: 'hooks', type: 'address' },
] as const;

export function poolKeyFor(shareToken: Address, usdc: Address, hooks: Address): PoolKey {
  const [currency0, currency1] =
    shareToken.toLowerCase() < usdc.toLowerCase() ? [shareToken, usdc] : [usdc, shareToken];
  return { currency0, currency1, fee: POOL_FEE, tickSpacing: POOL_TICK_SPACING, hooks };
}

/** PoolId = keccak256(abi.encode(PoolKey)) */
export function poolIdOf(key: PoolKey): Hex {
  return keccak256(
    encodeAbiParameters([{ type: 'tuple', components: POOL_KEY_COMPONENTS }], [key]),
  );
}

/** Universal Router `execute(commands, inputs, deadline)` args for an exact-in single-hop swap. */
export function encodeExactInSingle(args: {
  key: PoolKey;
  zeroForOne: boolean;
  amountIn: bigint;
  minAmountOut: bigint;
}) {
  const { key, zeroForOne, amountIn, minAmountOut } = args;
  const actions = encodePacked(
    ['uint8', 'uint8', 'uint8'],
    [ACTION.SWAP_EXACT_IN_SINGLE, ACTION.SETTLE_ALL, ACTION.TAKE_ALL],
  );
  const swapParams = ROUTER_HAS_MIN_HOP_PRICE
    ? encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'poolKey', type: 'tuple', components: POOL_KEY_COMPONENTS },
              { name: 'zeroForOne', type: 'bool' },
              { name: 'amountIn', type: 'uint128' },
              { name: 'amountOutMinimum', type: 'uint128' },
              { name: 'minHopPriceX36', type: 'uint256' },
              { name: 'hookData', type: 'bytes' },
            ],
          },
        ],
        [
          {
            poolKey: key,
            zeroForOne,
            amountIn,
            amountOutMinimum: minAmountOut,
            minHopPriceX36: 0n,
            hookData: '0x',
          },
        ],
      )
    : encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'poolKey', type: 'tuple', components: POOL_KEY_COMPONENTS },
              { name: 'zeroForOne', type: 'bool' },
              { name: 'amountIn', type: 'uint128' },
              { name: 'amountOutMinimum', type: 'uint128' },
              { name: 'hookData', type: 'bytes' },
            ],
          },
        ],
        [{ poolKey: key, zeroForOne, amountIn, amountOutMinimum: minAmountOut, hookData: '0x' }],
      );
  const [cin, cout] = zeroForOne ? [key.currency0, key.currency1] : [key.currency1, key.currency0];
  const settle = encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [cin, amountIn]);
  const take = encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }],
    [cout, minAmountOut],
  );
  const input = encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes[]' }],
    [actions, [swapParams, settle, take]],
  );
  const commands = encodePacked(['uint8'], [COMMAND_V4_SWAP]);
  return { commands, inputs: [input] as const };
}

export const universalRouterAbi = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline) payable',
]);

export const permit2Abi = parseAbi([
  'function approve(address token, address spender, uint160 amount, uint48 expiration)',
  'function allowance(address user, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
]);

export const v4QuoterAbi = parseAbi([
  'struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }',
  'struct QuoteExactSingleParams { PoolKey poolKey; bool zeroForOne; uint128 exactAmount; bytes hookData; }',
  'function quoteExactInputSingle(QuoteExactSingleParams params) returns (uint256 amountOut, uint256 gasEstimate)',
]);
