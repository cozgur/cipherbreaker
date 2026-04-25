/**
 * Plug-in mode index. Each mode file registers its own `ModeDefinition`
 * here at import time; the registry is the engine's *only* lookup
 * surface — engines never `import` mode files directly so a missing
 * registration surfaces as a `ModeNotFoundError` instead of an
 * undefined symbol later in the call stack.
 *
 * Phase 2 ships an empty registry. Phase 3 (Mode 1) registers the
 * first entry; tests temporarily register stub modes and reset the
 * registry between cases via `__resetRegistryForTests`.
 */

import { ModeNotFoundError } from './errors';
import type { ModeDefinition, ModeSection } from './types';

class ModeRegistry {
  private readonly modes = new Map<number, ModeDefinition>();

  register(mode: ModeDefinition): void {
    this.modes.set(mode.id, mode);
  }

  /** Throws `ModeNotFoundError` if `id` was never registered. */
  get(id: number): ModeDefinition {
    const mode = this.modes.get(id);
    if (mode === undefined) {
      throw new ModeNotFoundError(id);
    }
    return mode;
  }

  /** Non-throwing variant for code that wants to fall back gracefully. */
  getOrNull(id: number): ModeDefinition | null {
    return this.modes.get(id) ?? null;
  }

  getAll(): readonly ModeDefinition[] {
    return Array.from(this.modes.values());
  }

  /** ROADMAP §UI Catalog — section grouping for HomeScreen. */
  getBySection(section: ModeSection): readonly ModeDefinition[] {
    return this.getAll().filter((m) => m.meta.section === section);
  }

  /** Test-only — wipes the registration map. */
  __reset(): void {
    this.modes.clear();
  }
}

export const modeRegistry = new ModeRegistry();

/**
 * Convenience wrapper for tests that need the registry pristine
 * between cases. Production code never calls this.
 */
export function __resetRegistryForTests(): void {
  modeRegistry.__reset();
}
