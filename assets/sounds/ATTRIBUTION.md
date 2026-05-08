# Sound Asset Attribution

## Phase 7A.7 CP2 — procedural placeholder assets

The five WAV files in this directory (`win.wav`, `lose.wav`, `draw.wav`, `earn.wav`, `dailyUnlock.wav`) were procedurally generated via `ffmpeg` sine-wave synthesis at the time of CP2 ship. They are **placeholder assets** suitable for shipping a working sound surface but intended to be replaced with curated / produced audio during a future polish pass.

### Provenance

- **Source**: synthesized in-repo via `ffmpeg` `lavfi` filters (sine + amix + afade + concat).
- **License**: no license — synthetic mathematical waveforms have no copyright. Free to redistribute, modify, replace.
- **Generation commands**: see the CP2 commit message body for the exact ffmpeg invocations that produced each file.

### Asset characteristics (as generated)

| File | Character | Frequencies | Duration | Volume |
|---|---|---|---|---|
| `win.wav` | Major arpeggio ascending | C5 → E5 → G5 (523.25 / 659.25 / 783.99 Hz) | ~810ms | 0.7 |
| `lose.wav` | Minor descending 3rd | A4 → F4 (440 / 349.23 Hz) | ~600ms | 0.5 |
| `draw.wav` | Neutral perfect-5th harmonic | E4 + B4 (329.63 / 493.88 Hz) | ~400ms | 0.5 |
| `earn.wav` | Frequency sweep | 1200 → 800 Hz | ~200ms | 0.6 |
| `dailyUnlock.wav` | Signature chime with overtone | 600 + 1200 Hz | ~1200ms | 0.7 |

All files: mono, 16-bit PCM, 44.1 kHz, ~280KB total.

### Replacement path

Phase 9 backlog tracks a `Sound asset polish` item to swap these placeholders for higher-quality sourced or commissioned audio. The expected drop-in:

1. New WAV / MP3 files at the same five paths (`assets/sounds/{win,lose,draw,earn,dailyUnlock}.wav`).
2. `src/lib/sound.ts` `require()` paths stay unchanged.
3. Update this `ATTRIBUTION.md` with the new source + license.

The helper module API (`win() / lose() / draw() / earn() / dailyUnlock()`) is asset-agnostic; swapping the underlying files requires no code changes.
