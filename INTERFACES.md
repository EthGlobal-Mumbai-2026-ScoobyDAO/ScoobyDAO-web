# RiskFi — Cross-Repo Interfaces (shared by all three repos)

> Copy this file into the root of each repo. If you change anything here, change it in all three repos in the same hour and tell the team. The contracts repo owns ABIs and addresses; the backend repo owns the HTTP API.

## Repos

| Repo | Owns | Publishes | Consumes |
|---|---|---|---|
| `riskfi-contracts` (the DAO) | Solidity, Foundry tests, deploy scripts, mock tokens, v4 hook + pools | `deployments/sepolia.json`, `abi/*.json` | Nothing |
| `riskfi-backend` | Agents, claim checks, World Agent Pass gate, publisher, resolver, HTTP API | HTTP API (below) | Contracts ABIs + addresses |
| `riskfi-web` | Next.js app, wallet flows, reviewer approval page | Nothing | Backend API + contract ABIs + addresses |

## 1. Contract artifacts (published by `riskfi-contracts`)

After every Sepolia deploy, the contracts repo commits:

```
deployments/sepolia.json
abi/ClaimRegistry.json
abi/VerdictMarket.json
abi/ShareToken.json
abi/FreezeHook.json
abi/Treasury.json
abi/MockUSDC.json
abi/HoneypotToken.json
abi/HonestToken.json
```

`deployments/sepolia.json` shape:
```json
{
  "chainId": 11155111,
  "deployedAt": "2026-11-07T10:00:00Z",
  "commit": "<git sha>",
  "contracts": {
    "ClaimRegistry": "0x…",
    "VerdictMarket": "0x…",
    "FreezeHook": "0x…",
    "Treasury": "0x…",
    "USDC": "0x…",
    "HoneypotToken": "0x…",
    "HonestToken": "0x…",
    "PoolManager": "0x…",
    "SwapRouter": "0x…"
  },
  "roles": { "publisher": "0x…", "resolver": "0x…" },
  "demo": { "deployer": "0x…", "funder": "0x…" }
}
```

**How the other repos sync:** run `scripts/sync-contracts.sh` (each consumer repo has one) which copies `abi/` and `deployments/sepolia.json` from a local checkout of `riskfi-contracts` (path in env `CONTRACTS_REPO_PATH`) or downloads them from the GitHub raw URL. Commit the synced copies so each repo builds on its own.

## 2. Onchain interface (frozen — don't rename without telling everyone)

```solidity
enum Status { None, Open, Frozen, ResolvedPass, ResolvedFail, Refunded }
enum Side   { For, Against }

// ClaimRegistry
function register(address token, bytes32 manifestHash, bytes32 approvalId,
                  uint64 windowSeconds, address[] calldata excluded)
  external returns (uint256 claimId);                       // PUBLISHER_ROLE only
function trigger(uint256 claimId, bytes32 evidenceHash) external; // RESOLVER_ROLE only → Frozen
function resolve(uint256 claimId) external;
function getClaim(uint256 claimId) external view returns (Claim memory);
function isExcluded(uint256 claimId, address who) external view returns (bool);
event ClaimRegistered(uint256 indexed claimId, address indexed token, bytes32 manifestHash, bytes32 approvalId);
event ClaimTriggered(uint256 indexed claimId, bytes32 evidenceHash, uint64 at);
event ClaimResolved(uint256 indexed claimId, Status outcome);

// VerdictMarket
function commit(uint256 claimId, bytes32 commitment, uint256 amount) external;
// commitment = keccak256(abi.encode(claimId, msg.sender, uint8(side), amount, salt))
function reveal(uint256 claimId, uint8 side, uint256 amount, bytes32 salt) external;
function redeem(uint256 claimId) external;
function shareTokens(uint256 claimId) external view returns (address forToken, address againstToken);
function totals(uint256 claimId) external view returns (uint256 committed, uint256 forRevealed, uint256 againstRevealed);
function feeBps() external view returns (uint16); // default 300
event Committed(uint256 indexed claimId, address indexed staker, uint256 amount);
event Revealed(uint256 indexed claimId, address indexed staker, uint8 side, uint256 amount);
event Redeemed(uint256 indexed claimId, address indexed staker, uint256 payout);

// FreezeHook
function claimOfPool(bytes32 poolId) external view returns (uint256 claimId);
event ImpliedOdds(uint256 indexed claimId, uint256 forPriceX18);
```

