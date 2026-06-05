#!/usr/bin/env tsx
/**
 * Phase 8 sub-phase 8.3 — iOS app-icon generation.
 *
 * Reuses the CP1 fal.ai convention (Flux Pro 1.1 Ultra, 1:1, PNG,
 * safety_tolerance '5') from `generate-onboarding-assets.ts`, but is a
 * standalone one-off: it writes the App Store master icon to
 * `assets/icon/app-icon-1024.png` instead of the onboarding set, so the
 * onboarding config + ATTRIBUTION stay untouched.
 *
 * Flux Ultra returns a ~2K square; the brief requires an EXACT
 * 1024×1024 master, so the caller downscales with `sips` after this
 * script writes the raw output.
 *
 * Run: `npx tsx scripts/generate-app-icon.ts [--seed=<n>]`
 * Env: FAL_KEY (read from .env at repo root or shell).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { fal } from '@fal-ai/client';
import dotenv from 'dotenv';

dotenv.config();

const FLUX_PRO_ULTRA_MODEL = 'fal-ai/flux-pro/v1.1-ultra';
const COST_USD = 0.06;
const OUTPUT_DIR = path.resolve(__dirname, '..', 'assets', 'icon');
const OUTPUT_FILE = 'app-icon-source.png'; // raw fal output; sips downscales to app-icon-1024.png

// Round 4b (seed 803 kept = same 2x2 tile layout; reworded to kill the
// round-4 "rounded mockup on a light backdrop" framing). Forces FULL-BLEED:
// the dark gradient must reach all four straight edges + sharp square
// corners with NO rounded corners, border, margin, or light background.
const PROMPT =
  'A single flat full-bleed square artwork, edge to edge, for a premium dark ' +
  'puzzle game. A deep purple to dark navy gradient FILLS THE ENTIRE SQUARE ' +
  'FRAME corner to corner — no border, no margin, no rounded corners, no light ' +
  'or white background, no surrounding backdrop, no drop shadow around the ' +
  'frame; sharp straight edges and square corners, the dark artwork covers ' +
  '100% of the frame. Perfectly centered on that dark background: a 2x2 grid ' +
  'of four glossy refined tiles in distinct premium colors — one violet, one ' +
  'deep gold, one soft teal, one dark purple — each tile slightly raised with ' +
  'a subtle soft shadow and clean rounded edges, like a luxury Wordle-style ' +
  'color-matching mark, elevated. The tile group fills about 60% of the frame ' +
  'with a subtle ambient violet glow around it. Premium, refined, ' +
  'sophisticated, high contrast. Solid opaque dark background, no transparency.';

function parseSeed(argv: readonly string[]): number {
  for (const arg of argv) {
    if (arg.startsWith('--seed=')) {
      const n = Number(arg.slice('--seed='.length));
      if (Number.isInteger(n)) return n;
    }
  }
  return 801; // default Phase 8 round-1 seed (reproducible)
}

interface FluxImageResult {
  readonly url: string;
  readonly width?: number;
  readonly height?: number;
}
interface FluxOutput {
  readonly images?: readonly FluxImageResult[];
  readonly seed?: number;
}
function isFluxOutput(data: unknown): data is FluxOutput {
  if (typeof data !== 'object' || data === null) return false;
  const out = data as Record<string, unknown>;
  if (!Array.isArray(out.images) || out.images.length === 0) return false;
  return typeof (out.images[0] as Record<string, unknown>)?.url === 'string';
}

async function main(): Promise<void> {
  const seed = parseSeed(process.argv.slice(2));
  const credentials = process.env.FAL_KEY?.trim();
  if (!credentials) {
    console.error('\nFAL_KEY is not set. Add it to .env at the repo root and re-run.\n');
    process.exit(1);
  }
  fal.config({ credentials });

  console.log(`\nGenerating app icon (${FLUX_PRO_ULTRA_MODEL}, seed ${seed}, ~$${COST_USD.toFixed(2)})`);
  const startedAt = Date.now();

  const result = await fal.subscribe(FLUX_PRO_ULTRA_MODEL, {
    input: {
      prompt: PROMPT,
      seed,
      output_format: 'png',
      aspect_ratio: '1:1',
      safety_tolerance: '5',
    },
    onQueueUpdate(update) {
      if (update.status === 'IN_QUEUE') console.log(`   queued · position ${update.queue_position}`);
      else if (update.status === 'IN_PROGRESS') console.log('   generating…');
    },
  });

  if (!isFluxOutput(result.data)) {
    throw new Error(`Unexpected fal.ai response: ${JSON.stringify(result.data).slice(0, 200)}`);
  }
  const image = result.data.images![0]!;
  const resp = await fetch(image.url);
  if (!resp.ok) throw new Error(`Image download failed: ${resp.status} ${resp.statusText}`);
  const buffer = Buffer.from(await resp.arrayBuffer());

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, OUTPUT_FILE);
  fs.writeFileSync(outPath, buffer);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `   ✓ wrote ${OUTPUT_FILE} (${(buffer.byteLength / 1024).toFixed(1)} KB, ` +
      `${image.width ?? '?'}×${image.height ?? '?'}, ${elapsed}s, returned seed ${result.data.seed ?? seed})`,
  );
  console.log(`   path: ${outPath}`);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
