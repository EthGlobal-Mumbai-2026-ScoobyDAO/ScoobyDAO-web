# Theme & Frontend Generation Spec — ScoobyDAO

> Revamp (Nov 2026): §2.3 and §5–§6 now describe the real product (report v0.2, Yes/No dUSD stakes, YT market, CCIP, settlement). Older wording elsewhere (prompts in §7) is historical. For the web repo. Read alongside `CLAUDE.md` and `INTERFACES.md`. This file defines the brand, visual system, 3D plan, every page and component, and ready-to-paste prompts for the tools that generate them.

---

## 0. Ground rules

1. **Original mascot only.** The mascot is Sniff, an original basset-hound detective. Never use any studio cartoon character, Great Dane, mystery van, catchphrase or likeness in the 3D model, illustrations, copy, favicon or domain, and never put "Scooby" inside an illustration. "ScoobyDAO" appears only as text (wordmark, titles, copy).
2. **Demo first, spectacle second.** The 3D layer must never block the demo path (report → approve → stake → trigger → redeem). Every 3D scene has a 2D fallback.
3. **36-hour budget.** One hero 3D scene + small motion touches. No bespoke 3D on every page.
4. **Accessibility.** `prefers-reduced-motion` turns off 3D motion and parallax; all status is conveyed by text + icon, not color alone; contrast ≥ 4.5:1.

---

## 1. Brand

### 1.1 Name

**Decided (Nov 2026): ScoobyDAO**, mascot **Sniff**. Tagline "Sniff out the rug before it pulls."; hero line "Every rug has a villain behind the mask."; pitch "AI agents investigate suspicious tokens. A World ID–verified human signs off. The market decides." Wordmark: SniffHead + "ScoobyDAO" in Bungee. "Unmasked!" survives only as the Final · Yes verdict moment. The table below is the original shortlist, kept for history.

| Name                 | Why                                                  |
| -------------------- | ---------------------------------------------------- |
| **Unmasked**         | The core action: unmask the scammer behind the token |
| **SniffDAO**         | A detective hound that sniffs out rugs               |
| **HoundDAO**         | Short, memorable, dog-detective                      |
| **Sleuth**           | Mystery, investigation, neutral                      |
| **RiskFi** (current) | Keep if you want the plain-finance angle             |

Older sections below say **Unmasked**; read it as ScoobyDAO. The layout and component rules are in §8 (component kit).

### 1.2 Story (one paragraph for the landing page)

> Every rug has a villain behind the mask. Sniff, our detective hound, and a pack of AI agents follow the evidence. When the clues add up, a verified human signs off, the case opens, and the market decides. And the villain? Wallets linked to the scammer can't place a bet on their own crime.

### 1.3 Mascot: Sniff (original)

- A **stocky basset-hound detective**: long ears, droopy eyes, a short tan-and-cream coat, a **teal trench coat**, a **brass magnifying glass** and a **pocket flashlight**.
- Personality: slow, stubborn, never misses a clue. Comedic but competent.
- Poses needed: idle (sniffing), thinking (paw on chin), alert (ears up, flashlight on), triumphant (holding a pulled-off mask), sad (case expired/denied).
- The "villain" is a faceless **hooded figure in a glossy token-shaped mask** — generic, not modeled on anyone.

### 1.4 Voice

Playful mystery-cartoon tone in headings, precise and plain in anything about money.

- ✅ "Case open — stake your verdict." / "Trading halted: the trap was sprung."
- ✅ Payout screens: exact numbers, no jokes.
- ❌ No catchphrases borrowed from existing cartoons.

---

## 2. Visual system

### 2.1 Mood

Vintage Saturday-morning mystery: a spooky-but-friendly night, flashlight beams cutting through fog, a haunted-mansion silhouette, retro grain. Meets modern DeFi: clean cards, crisp numbers.

### 2.2 Color tokens (CSS variables; dark is default)

