# Onboarding asset provenance

Generated via the Phase 7A.8 CP1 asset pipeline. Re-run
`npm run gen-assets` (full) or `npm run gen-assets -- --only=<id>`
(single asset) to regenerate.

## Pipeline

- Model: **Flux Pro 1.1 Ultra** via [fal.ai](https://fal.ai)
- Endpoint id: `fal-ai/flux-pro/v1.1-ultra`
- Cost: ≈ $0.06 per image
- Aspect ratio: 1:1
- Format: PNG
- Last full run: 2026-05-12T13:26:35.699Z

## Iteration workflow

1. Edit the prompt or seed in `scripts/onboarding-prompts.config.ts`.
2. Run `npm run gen-assets -- --only=<id>` to regenerate one asset
   without paying for the others.
3. Keep the seed constant when iterating wording (small edits should
   produce the same composition with the requested changes).
4. Change the seed for a full re-roll.
5. Re-running overwrites the existing PNG — commit before iterating
   if you want to keep history.

## Assets

### hero-pure-deduction.png

- **Consumer**: CP2 onboarding hero slide — symbol of pure logical deduction
- **Status**: generated at 2026-05-12T13:26:35.699Z
- **Seed (requested)**: 142
- **Output**: 3203.4 KB, 2048×2048

**Prompt**:

> A single luminous geometric orb suspended in deep cosmic darkness, composed of nested transparent concentric spheres with smooth flowing radial striations, soft violet light emanating from the core outward, dramatic chiaroscuro from an unseen overhead source, deep navy void background with faint nebula texture below, premium mysterious refined aesthetic, hyperdetailed crystalline mechanical precision, single focal point centered upper third of frame, depth of field with subtle bloom, vast empty negative space below, no isometric perspective — straight-on or slightly elevated camera angle

**Negative prompt** (provenance only — Flux Pro Ultra ignores this field):

> text, words, letters, watermark, signature, people, faces, hands, cartoon, childish, isometric, flat design, generic gradient, stock illustration, tech startup vibes, multiple subjects, busy composition, bright saturated colors, daylight

### teaser-blitz.png

- **Consumer**: CP4 BlitzTeaser modal hero — speed, urgency, race against the clock
- **Status**: generated at 2026-05-12T13:26:35.699Z
- **Seed (requested)**: 143
- **Output**: 5462.0 KB, 2048×2048

**Prompt**:

> A streamlined chrome mechanical sphere fracturing into streaks of violet light, jagged shards trailing motion blur, no surface details no markings smooth polished metal, suspended in deep indigo void with diagonal light streaks crossing the composition, dramatic cinematic side lighting from the right, premium mysterious refined aesthetic, single focal point centered, generous negative space, sense of urgent precision and shattering momentum, hyperdetailed crystalline metallic surfaces, subtle gold accent edge highlights on the chrome, no text no numerals no faces

**Negative prompt** (provenance only — Flux Pro Ultra ignores this field):

> text, words, numerals on watch face, watermark, signature, people, faces, cartoon, childish, isometric, flat design, stock illustration, multiple subjects, busy composition, bright saturated colors, red alarm, panic

### teaser-mirror.png

- **Consumer**: CP4 MirrorTeaser modal hero — race against rival, parallel pursuit
- **Status**: generated at 2026-05-12T13:26:35.699Z
- **Seed (requested)**: 144
- **Output**: 4600.7 KB, 2048×2048

**Prompt**:

> Two identical luminous metallic discs floating in deep cosmic darkness facing each other across a void, smooth unmarked polished surfaces with flowing concentric ridges, soft violet glow radiating from both with one slightly brighter than the other suggesting asymmetric advantage, dramatic cinematic side lighting from above-left, premium mysterious refined aesthetic, symmetric composition with focal tension in the dark gap between the discs, generous negative space surrounding, hyperdetailed crystalline mechanical precision in the metal, deep navy backdrop with subtle nebula glow, no surface text no engravings no markings

**Negative prompt** (provenance only — Flux Pro Ultra ignores this field):

> text, words, letters, watermark, signature, people, faces, cartoon, childish, isometric, flat design, stock illustration, identical perfect mirror, bright saturated colors, daylight, racing imagery, cars, runners

### modal-notification.png

- **Consumer**: CP4 NotificationOptIn modal hero — daily ritual, cyclical anticipation
- **Status**: generated at 2026-05-12T13:26:35.699Z
- **Seed (requested)**: 145
- **Output**: 2923.0 KB, 2048×2048

**Prompt**:

> A single crystalline shard hovering in deep cosmic darkness, multifaceted dark glass with one facet glowing softly with inner violet light suggesting a moment of revelation, sharp elegant geometry asymmetric crystal structure, premium mysterious refined aesthetic, dramatic cinematic underlighting from below casting subtle bloom upward, deep navy void with faint distant nebula patterns surrounding the shard, single focal point centered, generous negative space, hyperdetailed crystalline refraction and internal light scattering, subtle gold edge highlight on the brightest facet, sense of quiet discovery and quiet anticipation, no text no symbols

**Negative prompt** (provenance only — Flux Pro Ultra ignores this field):

> text, words, letters, dates, numerals, watermark, signature, people, faces, cartoon, childish, isometric, flat calendar grid, stock illustration, bright saturated colors, daylight, multiple subjects

## Iteration history

CP1 ran four iteration rounds before settling on the seed-142..145 Flux Pro 1.1 Ultra prompts above. The history is preserved here because (a) the residual brand-fit gap on `hero-pure-deduction` and `teaser-mirror` is real and queued for Phase 9 illustrator polish, and (b) future maintainers iterating on these assets should know which dead ends are already mapped.

- **Round 1 (Flux, seeds 42-45)**: every asset leaked text artifacts.
  Diagnosed: Flux Pro 1.1 Ultra ignores `negative_prompt` at the API
  level (typed schema has no field for it). Exclusion language must
  live in the positive prompt; never name a text-shaped noun.
- **Round 2 (Flux, seeds 142-145)**: prompts rewritten to avoid
  text-suggesting nouns. Text leaks fixed. Brand-acceptable on all
  four, with caveats: `hero` reads slightly speaker-iris-shaped;
  `teaser-mirror` reads slightly turntable-shaped; `teaser-blitz`
  + `modal-notification` land on-brief. **This round is the
  canonical CP1 deliverable.**
- **Round 3 (Flux, hero seed 242 + mirror seed 344)**: tried
  new metaphors — obsidian monolith for hero, crystal pillars for
  mirror. Both underperformed: the monolith read as a fantasy
  artifact with too-dramatic lightning veins; the pillars went too
  bright + sparkly (lost the dark refined tone). Discarded.
- **Round 4 (Recraft v3 with `digital_illustration/grain` style,
  all 4)**: explored a different model entirely. Recraft's style
  preset overrode the brand palette across the board (deep navy +
  violet → bright pastels, gold sparkles, twee aesthetic). All four
  outputs were palette-violating and tonally wrong. Discarded.

Net: ~$0.84 across all four rounds. Round 2 retained. `hero-pure-deduction` and `teaser-mirror` flagged in `docs/PHASE-9-BACKLOG.md` as candidates for a professional illustrator brief post-launch — AI prompting did not converge on the desired premium-refined aesthetic for those two specifically within the iteration budget.

---

See `scripts/onboarding-prompts.config.ts` for the source of truth — this file is regenerated on every successful run.
