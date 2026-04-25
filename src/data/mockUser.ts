/**
 * Mock player profile used by every Phase 1B screen that needs the
 * current user's tokens, level, username, or settings. Shape is
 * deliberately aligned with the Phase 2 `PlayerProfile` + settings
 * store so swapping in `useMatchStore()` / `useSettingsStore()` means
 * changing the import, not the consumer.
 *
 * This module is *mutable* on purpose: the Shop dev-only token boost
 * and the ProfileScreen username edit both need a local-memory update
 * path until Phase 2 wires a real store. The exported `mockUser` is
 * the single source of truth; helper writers mutate its fields in
 * place. Components that want to re-render after a write must pull
 * the value through `useSyncExternalStore` (provided here) so they
 * don't cache a stale snapshot.
 */

import { useSyncExternalStore } from 'react';

export interface MockUserStats {
  readonly gamesPlayed: number;
  readonly winRate: number; // 0..100
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly avgTurns: number;
  readonly tokensEarned: number;
}

export interface MockUserSettings {
  sound: boolean;
  haptics: boolean;
  /** Phase 2 onboarding — Blitz tip shown once per install. */
  hasSeenBlitzTip: boolean;
}

export interface MockUser {
  username: string;
  tokens: number;
  level: number;
  currentXP: number;
  targetXP: number;
  hasOnboarded: boolean;
  stats: MockUserStats;
  /** Per-mode win rate (0..100) keyed by catalog id. */
  perMode: Record<number, { winRate: number }>;
  settings: MockUserSettings;
}

export const mockUser: MockUser = {
  username: 'nova_code',
  tokens: 1840,
  level: 12,
  currentXP: 2340,
  targetXP: 3200,
  hasOnboarded: true,
  stats: {
    gamesPlayed: 247,
    winRate: 68,
    currentStreak: 4,
    bestStreak: 11,
    avgTurns: 5.3,
    tokensEarned: 12_400,
  },
  perMode: {
    1: { winRate: 72 },
    2: { winRate: 64 },
    3: { winRate: 58 },
    4: { winRate: 55 },
    5: { winRate: 49 },
    6: { winRate: 61 },
    7: { winRate: 52 },
  },
  settings: {
    sound: true,
    haptics: true,
    hasSeenBlitzTip: false,
  },
};

// ─────────────────────────────────────────────────────────────
// Minimal reactive layer — components subscribe via `useMockUser`.
// Replaced in Phase 2 by Zustand/AsyncStorage; the hook signature
// (returns a `MockUser`) does not change.
// ─────────────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): MockUser {
  return mockUser;
}

export function useMockUser(): MockUser {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Grant tokens (Shop dev-only + AdWatch reward). Emits a tick so
 * subscribers re-render with the new balance.
 */
export function grantTokens(amount: number): void {
  mockUser.tokens += amount;
  emit();
}

/**
 * Deduct tokens (forfeit penalty + match-start stake in later phases).
 * Clamps the balance at zero so an over-spend never goes negative —
 * the engine in Phase 7B will assert affordability *before* calling
 * this; the clamp is a defensive layer for the mock.
 */
export function chargeTokens(amount: number): void {
  if (amount <= 0) return;
  mockUser.tokens = Math.max(0, mockUser.tokens - amount);
  emit();
}

/** Flip the persisted onboarding flag once the intro is completed. */
export function markOnboarded(): void {
  mockUser.hasOnboarded = true;
  emit();
}

/** Rename the current user (ProfileScreen username edit). */
export function setUsername(next: string): void {
  const trimmed = next.trim();
  if (trimmed.length === 0) return;
  mockUser.username = trimmed;
  emit();
}

/** Flip a boolean setting key. */
export function toggleSetting(key: keyof MockUserSettings): void {
  const current = mockUser.settings[key];
  mockUser.settings[key] = !current;
  emit();
}

/**
 * Test-only reset — rehydrates fields from a fresh default so each
 * test starts from a known baseline. Not exported from the barrel
 * but importable directly from this file.
 */
export function __resetMockUserForTests(): void {
  mockUser.username = 'nova_code';
  mockUser.tokens = 1840;
  mockUser.level = 12;
  mockUser.currentXP = 2340;
  mockUser.targetXP = 3200;
  mockUser.hasOnboarded = true;
  mockUser.settings.sound = true;
  mockUser.settings.haptics = true;
  mockUser.settings.hasSeenBlitzTip = false;
  emit();
}
