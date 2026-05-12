#!/usr/bin/env tsx
/**
 * Phase 7A.8 CP1 — fal.ai asset generation pipeline.
 *
 * Run via `npm run gen-assets` (regenerates every asset in
 * `scripts/onboarding-prompts.config.ts`) or
 * `npm run gen-assets -- --only=<id>` to regenerate a single
 * asset (cost-efficient iteration).
 *
 * Build-time only. Not imported by app code. Runs under tsx
 * directly so there is no compile step; the project's tsconfig
 * `include` covers this directory so `npm run typecheck` checks
 * it as part of the regular type-check pass.
 *
 * Model: Flux Pro 1.1 Ultra at ≈ $0.06 per image. Four assets
 * = ~$0.24 per full run. Script logs per-asset + total cost.
 *
 * Reproducibility: each prompt carries a locked `seed`. Re-runs
 * with the same seed reproduce the same composition modulo Flux
 * model drift. Iteration protocol:
 *   - keep seed constant for incremental prompt edits
 *   - change seed for a full re-roll
 *
 * Failure handling: each asset is generated independently. A
 * single failure logs an error and the script continues with
 * the remaining assets. Exit code reflects whether ANY asset
 * failed (so CI / wrappers can detect partial failures).
 *
 * Why Flux Pro 1.1 Ultra specifically: the CP1 iteration log
 * (see ATTRIBUTION.md → Iteration history) tested Recraft v3
 * as an alternative; Recraft's editorial-illustration default
 * palette overrode the brand brief (deep violet + navy →
 * bright pastels). Flux's photoreal-leaning output lands closer
 * to the brand voice even though it requires careful prompt
 * engineering to avoid literal-noun text leaks.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { fal } from '@fal-ai/client';
import dotenv from 'dotenv';

import {
  ONBOARDING_PROMPTS,
  type OnboardingPromptConfig,
} from './onboarding-prompts.config';

dotenv.config();

const FLUX_PRO_ULTRA_MODEL = 'fal-ai/flux-pro/v1.1-ultra';
const FLUX_PRO_ULTRA_COST_USD = 0.06;
const OUTPUT_DIR = path.resolve(__dirname, '..', 'assets', 'onboarding');
const ATTRIBUTION_PATH = path.join(OUTPUT_DIR, 'ATTRIBUTION.md');

// ─────────────────────────────────────────────────────────────
// CLI parsing — only flag is `--only=<id>` for single-asset
// re-generation. Anything else is reported as a usage error.
// ─────────────────────────────────────────────────────────────

interface CliArgs {
  readonly only: string | null;
}

function parseCliArgs(argv: readonly string[]): CliArgs {
  let only: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith('--only=')) {
      only = arg.slice('--only='.length);
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printUsageAndExit(0);
    }
    if (arg.startsWith('--')) {
      console.error(`Unknown flag: ${arg}`);
      printUsageAndExit(1);
    }
  }
  return { only };
}

function printUsageAndExit(code: number): never {
  const lines = [
    '',
    'Usage: npm run gen-assets [-- --only=<id>]',
    '',
    'Regenerates onboarding hero assets via fal.ai Flux Pro 1.1 Ultra.',
    '',
    'Options:',
    '  --only=<id>   Regenerate only the asset with the given id.',
    '                Valid ids: ' +
      ONBOARDING_PROMPTS.map((p) => p.id).join(', '),
    '  --help, -h    Show this message.',
    '',
    'Environment:',
    '  FAL_KEY       fal.ai API credential. Read from .env (root) or shell.',
    '',
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

// ─────────────────────────────────────────────────────────────
// Env validation — fail fast with actionable message.
// ─────────────────────────────────────────────────────────────

function validateEnv(): string {
  const raw = process.env.FAL_KEY;
  if (raw === undefined || raw === null) {
    console.error(
      '\nFAL_KEY is not set. Add `FAL_KEY=<your-key>` to .env at the\n' +
        'repo root (see https://fal.ai/dashboard/keys) and re-run.\n',
    );
    process.exit(1);
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    console.error('\nFAL_KEY is empty after trimming. Check .env for whitespace.\n');
    process.exit(1);
  }
  return trimmed;
}

// ─────────────────────────────────────────────────────────────
// fal.ai response shape — Flux Pro 1.1 Ultra returns an
// `images` array with `url`, `width`, `height`, `content_type`.
// We narrow at runtime rather than depend on the client's
// generic Output<T> type.
// ─────────────────────────────────────────────────────────────

interface FluxImageResult {
  readonly url: string;
  readonly width?: number;
  readonly height?: number;
  readonly content_type?: string;
}

interface FluxOutput {
  readonly images?: readonly FluxImageResult[];
  readonly seed?: number;
}

function isFluxOutput(data: unknown): data is FluxOutput {
  if (typeof data !== 'object' || data === null) return false;
  const out = data as Record<string, unknown>;
  if (!Array.isArray(out.images)) return false;
  if (out.images.length === 0) return false;
  const first = out.images[0] as Record<string, unknown> | undefined;
  return typeof first?.url === 'string';
}

// ─────────────────────────────────────────────────────────────
// Per-asset generation — submit, wait, download, write.
// Throws on failure; caller catches and continues.
// ─────────────────────────────────────────────────────────────

async function generateOne(config: OnboardingPromptConfig): Promise<{
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
  readonly returnedSeed: number;
}> {
  console.log(`\n→ ${config.id} (seed ${config.seed})`);
  const startedAt = Date.now();

  // Flux Pro 1.1 Ultra accepts `prompt`, `aspect_ratio`,
  // `output_format`, `seed`, `safety_tolerance`. Does NOT
  // accept `negative_prompt` (unlike Flux Dev / Pro V1).
  // `config.negativePrompt` is preserved in config + recorded
  // in ATTRIBUTION.md for provenance; if Flux ever adds Ultra
  // negative-prompt support OR we switch models, the data is
  // ready. `safety_tolerance: '5'` is the most permissive
  // setting — landscape/abstract imagery should never trigger
  // safety blocks, but a false positive here would burn a
  // generation for no reason.
  const result = await fal.subscribe(FLUX_PRO_ULTRA_MODEL, {
    input: {
      prompt: config.prompt,
      seed: config.seed,
      output_format: 'png',
      aspect_ratio: '1:1',
      safety_tolerance: '5',
    },
    onQueueUpdate(update) {
      if (update.status === 'IN_QUEUE') {
        console.log(`   queued · position ${update.queue_position}`);
      } else if (update.status === 'IN_PROGRESS') {
        console.log('   generating…');
      }
    },
  });

  if (!isFluxOutput(result.data)) {
    throw new Error(
      `Unexpected fal.ai response shape: ${JSON.stringify(result.data).slice(0, 200)}`,
    );
  }

  const image = result.data.images![0]!;
  const downloadResp = await fetch(image.url);
  if (!downloadResp.ok) {
    throw new Error(`Image download failed: ${downloadResp.status} ${downloadResp.statusText}`);
  }
  const buffer = Buffer.from(await downloadResp.arrayBuffer());

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, config.outputFilename);
  fs.writeFileSync(outPath, buffer);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const sizeKb = (buffer.byteLength / 1024).toFixed(1);
  console.log(`   ✓ wrote ${config.outputFilename} (${sizeKb} KB, ${elapsed}s)`);

  return {
    bytes: buffer.byteLength,
    width: image.width ?? 0,
    height: image.height ?? 0,
    returnedSeed: result.data.seed ?? config.seed,
  };
}

// ─────────────────────────────────────────────────────────────
// ATTRIBUTION.md — regenerated on each run so it always
// reflects the latest prompt + seed + cost.
// ─────────────────────────────────────────────────────────────

function writeAttribution(
  results: ReadonlyArray<{
    readonly config: OnboardingPromptConfig;
    readonly outcome:
      | { readonly ok: true; readonly bytes: number; readonly width: number; readonly height: number; readonly returnedSeed: number }
      | { readonly ok: false; readonly error: string };
  }>,
  generatedAt: string,
): void {
  const lines: string[] = [
    '# Onboarding asset provenance',
    '',
    'Generated via the Phase 7A.8 CP1 asset pipeline. Re-run',
    '`npm run gen-assets` (full) or `npm run gen-assets -- --only=<id>`',
    '(single asset) to regenerate.',
    '',
    '## Pipeline',
    '',
    '- Model: **Flux Pro 1.1 Ultra** via [fal.ai](https://fal.ai)',
    '- Endpoint id: `' + FLUX_PRO_ULTRA_MODEL + '`',
    '- Cost: ≈ $' + FLUX_PRO_ULTRA_COST_USD.toFixed(2) + ' per image',
    '- Aspect ratio: 1:1',
    '- Format: PNG',
    '- Last full run: ' + generatedAt,
    '',
    '## Iteration workflow',
    '',
    '1. Edit the prompt or seed in `scripts/onboarding-prompts.config.ts`.',
    '2. Run `npm run gen-assets -- --only=<id>` to regenerate one asset',
    '   without paying for the others.',
    '3. Keep the seed constant when iterating wording (small edits should',
    '   produce the same composition with the requested changes).',
    '4. Change the seed for a full re-roll.',
    '5. Re-running overwrites the existing PNG — commit before iterating',
    '   if you want to keep history.',
    '',
    '## Assets',
    '',
  ];

  for (const { config, outcome } of results) {
    lines.push(`### ${config.outputFilename}`);
    lines.push('');
    lines.push(`- **Consumer**: ${config.consumer}`);
    if (outcome.ok) {
      lines.push(`- **Status**: generated at ${generatedAt}`);
      lines.push(`- **Seed (requested)**: ${config.seed}`);
      if (outcome.returnedSeed !== config.seed) {
        lines.push(`- **Seed (returned by fal)**: ${outcome.returnedSeed}`);
      }
      lines.push(
        `- **Output**: ${(outcome.bytes / 1024).toFixed(1)} KB, ` +
          `${outcome.width || '?'}×${outcome.height || '?'}`,
      );
    } else {
      lines.push(`- **Status**: FAILED (${outcome.error})`);
      lines.push(`- **Seed**: ${config.seed}`);
    }
    lines.push('');
    lines.push('**Prompt**:');
    lines.push('');
    lines.push('> ' + config.prompt.replace(/\n+/g, ' '));
    lines.push('');
    lines.push('**Negative prompt** (provenance only — Flux Pro Ultra ignores this field):');
    lines.push('');
    lines.push('> ' + config.negativePrompt.replace(/\n+/g, ' '));
    lines.push('');
  }

  // Iteration history — preserved across runs as part of the
  // generated file. Captures the CP1 multi-round experiment
  // and surfaces the residual brand-fit gap on hero +
  // teaser-mirror for the Phase 9 illustrator polish entry.
  lines.push('## Iteration history');
  lines.push('');
  lines.push(
    'CP1 ran four iteration rounds before settling on the seed-142..145 ' +
      'Flux Pro 1.1 Ultra prompts above. The history is preserved here ' +
      'because (a) the residual brand-fit gap on `hero-pure-deduction` ' +
      'and `teaser-mirror` is real and queued for Phase 9 illustrator ' +
      'polish, and (b) future maintainers iterating on these assets ' +
      'should know which dead ends are already mapped.',
  );
  lines.push('');
  lines.push('- **Round 1 (Flux, seeds 42-45)**: every asset leaked text artifacts.');
  lines.push('  Diagnosed: Flux Pro 1.1 Ultra ignores `negative_prompt` at the API');
  lines.push('  level (typed schema has no field for it). Exclusion language must');
  lines.push('  live in the positive prompt; never name a text-shaped noun.');
  lines.push('- **Round 2 (Flux, seeds 142-145)**: prompts rewritten to avoid');
  lines.push('  text-suggesting nouns. Text leaks fixed. Brand-acceptable on all');
  lines.push('  four, with caveats: `hero` reads slightly speaker-iris-shaped;');
  lines.push('  `teaser-mirror` reads slightly turntable-shaped; `teaser-blitz`');
  lines.push('  + `modal-notification` land on-brief. **This round is the');
  lines.push('  canonical CP1 deliverable.**');
  lines.push('- **Round 3 (Flux, hero seed 242 + mirror seed 344)**: tried');
  lines.push('  new metaphors — obsidian monolith for hero, crystal pillars for');
  lines.push('  mirror. Both underperformed: the monolith read as a fantasy');
  lines.push('  artifact with too-dramatic lightning veins; the pillars went too');
  lines.push('  bright + sparkly (lost the dark refined tone). Discarded.');
  lines.push('- **Round 4 (Recraft v3 with `digital_illustration/grain` style,');
  lines.push('  all 4)**: explored a different model entirely. Recraft\'s style');
  lines.push('  preset overrode the brand palette across the board (deep navy +');
  lines.push('  violet → bright pastels, gold sparkles, twee aesthetic). All four');
  lines.push('  outputs were palette-violating and tonally wrong. Discarded.');
  lines.push('');
  lines.push(
    'Net: ~$0.84 across all four rounds. Round 2 retained. `hero-pure-deduction` ' +
      'and `teaser-mirror` flagged in `docs/PHASE-9-BACKLOG.md` as candidates ' +
      'for a professional illustrator brief post-launch — AI prompting did not ' +
      'converge on the desired premium-refined aesthetic for those two ' +
      'specifically within the iteration budget.',
  );
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push(
    'See `scripts/onboarding-prompts.config.ts` for the source of truth — ' +
      'this file is regenerated on every successful run.',
  );
  lines.push('');

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(ATTRIBUTION_PATH, lines.join('\n'));
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const cli = parseCliArgs(process.argv.slice(2));
  const credentials = validateEnv();

  fal.config({ credentials });

  let toGenerate: readonly OnboardingPromptConfig[];
  if (cli.only !== null) {
    const match = ONBOARDING_PROMPTS.find((p) => p.id === cli.only);
    if (match === undefined) {
      console.error(
        `\nUnknown asset id: ${cli.only}\nValid ids: ` +
          ONBOARDING_PROMPTS.map((p) => p.id).join(', ') +
          '\n',
      );
      process.exit(1);
    }
    toGenerate = [match];
  } else {
    toGenerate = ONBOARDING_PROMPTS;
  }

  console.log(
    `\nGenerating ${toGenerate.length} asset${toGenerate.length === 1 ? '' : 's'} ` +
      `(${FLUX_PRO_ULTRA_MODEL}, ~$${(FLUX_PRO_ULTRA_COST_USD * toGenerate.length).toFixed(2)} total)`,
  );

  const results: Array<{
    readonly config: OnboardingPromptConfig;
    readonly outcome:
      | { readonly ok: true; readonly bytes: number; readonly width: number; readonly height: number; readonly returnedSeed: number }
      | { readonly ok: false; readonly error: string };
  }> = [];

  for (const config of toGenerate) {
    try {
      const stats = await generateOne(config);
      results.push({ config, outcome: { ok: true, ...stats } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`   ✗ ${config.id} failed: ${message}`);
      results.push({ config, outcome: { ok: false, error: message } });
    }
  }

  // ATTRIBUTION.md reflects the union of (a) freshly-generated
  // assets from this run + (b) prior-run state for any
  // assets that weren't re-generated this time (via --only).
  // Simpler implementation: always document the full set,
  // marking outcomes only for assets actually attempted in
  // this run.
  const fullResults = ONBOARDING_PROMPTS.map((config) => {
    const matched = results.find((r) => r.config.id === config.id);
    if (matched !== undefined) return matched;
    return {
      config,
      outcome: { ok: true as const, bytes: 0, width: 0, height: 0, returnedSeed: config.seed },
    };
  });
  writeAttribution(fullResults, new Date().toISOString());

  const okCount = results.filter((r) => r.outcome.ok).length;
  const failCount = results.length - okCount;
  console.log(
    `\nDone — ${okCount} succeeded, ${failCount} failed. ` +
      `Total cost: ~$${(FLUX_PRO_ULTRA_COST_USD * okCount).toFixed(2)}.`,
  );
  console.log(`ATTRIBUTION.md updated at ${ATTRIBUTION_PATH}`);

  process.exit(failCount > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