Units: USDC and share tokens use **6 decimals**. Timestamps are unix seconds.

## 3. Manifest format (owned by backend, hash goes onchain)

```json
{
  "version": 1,
  "chainId": 11155111,
  "token": "0x…",
  "claims": [{ "id": 0, "type": "SELL_REVERTS", "params": { "minSellTaxBps": 9000 } }],
  "evidence": [{ "kind": "simulation", "result": "revert", "detail": "…" }],
  "summary": "LLM-drafted, human-readable",
  "excludedWallets": ["0x…"],
  "windowSeconds": 259200,
  "createdAt": 1762400000
}
```
`manifestHash = keccak256(utf8(canonicalJSON(manifest)))` where canonical JSON = keys sorted, no whitespace. Backend exposes the exact JSON so anyone can recompute the hash.

Claim types: `SELL_REVERTS`, `SELL_TAX_ABOVE`, `OWNER_CAN_PAUSE_OR_BLACKLIST`.

## 4. Backend HTTP API (owned by `riskfi-backend`)

Base URL in env: `NEXT_PUBLIC_API_URL`. JSON everywhere. CORS allows the web origin only.

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{ ok: true }` |
| GET | `/reports` | `Report[]` |
| GET | `/reports/:id` | `Report` (includes full manifest) |
| POST | `/reports/:id/approve` | `Approval` — starts a World Agent Pass device grant |
| GET | `/approvals/:id` | `Approval` (poll every 2s) |
| GET | `/claims/:claimId` | `ClaimView` |
| GET | `/deployments` | the current `deployments/sepolia.json` |
| POST | `/demo/scan` | *(demo only, behind `DEMO_MODE=true`)* triggers the scout now |

```ts
type ReportStatus = 'draft' | 'awaiting_approval' | 'denied' | 'expired' | 'published';
interface Report {
  id: string; token: string; chainId: number;
  status: ReportStatus;
  manifest: Manifest; manifestHash: `0x${string}`;
  approvalId?: string; claimId?: string; txHash?: `0x${string}`;
  createdAt: number;
}

type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'rejected_not_reviewer' | 'spent';
interface Approval {
  id: string; reportId: string; manifestHash: `0x${string}`;
  status: ApprovalStatus;
  userCode?: string;               // shown on the reviewer page
  verificationUri?: string;        // link/QR into World App
  expiresAt: number;
  publishTxHash?: `0x${string}`;
  // device_code, tokens and secrets are NEVER returned
}

interface ClaimView {
  claimId: string; token: string; status: 'Open'|'Frozen'|'ResolvedPass'|'ResolvedFail'|'Refunded';
  windowEnd: number; frozenAt?: number;
  totals: { committed: string; forRevealed: string; againstRevealed: string }; // 6-decimal strings
  shareTokens: { for: string; against: string };
  pools: { for?: string; against?: string };   // v4 pool ids
  impliedForProbability?: number;              // 0..1
  evidenceHash?: string; triggerTxHash?: string;
}
```

## 5. Environments and keys

| Key | Lives in | Never in |
|---|---|---|
| Deployer key | contracts repo `.env` (local only) | git, backend, web |
| Publisher key (`PUBLISHER_ROLE`) | backend server env | git, web |
| Resolver key (`RESOLVER_ROLE`) | backend server env | git, web |
| World client secret, device codes | backend server env / DB | git, web, API responses |
| Anything `NEXT_PUBLIC_*` | web | — (it is public by definition) |

## 6. Change protocol
1. Interface change → edit this file in a PR in the owning repo first.
2. Copy the updated file to the other two repos; bump the version line below.
3. Post in the team chat: what changed and which commit.

**Interfaces version:** 1 (2026-11-06)
