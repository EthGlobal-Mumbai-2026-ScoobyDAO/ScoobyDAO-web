# NOTES — conflicts, gaps and decisions

Running log for `scoobydao-web`. Precedence when docs disagree: INTERFACES.md (data shapes) > CLAUDE.md (rules, scope) > THEME.md (look, copy, page features).

## Conflicts between docs

1. **Studio characters.** THEME.md §0.1 and the build prompt say "You _can_ use Scooby-Doo or any other studio character…", but THEME.md §1.3 (mascot must be original), §1.4 ("No catchphrases borrowed from existing cartoons"), §7 prompts ("ORIGINAL — no existing cartoon characters") and the §9 checklist ("No studio character, name or catchphrase anywhere") all say the opposite. Treated as a typo for "can't". The app uses only the original brand **Unmasked** and mascot **Sniff**; no studio characters, names, catchphrases or likenesses anywhere user-facing. The repo/package name `scoobydao-web` is internal only.
2. **Routes.** CLAUDE.md §2–3 uses `/`, `/reports/[id]`, `/claim/[claimId]`, `/market/[claimId]`; THEME.md §5 and the build prompt use `/` (landing), `/cases`, `/cases/[id]`, `/case/[claimId]/stake`, `/case/[claimId]/market`. These are page routes (not API routes), so THEME.md wins on page features. The THEME.md routes are the canonical ones; the CLAUDE.md paths redirect to them.
3. **Banner copy.** CLAUDE.md §3.3 says "Denied — draft only, no market opened"; THEME.md §5.4 says "Denied — no case opened". THEME.md wins on copy, but the build prompt asks for "the exact banner copy" from CLAUDE.md. Resolution: THEME.md wording as the headline, CLAUDE.md wording as the detail line under it, so both exact strings are on screen. Same for expired / not-a-reviewer / approved.
4. **Frozen copy.** CLAUDE.md §3.4 says "Claim triggered — staking and trading halted at block N."; THEME.md §5.6 says "🪤 Trap sprung — trading halted at block N". Same approach: THEME.md wording as the headline, CLAUDE.md wording as the detail line.

## Renames (riskfi → scoobydao)

Per the team: frontend-owned names use `scoobydao`.

- Package name `scoobydao-web`; CLAUDE.md and `scripts/sync-contracts.sh` now point at `ScoobyDAO-contracts` / `ScoobyDAO-backend`.
- `.env.example`: `CONTRACTS_REPO_PATH=../ScoobyDAO-contracts` (CLAUDE.md §6 updated to match).
- localStorage key for sealed stakes: **`scoobydao:<chainId>:<claimId>:<account>`** (was `riskfi:` in CLAUDE.md §3.4).
- **Not renamed** (owned by the contracts repo; the UI must match the chain): revert string `RiskFi: claim frozen`, share token symbols `RF-<id>-FOR` / `RF-<id>-AGAINST`. INTERFACES.md is unchanged, since it is shared across all three repos and changes go through its change protocol.

## Missing pieces / placeholders

- No `riskfi-ui` project skill exists on this machine; only `frontend-design` was loaded.

## Dependency decisions

- **wagmi pinned to 2.x** (2.19.x): RainbowKit 2.2.11 peer-depends on `wagmi ^2.9.0`; wagmi 3.x is not supported yet.
- **`@coinbase/cdp-sdk` aliased to a stub** (`src/stubs/cdp-sdk.ts`, via `turbopack.resolveAlias` in `next.config.ts`). The RainbowKit barrel imports wagmi's `baseAccount` connector → `@base-org/account` → `@coinbase/cdp-sdk`, which imports optional `@x402/*` packages that aren't installed, so `next build` failed. `@base-org/account` only uses `CdpClient` for Base subscription payments, which we never use. Remove the alias if a future RainbowKit/wagmi release fixes this.
- Wallet list is explicit (MetaMask, Rabby, WalletConnect, injected) via `connectorsForWallets`.
- Next 16 removed `next lint`; `npm run lint` runs the ESLint CLI with `eslint-config-next` flat config.
