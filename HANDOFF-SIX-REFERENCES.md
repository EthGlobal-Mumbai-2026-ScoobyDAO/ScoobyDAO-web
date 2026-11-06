# WIP handoff: six-reference local reader

This branch is for code review and transfer only. It contains no report bundles, seed ZIP, captured source files, World credentials or API keys. Do not deploy this branch or merge it as-is; `vercel.json` disables automatic deployment for this WIP branch only.

The local `/reference-preview` uses an explicitly enabled `NEXT_PUBLIC_LOCAL_REFERENCE_PREVIEW=true`, a loopback browser and the separate read-only, loopback-only `127.0.0.1:60990` preview service. That service and its report data are not included here. It must never be exposed publicly: it serves unreviewed historical reference data without authentication. The reader validates report identity, report SHA-256 and available sidecar/evidence hashes; its data service retains the original source files. The SHIB reference and five selected examples use historical replay and synthetic lineage; no real World approval or live gate is implied.

## Production integration (not implemented here)

- Rebase onto current main, review the whole diff and resolve conflicts while preserving existing market and per-report administrator workflows. This branch also includes earlier scouting/integration work from PR #6; do not merge it wholesale without review.
- Replace the loopback-only reference transport with a deliberately designed server-backed reader for the bounded seeded case/report associations. Pending drafts must remain behind backend-enforced authorized access; anonymous distribution requires a separate explicitly approved release policy. Never proxy or publish the unauthenticated preview service.
- Preserve exact candidate/case/report version and digest binding; verify evidence and asset hashes. Retain visible historical, unreviewed, synthetic-lineage and model-limitation labels; never claim the 2026 VAE tested unrelated historical incidents. Suppress expired or unverified activity results.
- This deliverable is display-only: do not start scouting, investigations, model/provider calls or onchain operations from the reader. Publication/admin approval remains a distinct existing workflow.
- Configure only trusted service origins and server-side access controls, test CORS, scoped authorization, private drafts, mobile/desktop layout, charts and stale/empty/error states. Use separate secret management; no credentials in browser variables. Seed ZIP and reviewed data must be supplied separately by their owner.
- Before an eventual authorized merge, remove the branch-specific Vercel block after the deployment configuration and security review are complete.