```css
:root {
  --night-900: #0b1026; /* page background */
  --night-700: #151b3d; /* cards */
  --fog-400: #7a86b8; /* muted text, borders */
  --fog-100: #e8ecff; /* body text */
  --beam-400: #ffc857; /* flashlight amber: primary CTA, highlights */
  --clue-500: #2ec4b6; /* teal: Sniff's coat, success, "No" side */
  --mask-500: #e4572e; /* villain orange-red: danger, challenged */
  --ghost-300: #b8a9ff; /* lavender: pending / awaiting approval */
  --paper-50: #f6f1e3; /* evidence-file paper for light surfaces */
}
```

Light theme: swap background to `--paper-50`, text to `--night-900`, keep accents.

### 2.3 Status colors (always with icon + label)

| Status (phase)                       | Color      | Icon          | Label              |
| ------------------------------------ | ---------- | ------------- | ------------------ |
| Draft                                | fog        | 📁 file       | Draft              |
| Awaiting approval                    | ghost      | 🔍 magnifier  | Awaiting approval  |
| Denied                               | fog (dim)  | 🚫            | Denied             |
| Expired                              | fog (dim)  | ⏳            | Expired            |
| Open (before cross-chain cutoff)     | clue teal  | 🔦 flashlight | Open               |
| Open, local only (cutoff → lock)     | clue teal  | 🌐 globe      | Cross-chain closed |
| Locked (lock → maturity)             | ghost      | 🔒 lock       | Locked             |
| Matured (awaiting proposal)          | beam amber | ⏲ timer       | Matured            |
| Proposed (challenge window)          | beam amber | 📣 megaphone  | Proposed           |
| Challenged (adjudicator decides)     | mask red   | ⚔︎ swords      | Challenged         |
| Final · Yes                          | beam amber | 🎭 mask off   | Final · Yes        |
| Final · No                           | fog-100    | ✅            | Final · No         |
| Void                                 | fog        | ↩︎             | Void               |

Every chip ink passes 4.5:1 on its tint in both themes (`node scripts/contrast.mjs`).

### 2.4 Typography

- Display: a chunky retro-cartoon display face (e.g. **Bungee**, **Luckiest Guy** or **Chango** from Google Fonts) — headings only.
- Body: **Inter** or **DM Sans**.
- Numbers/hashes: **JetBrains Mono** with tabular figures.

### 2.5 Texture & depth (lightweight, non-3D)

- Film grain overlay (CSS `background-image` noise at 4–6% opacity).
- **Parallax night scene** on landing: sky → moon → mansion silhouette → fog layers → foreground trees (4–5 PNG/SVG layers).
- **Glassmorphism** cards over fog (blur 12px, 8% white fill, 1px border `--fog-400` at 30%).
- **Paper "case file"** look for evidence panels: off-white, paperclip icon, stamped labels ("EVIDENCE", "CLASSIFIED", "UNMASKED").
- **Flashlight cursor** on the hero: a radial gradient follows the pointer and reveals hidden clue text.

---

## 3. 3D plan

### 3.1 What gets 3D (and only this)

| Where                       | Scene                                                                              | Interaction                                                      |
| --------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Landing hero                | Sniff in a foggy mansion yard, flashlight beam sweeping                            | Pointer moves the beam; scroll pushes the camera toward the door |
| "How it works"              | Scroll-scrubbed 4-step diorama: clue found → human signs → case open → mask pulled | Scroll timeline (GSAP ScrollTrigger or drei `ScrollControls`)    |
| Resolve moment (claim page) | Small canvas: villain mask pops off with confetti when a claim resolves Pass       | Plays once on status change                                      |
| Everywhere else             | 2D only (illustrated Sniff poses as SVG/PNG)                                       | —                                                                |

### 3.2 Tech choice

**React Three Fiber + drei** inside Next.js (`"use client"` components, dynamically imported with `ssr: false`).

