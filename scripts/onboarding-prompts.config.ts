/**
 * Phase 7A.8 CP1 — prompt config for the fal.ai onboarding asset
 * generation pipeline. Edit any entry and re-run
 * `npm run gen-assets [-- --only=<id>]` to iterate.
 *
 * Conventions:
 * - `id` matches the output filename minus `.png`. Used as the
 *   `--only` flag value for single-asset re-generation.
 * - `seed` is locked per asset for reproducibility. Keep the seed
 *   constant when iterating wording (small edits should produce
 *   the same composition with the requested changes). Change the
 *   seed for a deliberate full re-roll.
 * - `prompt` follows the brand brief in the CP1 spec: dark,
 *   mysterious, refined; cinematic chiaroscuro; deep violet +
 *   navy palette; single focal point; generous negative space;
 *   no text, no people, no cartoon, no stock-onboarding look.
 *
 * **Critical lesson — round 1**: Flux Pro 1.1 Ultra IGNORES
 * `negative_prompt` at the API level (verified in the typed
 * schema — `@fal-ai/client/src/types/endpoints.d.ts`
 * `FluxProV11UltraInput` has no `negative_prompt` field). All
 * exclusions must live in the POSITIVE prompt as imagery —
 * never name a text-suggesting noun ("calendar," "cipher,"
 * "glyphs," "watch face with numerals") because the model will
 * render the named thing literally including its expected text
 * content. The seed-142+ prompts below were rewritten under
 * this constraint after round 1's text leaks.
 *
 * `negativePrompt` is preserved per-entry for provenance only.
 * If a future model swap accepts the field (e.g., Flux Pro V1,
 * SD3.5, image-to-image variants), the curation work is ready.
 */
export interface OnboardingPromptConfig {
  /** Asset id — matches filename without `.png` extension. */
  readonly id: string;
  /** Generation prompt (Flux Pro 1.1 Ultra). */
  readonly prompt: string;
  /**
   * Provenance only — Flux Pro 1.1 Ultra ignores this field at
   * the API level. Kept so a future model swap doesn't lose
   * the curation work.
   */
  readonly negativePrompt: string;
  /** Seed for reproducibility. */
  readonly seed: number;
  /** Output filename written to `assets/onboarding/`. */
  readonly outputFilename: string;
  /** Describes the consumer (CP2 / CP4) for ATTRIBUTION.md. */
  readonly consumer: string;
}

export const ONBOARDING_PROMPTS: readonly OnboardingPromptConfig[] = [
  {
    id: 'hero-pure-deduction',
    consumer: 'CP2 onboarding hero slide — symbol of pure logical deduction',
    seed: 142,
    outputFilename: 'hero-pure-deduction.png',
    prompt:
      'A single luminous geometric orb suspended in deep cosmic ' +
      'darkness, composed of nested transparent concentric spheres ' +
      'with smooth flowing radial striations, soft violet light ' +
      'emanating from the core outward, dramatic chiaroscuro from ' +
      'an unseen overhead source, deep navy void background with ' +
      'faint nebula texture below, premium mysterious refined ' +
      'aesthetic, hyperdetailed crystalline mechanical precision, ' +
      'single focal point centered upper third of frame, depth of ' +
      'field with subtle bloom, vast empty negative space below, ' +
      'no isometric perspective — straight-on or slightly elevated ' +
      'camera angle',
    negativePrompt:
      'text, words, letters, watermark, signature, people, faces, ' +
      'hands, cartoon, childish, isometric, flat design, generic ' +
      'gradient, stock illustration, tech startup vibes, multiple ' +
      'subjects, busy composition, bright saturated colors, daylight',
  },
  {
    id: 'teaser-blitz',
    consumer: 'CP4 BlitzTeaser modal hero — speed, urgency, race against the clock',
    seed: 143,
    outputFilename: 'teaser-blitz.png',
    prompt:
      'A streamlined chrome mechanical sphere fracturing into ' +
      'streaks of violet light, jagged shards trailing motion blur, ' +
      'no surface details no markings smooth polished metal, ' +
      'suspended in deep indigo void with diagonal light streaks ' +
      'crossing the composition, dramatic cinematic side lighting ' +
      'from the right, premium mysterious refined aesthetic, ' +
      'single focal point centered, generous negative space, sense ' +
      'of urgent precision and shattering momentum, hyperdetailed ' +
      'crystalline metallic surfaces, subtle gold accent edge ' +
      'highlights on the chrome, no text no numerals no faces',
    negativePrompt:
      'text, words, numerals on watch face, watermark, signature, ' +
      'people, faces, cartoon, childish, isometric, flat design, ' +
      'stock illustration, multiple subjects, busy composition, ' +
      'bright saturated colors, red alarm, panic',
  },
  {
    id: 'teaser-mirror',
    consumer: 'CP4 MirrorTeaser modal hero — race against rival, parallel pursuit',
    seed: 144,
    outputFilename: 'teaser-mirror.png',
    prompt:
      'Two identical luminous metallic discs floating in deep ' +
      'cosmic darkness facing each other across a void, smooth ' +
      'unmarked polished surfaces with flowing concentric ridges, ' +
      'soft violet glow radiating from both with one slightly ' +
      'brighter than the other suggesting asymmetric advantage, ' +
      'dramatic cinematic side lighting from above-left, premium ' +
      'mysterious refined aesthetic, symmetric composition with ' +
      'focal tension in the dark gap between the discs, generous ' +
      'negative space surrounding, hyperdetailed crystalline ' +
      'mechanical precision in the metal, deep navy backdrop with ' +
      'subtle nebula glow, no surface text no engravings no markings',
    negativePrompt:
      'text, words, letters, watermark, signature, people, faces, ' +
      'cartoon, childish, isometric, flat design, stock illustration, ' +
      'identical perfect mirror, bright saturated colors, daylight, ' +
      'racing imagery, cars, runners',
  },
  {
    id: 'modal-notification',
    consumer: 'CP4 NotificationOptIn modal hero — daily ritual, cyclical anticipation',
    seed: 145,
    outputFilename: 'modal-notification.png',
    prompt:
      'A single crystalline shard hovering in deep cosmic darkness, ' +
      'multifaceted dark glass with one facet glowing softly with ' +
      'inner violet light suggesting a moment of revelation, sharp ' +
      'elegant geometry asymmetric crystal structure, premium ' +
      'mysterious refined aesthetic, dramatic cinematic underlighting ' +
      'from below casting subtle bloom upward, deep navy void with ' +
      'faint distant nebula patterns surrounding the shard, single ' +
      'focal point centered, generous negative space, hyperdetailed ' +
      'crystalline refraction and internal light scattering, subtle ' +
      'gold edge highlight on the brightest facet, sense of quiet ' +
      'discovery and quiet anticipation, no text no symbols',
    negativePrompt:
      'text, words, letters, dates, numerals, watermark, signature, ' +
      'people, faces, cartoon, childish, isometric, flat calendar ' +
      'grid, stock illustration, bright saturated colors, daylight, ' +
      'multiple subjects',
  },
];
