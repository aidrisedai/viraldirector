# EdAI Design System

EdAI (EdAI Inc. / EdAI Venture Studio · edai.fun, Redmond WA) raises **Muslim teens as builders and founders** — combining AI, entrepreneurship, venture-building and Islamic values. Programs: the **EdAI Seattle Summit 2026** (Aug 29–30, University of Washington — the Summer Summit flagship), in-person community programs hosted by masjids/schools (**1-Day Founder Sprint, 2-Day Summit, 3-Day Builder Intensive**), online Builder/Founder cohorts, hackathons (EdAI Hacks) and accelerator/demo-day programs. Founder: Azeez Idris, PhD.

Audiences: Muslim teens (13–18) into AI/tech/entrepreneurship · their parents · masjids, Islamic schools & community partners · sponsors, investors, collaborators.

## Sources
- Google Drive folder given by the user: https://drive.google.com/drive/folders/189Tu10yb_f_7Hwga2unGcNrbBChKmKXf ("35. EdAI", Artesy Studio) → contains only `EDAI-The Proposal-SK-260620.pdf` (Artesy's rebrand proposal: scope = brand strategy, identity, collateral).
- Also found in the same Drive (Artesy Studio, shared with the founder): `EDAI-CreativeDirection-SK-260720.pdf` (text read), `EDAI-Final Deliverables Checklist-SK-260809` (read), `Logos/PNG` folder (brandmark PNGs — black copied; white derived from its alpha; "Antique White" variant not copied), merch mockups (not read — too large), `EDAI-Brand Concepts Design-SK-260804.pdf` (52 MB, not readable), BrandStrategy / BrandAudit / Workshop PDFs (not read).
- EdAI's own brand skills (`edai-logo`, `edai-summit-partnership`, `edai-community-proposal`) — source of the emerald #1FA67A, Libre Baskerville + Outfit, tagline, lockup and logo rules, and all Summit facts/tiers.
- **Not available:** the final Artesy Brand Guidelines / Brand Board PDF, font files, gradients, brand patterns, icon set, the black/white *wordmark* PNGs referenced by `edai-logo`.

## Index
- `styles.css` — entry; imports `tokens/{fonts,colors,typography,spacing,base}.css`
- `assets/logo/` — `edai-brandmark-black.png`, `edai-brandmark-white.png`
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand)
- `components/` — React primitives (see below), one `*.card.html` per folder
- `ui_kits/summit-partnership/` — 5-page partnership proposal click-through
- `thumbnail.html`, `SKILL.md`

## Components
- core: **Button**, **IconButton**, **Badge**, **Eyebrow**, **Card**, **Icon**
- forms: **Input**, **Select**, **Checkbox**, **Radio**, **Switch**
- navigation: **NavBar**, **Tabs**
- feedback: **Dialog**, **Toast**, **Tooltip**
- brand: **Logo**, **LogoPanel**, **SummitLockup**, **Tagline**, **StatBlock**, **StageStrip**, **NextActionBar**

No source defined a component inventory (no product codebase/Figma), so this is a standard set sized to EdAI's real surfaces (proposals, event pages, registration). Intentional additions: **Icon** (Lucide wrapper — Artesy icon set not exported), **StatBlock / StageStrip / NextActionBar** (named proposal patterns in `edai-community-proposal`), **LogoPanel / SummitLockup / Tagline** (codify `edai-logo` rules).

## CONTENT FUNDAMENTALS
- **Voice:** warm, confident, specific, mission-driven. Trusted enough for parents and masjid boards; ambitious enough for teens. Never corporate-cold, childish, loud, or salesy.
- **Building over learning.** Say *build, launch, ship, founders, builders, problem, user, test, present* — not *classes, lessons, students learn*. ("Students build a working product in two days.")
- **Faith is the foundation, not the aesthetic.** Values (ihsan, amanah, service) come through in substance; no decorative religious clichés. "Assalamu alaikum" only where appropriate to the recipient.
- **Person:** "we/EdAI" to "you/your community". Direct address, short sentences.
- **Casing:** Sentence case for headlines and buttons ("Register now", "Partner with us"). UPPERCASE only for tracked eyebrows and the "SUMMER SUMMIT" lockup. Brand name always **EdAI** (lowercase d).
- **Exact tagline:** "Raising Principled and Ambitious Teens as Builders and Founders" — never paraphrased.
- **Core line:** "Together, we can help young people move from consuming technology to creating value with it."
- **Journey (always this order):** Discover a meaningful problem → understand a specific user → build → test → present.
- **Honesty rules:** never invent attendance, partners, outcomes or stats; goals are labelled goals ("100–200 student goal"). One specific next action with an owner and a date ends every proposal ("Reply 'Yes, let's partner'").
- **Avoid:** "synergy", "exposure", unsupported superlatives, desperate fundraising tone, walls of text. **No emoji.**

