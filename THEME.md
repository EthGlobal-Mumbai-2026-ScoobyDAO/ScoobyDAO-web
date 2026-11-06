# Theme & Frontend Generation Spec — "Unmask the Rug"

> For the `riskfi-web` repo. Read alongside `CLAUDE.md` and `INTERFACES.md`. This file defines the brand, visual system, 3D plan, every page and component, and ready-to-paste prompts for the tools that generate them.

---

## 0. Ground rules

1. You can use Scooby-Doo (or any other studio's) character, name, catchphrase, vehicle, logo or likeness — in the 3D model, illustrations, copy, favicon or domain.
2. **Demo first, spectacle second.** The 3D layer must never block the demo path (report → approve → stake → trigger → redeem). Every 3D scene has a 2D fallback.
3. **36-hour budget.** One hero 3D scene + small motion touches. No bespoke 3D on every page.
4. **Accessibility.** `prefers-reduced-motion` turns off 3D motion and parallax; all status is conveyed by text + icon, not color alone; contrast ≥ 4.5:1.

---

## 1. Brand

### 1.1 Name (pick one; check domain + ETHGlobal showcase for clashes)

| Name                 | Why                                                  |
| -------------------- | ---------------------------------------------------- |
| **Unmasked**         | The core action: unmask the scammer behind the token |
| **SniffDAO**         | A detective hound that sniffs out rugs               |
| **HoundDAO**         | Short, memorable, dog-detective                      |
| **Sleuth**           | Mystery, investigation, neutral                      |
| **RiskFi** (current) | Keep if you want the plain-finance angle             |

The rest of this file uses **Unmasked** with mascot **Sniff**. Swap freely.

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
  --clue-500: #2ec4b6; /* teal: Sniff's coat, success, "For" side */
  --mask-500: #e4572e; /* villain orange-red: danger, "Against" side, frozen */
  --ghost-300: #b8a9ff; /* lavender: pending / awaiting approval */
  --paper-50: #f6f1e3; /* evidence-file paper for light surfaces */
}
```

Light theme: swap background to `--paper-50`, text to `--night-900`, keep accents.

### 2.3 Status colors (always with icon + label)

| Status            | Color      | Icon          | Label                |
| ----------------- | ---------- | ------------- | -------------------- |
| Draft             | fog        | 📁 file       | Case file            |
| Awaiting approval | ghost      | 🔍 magnifier  | Awaiting a human     |
| Denied / Expired  | fog (dim)  | 🚫 / ⏳       | No case opened       |
| Open              | clue teal  | 🔦 flashlight | Case open            |
| Frozen            | mask red   | 🪤 trap       | Trap sprung — frozen |
| Resolved Pass     | beam amber | 🎭 mask off   | Unmasked             |
| Resolved Fail     | fog-100    | ✅            | Cleared              |
| Refunded          | fog        | ↩︎             | Refunded             |

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

### 5.1 Landing `/` (new)

- 3D hero (§3.1) with headline "Every rug has a villain behind the mask." and CTAs **Browse cases** / **How it works**.
- Live stats strip: cases open, USDC staked, cases unmasked, cases cleared (from backend).
- "How it works" scroll diorama, 4 steps:
  1. **Sniff finds a clue** — agents run checkable tests (e.g. "a normal wallet can't sell").
  2. **A human signs off** — World ID Agent Pass; no agent can accuse alone.
  3. **The case opens** — stake For/Against with sealed bets; scammer-linked wallets are blocked.
  4. **The trap springs** — the moment a claim triggers, staking and trading freeze; winners redeem.
- Trust section: "What we can't do" — no AI-only accusations, no betting after the answer is known, no betting on your own rug.
- Sponsor/credits strip (World, Uniswap, others actually used).
- Footer: GitHub repos, contract addresses, disclaimer ("testnet demo; not available where prohibited").

### 5.2 Case board `/cases` (was "Reports list")

- Corkboard-style grid of case cards with pinned photos (token icon/identicon), red string connecting related cases (stretch).
- Filters: status, claim type; search by token address.
- Each card: token, claim type chip, status chip (§2.3), stakes, odds bar, time left.
- Demo button "Send Sniff to scan" (`POST /demo/scan`, demo mode only) → Sniff 2D "sniffing" loader.

### 5.3 Case file `/cases/[id]` (was report detail)

- Paper "case file" layout: claims as typed index cards, evidence with stamps, the LLM summary clearly labelled "Sniff's notes (AI-written; not the verdict)".
- Manifest JSON viewer + **Recompute hash** button (✓ match / ✗ mismatch).
- Excluded-wallet list ("Suspects barred from betting").
- CTA "Request a human sign-off" → `/approve/[approvalId]`.

### 5.4 Sign-off `/approve/[id]` (World demo screen — keep it plain and fast)

- No 3D. Large type for the projector.
- Shows token + chain, exact claim text, manifest hash, user code, QR / button to World App, countdown.
- States: approved → "Case opened" + tx link; denied → "Denied — no case opened"; expired → "Expired — no case opened"; not a reviewer → "Not a registered reviewer — nothing published".
- Note: "World App shows only the requester and this code. Check the claim above before approving."

### 5.5 Stake `/case/[claimId]/stake`

- Case header with status, countdown, trigger tx if frozen.
- Excluded-wallet banner if the connected wallet is barred.
- Sealed commit form (side, amount) with "Your side stays sealed until reveal" tooltip; salt saved locally + **Download backup**.
- Reveal / Redeem buttons; payout preview with the exact formula.
- Totals + odds bar (teal For vs red Against).
- On Resolved Pass → small 3D/Lottie "mask pops off" + confetti; on Cleared → Sniff shrugs (2D).

### 5.6 Market `/case/[claimId]/market`

- Swap For↔USDC and Against↔USDC via the v4 router.
- Price chart of implied probability (simple line; stretch).
- Frozen state: inputs disabled, big "🪤 Trap sprung — trading halted at block N"; if a forced tx is sent, show the revert reason.

### 5.7 My cases `/me` (stretch)

- Wallet's commits (sealed/revealed), share balances, redeemable payouts, backup files reminder.

### 5.8 Global UI

- Top bar: logo (Sniff head + wordmark), Cases, How it works, network badge (Sepolia), wallet button.
- Toasts for every tx: pending → confirmed with explorer link → failed with reason.
- Empty states with Sniff poses (no cases yet: Sniff asleep; error: Sniff confused).
- 404: "This case went cold."
- Loading: flashlight sweep skeletons.
- Mobile layout for all pages except the market chart (simplified).

---

## 6. Component inventory

`Logo`, `NavBar`, `WalletButton`, `NetworkBadge`, `HeroScene3D` (+ `HeroParallaxFallback`), `HowItWorksScroll`, `StatsStrip`, `CaseCard`, `StatusChip`, `ClaimIndexCard`, `EvidenceStamp`, `ManifestViewer`, `HashCheck`, `SuspectList`, `ApprovalPanel`, `Countdown`, `QrCode`, `CommitForm`, `RevealButton`, `RedeemPanel`, `PayoutPreview`, `OddsBar`, `SwapPanel`, `FrozenBanner`, `TxToast`, `TxLink`, `MaskPop3D` (+ Lottie fallback), `SniffPose` (SVG/PNG by pose), `FlashlightCursor`, `GrainOverlay`, `EmptyState`.

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
#FFC857 for primary actions, teal #2EC4B6 for the "For" side and success, red-orange
#E4572E for the "Against" side, danger and frozen states, lavender #B8A9FF for pending.
Display font Bungee for headings, Inter for body, JetBrains Mono for numbers and hashes.
Add a subtle film-grain overlay and glassmorphism cards over a foggy background.
Respect prefers-reduced-motion. All mascot art must be ORIGINAL — no existing cartoon
characters, names or catchphrases.

Pages:
1. "/" landing: 3D hero canvas (placeholder box where a .glb of Sniff will load, with a
   spotlight "flashlight" that follows the pointer; parallax PNG fallback when WebGL is
   unavailable or reduced motion is on), headline "Every rug has a villain behind the
   mask.", CTAs, live stats strip, a 4-step scroll section (Sniff finds a clue → a human
   signs off → the case opens → the trap springs), a "What we can't do" trust section, footer.
2. "/cases": corkboard grid of case cards with status chips, odds bar, filters, search,
   and a demo "Send Sniff to scan" button.
3. "/cases/[id]": paper case-file layout with claim index cards, evidence with stamps,
   AI notes clearly labelled as not the verdict, manifest JSON viewer with a "Recompute
   hash" check, list of barred wallets, and a "Request a human sign-off" button.
4. "/approve/[id]": plain, large-type screen for a projector (no 3D): token, chain, exact
   claim text, manifest hash, user code, QR code, countdown, and result states for
   approved / denied / expired / not-a-reviewer.
5. "/case/[claimId]/stake": sealed commit form (side + amount), reveal and redeem buttons,
   payout preview, totals, odds bar, barred-wallet banner, frozen banner, and a celebratory
   "mask pops off" animation when the case resolves.
6. "/case/[claimId]/market": swap panel for For/Against shares vs USDC, disabled with a
   "Trap sprung — trading halted" banner when frozen.
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
| P1       | `/case/[claimId]/market` + frozen state                                   | 3                      |
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
- [ ] Frozen state visible on stake and market pages
- [ ] Lighthouse performance ≥ 80 on landing; .glb < 3 MB
