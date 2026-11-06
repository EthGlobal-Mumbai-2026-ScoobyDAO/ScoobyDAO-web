import { erc20Abi, parseAbi } from 'viem';

// Typed ABIs from the frozen onchain interface (INTERFACES.md §2 + contracts CLAUDE.md §3).
// abi/*.json is the synced copy from ScoobyDAO-contracts; contracts.test.ts checks these
// signatures still exist there so drift is caught instead of patched around.

export const claimRegistryAbi = parseAbi([
  'struct Claim { address token; bytes32 manifestHash; bytes32 approvalId; uint64 openedAt; uint64 windowEnd; uint64 frozenAt; uint8 status; }',
  'function register(address token, bytes32 manifestHash, bytes32 approvalId, uint64 windowSeconds, address[] excluded) returns (uint256 claimId)',
  'function trigger(uint256 claimId, bytes32 evidenceHash)',
  'function resolve(uint256 claimId)',
  'function getClaim(uint256 claimId) view returns (Claim)',
  'function isExcluded(uint256 claimId, address who) view returns (bool)',
  'function commitsOpen(uint256 claimId) view returns (bool)',
  'function revealPeriod() view returns (uint64)',
  'event ClaimRegistered(uint256 indexed claimId, address indexed token, bytes32 manifestHash, bytes32 approvalId)',
  'event ClaimTriggered(uint256 indexed claimId, bytes32 evidenceHash, uint64 at)',
  'event ClaimResolved(uint256 indexed claimId, uint8 outcome)',
]);

export const verdictMarketAbi = parseAbi([
  'function commit(uint256 claimId, bytes32 commitment, uint256 amount)',
  'function reveal(uint256 claimId, uint8 side, uint256 amount, bytes32 salt)',
  'function redeem(uint256 claimId)',
  'function shareTokens(uint256 claimId) view returns (address forToken, address againstToken)',
  'function totals(uint256 claimId) view returns (uint256 committed, uint256 forRevealed, uint256 againstRevealed)',
  'function feeBps() view returns (uint16)',
  'event Committed(uint256 indexed claimId, address indexed staker, uint256 amount)',
  'event Revealed(uint256 indexed claimId, address indexed staker, uint8 side, uint256 amount)',
  'event Redeemed(uint256 indexed claimId, address indexed staker, uint256 payout)',
]);

export const freezeHookAbi = parseAbi([
  'function claimOfPool(bytes32 poolId) view returns (uint256 claimId)',
  'event ImpliedOdds(uint256 indexed claimId, uint256 forPriceX18)',
]);

export const shareTokenAbi = erc20Abi;
export const usdcAbi = [
  ...erc20Abi,
  ...parseAbi(['function mint(address to, uint256 amount)']),
] as const;
