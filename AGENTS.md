# Agent rules (Unmasked web)

Read `CLAUDE.md` first; it has the hard rules, routes and terms. In short:

- **Git is read-only for agents.** No `git add/commit/push/pull/fetch/branch/checkout/switch/stash/reset/rebase/merge/tag`, no `gh` writes, no attribution lines. Leave changes uncommitted for the human.
- No secrets; only `NEXT_PUBLIC_*`. No transactions to real networks from scripts or tests (tests use `src/test/mockRpc.ts` and `src/test/recorded/`).
- **V2 is the live default.** The V2 handoff bundle (`../v2`) is the source of truth for addresses, ABIs, pool key, selectors and report #1; sync it with `npm run sync:v2` (hash-checked), never hand-edit `src/contracts/v2/`. Key addresses by (chainId, name).
- Contracts only through `src/protocol`; V1 ABIs come from `npm run sync:contracts`, never hand-written. V2 calls must be declared in `src/protocol/v2contracts.ts` (`V2_USAGE`).
- Use the honesty labels in `src/components/HonestyLabels.tsx`. Brand is "Unmasked" + "Sniff".
- Record conflicts and assumptions in `NOTES.md`.
- Keep `npm run typecheck && npm run lint && npm test && npm run build` green.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