- Load one compressed **.glb** for Sniff (Draco/Meshopt, target < 3 MB) and one for the mask (< 500 KB).
- Animations: idle, sniff, alert, triumph baked into the .glb (from Mixamo-style rigging or the generator) and played via `useAnimations`.
- Lighting: one spotlight as the flashlight, dim ambient, volumetric-looking fog via `fog` + a cone mesh with additive blending.
- Post-processing (optional): bloom on the flashlight, vignette.
- **Fallback:** if WebGL is missing, the device is low-power (`navigator.hardwareConcurrency < 4`) or reduced motion is on → render the layered parallax PNG hero instead.

Alternative if the team has no 3D experience: build the hero in **Spline** and embed with `@splinetool/react-spline`. Faster, less control, heavier runtime.

### 3.3 Performance budget

- Landing LCP < 2.5s on a mid laptop; 3D canvas mounts after first paint.
- Total 3D assets < 5 MB; textures 1024px max, KTX2 if possible.
- Pause the render loop when the canvas is off-screen (`frameloop="demand"` + intersection observer).
- Never mount 3D on `/approve` (it's on the projector during the World demo; keep it instant).

---

## 4. Where to generate everything

Verify each tool's current plan/licence before relying on it; terms change.

| Need                            | Tools                                                                                                               | Notes                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Whole page UI from a prompt     | **v0** (Vercel), **Lovable**, **Bolt**, or **Claude Code** in this repo                                             | Use prompt §7.1; then wire to `INTERFACES.md` yourself                            |
| 3D mascot model from text/image | **Meshy**, **Tripo**, **Rodin (Hyper3D)**, **Luma Genie**                                                           | Generate from a 2D concept image for best consistency; check commercial-use terms |
| Rigging + animations            | **Mixamo** (auto-rig + stock animations), or **Blender**                                                            | Export .glb with clips named `idle`, `sniff`, `alert`, `triumph`                  |
| Compress .glb                   | **gltf-transform** CLI, **gltf.report**                                                                             | `gltf-transform optimize in.glb out.glb --compress draco --texture-compress webp` |
| No-code 3D scene                | **Spline**                                                                                                          | Embed via `@splinetool/react-spline`                                              |
| 2D mascot poses, concept art    | Any image generator, or an illustrator                                                                              | Same character sheet for every pose                                               |
| Parallax layers                 | Export from Figma, or generate then cut layers in Figma/Photopea                                                    | 4–5 transparent PNG/SVG layers                                                    |
| Icons                           | **Lucide** + a few custom SVGs (mask, trap, flashlight)                                                             |                                                                                   |
| Motion                          | **Framer Motion** (UI), **GSAP ScrollTrigger** or drei `ScrollControls` (scroll scenes), **Lottie** for small loops |                                                                                   |
| Fonts                           | Google Fonts                                                                                                        | Display face for headings only                                                    |

Do **not** pull character models from asset libraries (Sketchfab, TurboSquid, CGTrader) unless the licence allows commercial use and the model is original — many fan models of studio characters are infringing.

---

## 5. Pages & features (complete list)

### 5.1 Landing `/`

- 3D hero with headline "Every rug has a villain behind the mask." and CTAs **Browse cases** / **How it works**.
- Live stats strip: reports published, dUSD staked, YT traded (labelled "Demo data" in fixture mode).
- "How it works": the 8 real steps (research → human approval → publish → stake Yes/No → lock & YT → proposal at maturity → challenge & finalize → separate claims).
- "Built with" strip, text labels only: World (human approval), Chainlink CCIP (stake from another chain), Uniswap v4 (trade the yield).
- Trust section "What we can't do": no AI-only accusations, no hidden stakes (stakes are public onchain), no verdict by timer.
- Footer: neutral repo labels, V1 contract addresses, disclaimer ("dUSD — test token, not USDC").

### 5.2 Case board `/cases`

- Corkboard grid: backend reports merged with onchain published ids.
- Card: symbol + chain, assessment label, phase chip, Yes/No totals, time to the next deadline.
- Filters: phase, token chain; search by token, symbol, report id or #case.

### 5.3 Case file `/cases/[id]`

- Report v0.2: identity header, assessment (unknowns and counterevidence shown open), the claim card, five pillar cards with findings linked to evidence, evidence list, artifacts, limitations.
- Hash check: SHA-256 of the raw report bytes and of the canonical claim manifest, ✓/✗ vs backend and vs `ReportRegistry.getReport`.
- Side rail: onchain market summary, or draft state with **Request human approval**.

### 5.4 Sign-off `/approve/[id]` (World demo screen)

- No 3D. Large type. Report version, ClaimCard, claimHash and reportSha256, user code, QR of `verificationUriComplete ?? verificationUri`, countdown.
- States: approved → "Approved — publishing…"; spent → "Published onchain" + tx + case link; denied → "Denied — no case opened. Draft only, no market opened."; expired → "Expired — no case opened."; not a reviewer → "This World ID isn't an enrolled reviewer — nothing published."; error → "World verification unavailable — nothing published."
- "Demo identity: World Agent Pass" label when proofs are mocked.
- Note: "World App shows only the requester and this code. Check the claim above before approving."

### 5.5 Stake `/case/[id]/stake`

- Source: Ethereum Sepolia (direct) or Arbitrum Sepolia (via Chainlink CCIP, only before the cross-chain cutoff, with ETH fee quote).
- Yes/No picker → dUSD amount (max = balance) → TxPlan stepper (approve if needed, then stake). "Stakes are public onchain."
- Payout preview: if Yes wins / if No wins / if Void, with the 20%-of-losing-pool fee line.
- V2 only: "Keep my YT" / "Sell my YT now" with slippage.
- Test funds panel (no public faucet; `NEXT_PUBLIC_FAUCET_URL` or "Ask the team").

### 5.6 Market `/case/[id]/market`

- "Trade the interest earned on locked stakes. The YT price is not a prediction of the verdict."
- Buy/sell YT via the v4 hook router; price, implied APR and time to maturity, all "Simulated yield"; slippage → minOut; received amount from the `Swapped` event. Disabled states per reason ("Market not deployed yet", matured, …).

### 5.7 Result `/case/[id]/result`

- Settlement timeline, challenge form (SHA-256 evidence hash; "No bond is required; the adjudicator decides."), finalize ("Anyone can finalize — nothing happens automatically.").
- Three separate claim cards: redeem position, claim yield, REP badge.
- Mask-pop "Unmasked!" on Final · Yes; "Case closed — cleared." on No; "No verdict — stakes refunded." on Void.

### 5.8 Positions `/me` and CCIP tracker `/tx/ccip/[messageId]`

- `/me`: Yes/No positions, redeemable amounts, YT and claimable yield, LP shares, pending/held CCIP stakes, REP badges; one Claim button per item.
- Tracker: Sent → In transit (CCIP Explorer link) → Credited, or Held → Recover.

### 5.9 Global UI

- Top bar: logo, Cases, My positions, How it works, network badge (Sepolia / Arbitrum Sepolia), wallet.
- Fixture-mode banner on every page when data is simulated.
- Every write: TxPlan stepper, toast with Etherscan / Arbiscan link, decoded revert reason, wrong-chain prompt.
- Empty states with Sniff poses; 404 "This case went cold."; flashlight-sweep skeletons.

---

## 6. Component inventory

`Logo`, `NavBar`, `WalletButton`, `NetworkBadge`, `FixtureModeBanner`, `HonestyLabels`, `HeroScene3D` (+ `HeroParallaxFallback`), `HowItWorks`, `StatsStrip`, `BuiltWith`, `CaseCard`, `StatusChip`, `ReportViewer` (`IdentityHeader`, `AssessmentCard`, `PillarCard`, `EvidenceList`, `Artifacts`, `LimitationsNote`), `ClaimCard`, `HashCheck`, `HashText`, `Countdown`, `TxLink`, `TxPlanStepper`, `SidePicker`, `PayoutPreview`, `TotalsCard`, `OddsBar` (share of stakes), `GetTestFunds`, `CcipTracker`, `SettlementTimeline`, `ChallengeForm`, `FinalizeButton`, `RepCard`, `MaskPop` (+ 3D scene), `SniffPose`, `GrainOverlay`, `EmptyState`.

---

## 7. Copy-paste prompts

### 7.1 Frontend build prompt (v0 / Lovable / Claude Code)

```
Build the frontend for "Unmasked", a crypto app where AI agents and a detective-hound
mascot named Sniff investigate scam tokens, a verified human signs off, and users stake
on the verdict. Use Next.js App Router, TypeScript, Tailwind, wagmi + viem + RainbowKit,
TanStack Query, Framer Motion, and React Three Fiber + drei for one 3D hero only.

Theme: vintage Saturday-morning mystery at night meets clean DeFi. Dark navy background
(#0B1026), cards #151B3D, body text #E8ECFF, muted #7A86B8, amber flashlight accent
#FFC857 for primary actions and the "Yes" side, teal #2EC4B6 for the "No" side and success,
red-orange #E4572E for danger and challenged states, lavender #B8A9FF for pending.
Display font Bungee for headings, Inter for body, JetBrains Mono for numbers and hashes.
Add a subtle film-grain overlay and glassmorphism cards over a foggy background.
Respect prefers-reduced-motion. All mascot art must be ORIGINAL — no existing cartoon
characters, names or catchphrases.

Pages:
1. "/" landing: 3D hero canvas (placeholder box where a .glb of Sniff will load, with a
   spotlight "flashlight" that follows the pointer; parallax PNG fallback when WebGL is
   unavailable or reduced motion is on), headline "Every rug has a villain behind the
   mask.", CTAs, live stats strip, the 8-step "How it works" (see §5.1), a "Built with"
   strip, a "What we can't do" trust section, footer.
2. "/cases": corkboard grid of case cards with phase chips, share-of-stakes bar, filters, search.
3. "/cases/[id]": paper case-file layout rendering report v0.2 (assessment, unknowns,
   counterevidence, five pillars, evidence, limitations), the claim card, SHA-256 hash checks,
   and a "Request human approval" button.
4. "/approve/[id]": plain, large-type screen for a projector (no 3D): report, claim card,
   claim hash and report SHA-256, user code, QR code, countdown, and result states (§5.4).
5. "/case/[id]/stake": Yes/No stake in dUSD (direct or via Chainlink CCIP), payout preview,
   totals, share-of-stakes bar, TxPlan stepper.
6. "/case/[id]/market": buy/sell the yield token (YT) on the Uniswap v4 hook market;
   "The YT price is not a prediction of the verdict"; "Simulated yield" on every rate.
7. "/case/[id]/result": settlement timeline, challenge, finalize, three separate claims and
   the "mask pops off" animation on Final · Yes.
Global: navbar with logo, Sepolia badge, wallet button; tx toasts with explorer links;
empty, loading and 404 states using mascot poses.

Use mock data that matches the TypeScript types in INTERFACES.md (Report, Approval,
ClaimView). Put all API calls in src/lib/api.ts and all colors in CSS variables.
```

### 7.2 Mascot concept image prompt (2D, for the character sheet)

```
Original cartoon mascot character sheet: "Sniff", a stocky basset hound detective with
long floppy ears and droopy, kind eyes, short tan-and-cream fur, wearing a teal trench
coat, holding a brass magnifying glass, a small flashlight clipped to the coat. Friendly,
slightly sleepy, clever. Front, three-quarter, side and back views plus five expressions
(sniffing, thinking, alert, triumphant, sad). Clean flat colors, thick outlines, retro
1970s animation style, neutral background. Original design, not based on any existing
cartoon character.
```

### 7.3 3D model prompt (Meshy / Tripo / Rodin — image-to-3D from 7.2 front view)

```
Stylized low-poly-to-mid-poly 3D cartoon basset hound detective, teal trench coat, brass
magnifying glass in right paw, small flashlight on coat, T-pose for rigging, clean
topology, PBR textures, game-ready, under 30k triangles, original character.
```

Then: auto-rig in Mixamo → add idle / sniff / alert / triumph clips → export .glb → compress with gltf-transform (§4).

### 7.4 Villain mask prop prompt

```
Glossy stylized theatrical mask shaped like a gold crypto coin with a sinister grin,
cartoon style, single object, PBR, under 5k triangles.
```

### 7.5 Parallax background prompt

```
Wide 21:9 night scene, cartoon retro style: deep navy sky, big pale moon, spooky but
friendly old mansion silhouette on a hill, bare trees, rolling fog, warm amber light in
one window. Flat layered shapes so it can be split into 5 parallax layers.
Original artwork.
```

---

## 8. Build order (inside the 36 hours)

| Priority | Task                                                                      | Owner hours            |
| -------- | ------------------------------------------------------------------------- | ---------------------- |
| P0       | Design tokens, fonts, layout, navbar, status chips                        | 2                      |
| P0       | `/approve/[id]` and `/case/[claimId]/stake` fully working (demo-critical) | 6                      |
| P0       | `/cases` and `/cases/[id]`                                                | 4                      |
| P1       | `/case/[id]/market` (YT) + `/case/[id]/result`                            | 3                      |
| P1       | Landing with **parallax fallback** hero + how-it-works (2D)               | 3                      |
| P2       | Mascot 2D poses (concept → cut PNGs)                                      | 2 (parallel, designer) |
| P2       | 3D Sniff .glb + R3F hero (swap in over the fallback)                      | 4 (parallel)           |
| P3       | Mask-pop 3D/Lottie, flashlight cursor, corkboard string, `/me`            | leftover time          |

Rule: if the 3D hero isn't stable by Saturday 6 pm, ship the parallax hero and stop.

---

## 9. Pre-demo checklist

- [ ] No studio character, name or catchphrase anywhere (assets, copy, metadata, favicon)
- [ ] Generated assets' licences allow commercial/public use; credits in README
- [ ] 3D fallback tested with WebGL disabled and with reduced motion on
- [ ] `/approve` loads instantly, readable from the back of the room
- [ ] Every tx shows pending → confirmed → explorer link
- [ ] Phase-closed states visible on stake, market and result pages (with reasons)
- [ ] Lighthouse performance ≥ 80 on landing; .glb < 3 MB


## 8. Component kit and layout rules (rebrand, Nov 2026)

- **Kit:** `src/components/ui/` — `PageHeader`, `Section`, `Card` (default · paper · highlight), `StatTile`, `KeyValue`, `Tabs`, `SegmentedControl`, `Disclosure`, `InfoTip`, `HonestyChips`, `TechnicalDetails`, `EmptyState`/`ErrorState`, `LoadState`, `Stepper`, `MobileNav`, `WorldConfirm`. Pages compose these; don't hand-roll headers, popovers or drawers.
- **Container:** max-width 1200px, 24px gutters (16px under 640px), via `Page` / `PageHeader`.
- **Type:** Bungee only for page titles and big numbers; section headings Inter semibold. Page title 40–56px, section 22–24px, card title 18px, body 15–16px, meta 13px; body lines ≤ 68ch.
- **Spacing:** 8px grid; card padding 20–24px; 24–32px between cards.
- **Copy:** a title plus one sentence per page, a title plus at most two lines per card. Details go in `Disclosure`, `InfoTip` or `TechnicalDetails`.
- **Honesty facts:** once per screen, through `HonestyChips` (chip + info popover). Contract names, hashes, roles and the deployment check live in `TechnicalDetails`.
- **Data cards:** wrap queries in `LoadState` (skeleton → "Still loading…" at 8s → `ErrorState` with Retry and the source name at 20s or on error).
- **Sniff poses have jobs:** sniffing = loading, thinking = empty, alert = action needed, triumphant = success, sad = denied/expired, shrug = unavailable.
