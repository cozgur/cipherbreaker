/**
 * Phase 7A.7 CP2 — sound feedback helper.
 *
 * Five named functions cover the five sound moments in the app:
 *
 *   win()         — match win, tutorial win celebration, daily success.
 *   lose()        — match defeat, daily failure.
 *   draw()        — match draw / stalemate.
 *   earn()        — token grant pulse (post-match reward, tutorial
 *                   reward, ad reward, teaser CTA gift).
 *   dailyUnlock() — NotificationOptInModal "Turn on reminders" CTA.
 *
 * Every function gates on `useSettingsStore.getState().sound`
 * (default `true`, toggleable via the existing
 * `toggleSetting('sound')` action and the Settings UI toggle
 * already wired in `ProfileScreen`). Same activation pattern CP1
 * applied to haptics — settingsStore.sound was pre-built for
 * Phase 1B's mock infra; CP2 is the first consumer.
 *
 * Loading strategy: lazy. Module load only resolves the bundled
 * WAV asset numbers into the `SOURCES` map; the `players`
 * record is initialized to all-nulls. `createAudioPlayer` is
 * invoked on first `play()` call via the `getPlayer()` helper,
 * which memoises each player so subsequent calls reuse the same
 * instance. expo-audio then loads the file asynchronously in
 * the background; first-call resilience is handled by the
 * player's `isLoaded` property (skip silently if not yet loaded
 * — caller doesn't see a delay or error). Mitigates startup
 * memory cost (no five-player allocation on a cold launch that
 * may never play any of them) without a perceptible first-play
 * delay because `createAudioPlayer` returns synchronously.
 *
 * Replay semantic: each call performs `seekTo(0)` then `play()`,
 * so a rapid second fire of the same sound restarts from the
 * beginning instead of overlapping. expo-audio's
 * `useAudioPlayer` hook is unsuitable here (component-scoped
 * lifecycle); `createAudioPlayer` gives us module-scoped
 * persistent players.
 *
 * Volume hardcoded at `0.7` per the CP2 spec — a master volume
 * slider is deferred to Phase 9 polish backlog. Per-event
 * fine-tune already lives in the asset itself (see
 * `assets/sounds/ATTRIBUTION.md`'s asset characteristics table).
 *
 * Test mocking strategy (jest.setup.js, mirroring CP1 haptics):
 * `@/lib/sound` is mocked globally as no-ops AND `expo-audio` is
 * mocked at the native-binding level. The helper's own test
 * file (`sound.test.ts`) calls `jest.unmock('@/lib/sound')` to
 * exercise the real impl against the mocked native bindings.
 */

import { createAudioPlayer } from 'expo-audio';

import { useSettingsStore } from '@state/settingsStore';

type SoundKey = 'win' | 'lose' | 'draw' | 'earn' | 'dailyUnlock';

const PLAYER_VOLUME = 0.7;

// `SOURCES` resolves the bundled WAV asset numbers eagerly at
// module load — `require` returns Metro bundle IDs, not player
// instances. Actual `createAudioPlayer` invocation is lazy: see
// `getPlayer()` below, which instantiates a player on first
// `play()` call and memoises into the `players` record.
const SOURCES: Record<SoundKey, number> = {
  win: require('../../assets/sounds/win.wav'),
  lose: require('../../assets/sounds/lose.wav'),
  draw: require('../../assets/sounds/draw.wav'),
  earn: require('../../assets/sounds/earn.wav'),
  dailyUnlock: require('../../assets/sounds/dailyUnlock.wav'),
};

const players: Record<SoundKey, ReturnType<typeof createAudioPlayer> | null> = {
  win: null,
  lose: null,
  draw: null,
  earn: null,
  dailyUnlock: null,
};

function getPlayer(key: SoundKey): ReturnType<typeof createAudioPlayer> | null {
  if (players[key] === null) {
    try {
      const player = createAudioPlayer(SOURCES[key]);
      player.volume = PLAYER_VOLUME;
      players[key] = player;
    } catch {
      // Native binding unavailable (test / web / failed load).
      // Silent — see fire-and-forget rationale in the module doc.
      return null;
    }
  }
  return players[key];
}

function isEnabled(): boolean {
  return useSettingsStore.getState().sound === true;
}

function play(key: SoundKey): void {
  if (!isEnabled()) return;
  const player = getPlayer(key);
  if (player === null) return;
  if (!player.isLoaded) return;
  try {
    // Reset to start so rapid repeat fires restart instead of
    // no-op'ing on an already-playing player. `seekTo` is
    // async-returning but the side effect is immediate; we
    // don't await — the subsequent `play()` picks up the
    // reset position synchronously enough that the first
    // millisecond clipping is imperceptible. Explicit `.catch`
    // (not `void`) so a rejected promise doesn't surface as
    // an unhandled rejection in dev / test.
    player.seekTo(0).catch(() => {
      /* swallow — audio session conflict / device busy */
    });
    player.play();
  } catch {
    // Synchronous throw from `play()` (rare; some platforms
    // throw synchronously when the audio session is unusable).
    // Silent.
  }
}

export function win(): void {
  play('win');
}

export function lose(): void {
  play('lose');
}

export function draw(): void {
  play('draw');
}

export function earn(): void {
  play('earn');
}

export function dailyUnlock(): void {
  play('dailyUnlock');
}

/**
 * Test-only — resets the memoised player Record so each test
 * sees a fresh `createAudioPlayer` call on first play. Avoids
 * the `jest.resetModules()` dance + the expo-audio mock-identity
 * problem that would otherwise leak captured references across
 * the suite.
 */
export function __resetPlayersForTests(): void {
  (Object.keys(players) as SoundKey[]).forEach((key) => {
    players[key] = null;
  });
}