## VISUAL FOUNDATIONS
- **Colour:** black, white, warm cream and one accent — emerald `#1FA67A`. Emerald is used sparingly: primary CTA, short rules, progress, stat highlights. No other accent hues. Light materials: cream `#F4EEE3` page / white cards. Dark materials (proposals, event graphics): black `#0B0B0A` page / `#121211` cards / `#262623` hairlines.
- **Type:** Libre Baskerville (regular weight, occasional italic) for editorial headlines and big numbers; Outfit for everything else — body, labels, CTAs, tagline. Eyebrows are Outfit 600, 12px, 0.16em tracking, uppercase, emerald. Headlines tight (1.05–1.15), body 1.55.
- **Layout:** editorial, generous whitespace, architectural spacing on a 4-based scale (24/32/48 most used). Logo top-left by default (centred only on formal covers). Tagline bottom-centre. Content is left-aligned; grids of 2–4 equal columns.
- **Backgrounds:** flat solid black or cream. No gradients in UI (Artesy lists a "Gradients" deliverable — not yet received). Photography sits in full-bleed or rounded frames; logo on photos always inside a protection panel.
- **Cards:** flat, 1px hairline border, 16px radius, no shadow at rest; optional short emerald rule on the lower-left edge (the one brand ornament — never a full coloured border or left-border accent).
- **Corners:** soft — 6 (checkbox), 10 (inputs), 16 (cards/panels), 24 (dialogs); buttons & badges are full pills.
- **Shadows:** almost none. `shadow-md` only for interactive-card hover; `shadow-lg` for dialogs/toasts.
- **Hover:** primary darkens one step (emerald-600), outline/ghost gain a 4–8% ink/white wash, cards lift 2px + shadow-md. **Press:** emerald-700 + scale(.98). **Focus:** emerald border + 3px 35% emerald ring.
- **Motion:** quiet — 120–200ms, cubic-bezier(.2,0,0,1), fades/colour/small translate. No bounces, no parallax.
- **Transparency/blur:** only the modal scrim (black 55%). No glassmorphism.
- **Imagery:** real students building, warm and authentic; not stock classrooms. (No brand photography received — use placeholders.)
- **Brandmark:** four-point star above an open arch/book form. Black on light, white on dark; never recolor, outline, shadow, stretch or pattern it.

## ICONOGRAPHY
- Artesy's final deliverables include an "Icons Set (AI/PNG)" — **not accessible yet**. Substitute: **Lucide** (1.5–2px stroke, rounded caps), loaded per-icon from `unpkg.com/lucide-static@0.460.0` via the `Icon` component (CSS mask → inherits `currentColor`). Flagged substitution.
- Icons are functional (UI, card headers at 22px in emerald-400 on dark), never decorative clusters. No emoji, no unicode-glyph icons. Checkmarks in lists use Lucide `check` in emerald.

## Fonts
Loaded from Google Fonts (Libre Baskerville 400/700/italic, Outfit 300–700). Artesy's Fonts folder was empty/unreadable — **please supply the licensed files** if the final identity uses different faces.

## Caveats
- Creative Direction presented 3 routes (Venture Builder: Space Grotesk/Inter, dark green+lime; Creator OS: Manrope; Faithful Future: General Sans/DM Sans, teal/tangerine/moss). The chosen route and final palette are unknown; this system follows the `edai-logo` skill (emerald/black/cream, Baskerville + Outfit) plus the new Artesy brandmark.
- `--antique-white` / `--seashell` are inferred from Artesy file names (CSS named-colour values) — confirm hexes.
