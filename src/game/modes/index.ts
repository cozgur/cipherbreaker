/**
 * Mode barrel — imports each `ModeDefinition` and registers it with
 * `modeRegistry` at module load. The app entry point (`App.tsx`)
 * imports this barrel for its side effect *before* any screen renders,
 * so `modeRegistry.get(modeId)` is hot by the time MatchScreen mounts.
 *
 * Adding a mode (Faz 4-5): add the `import` + `register` line below.
 * The registry call is what matters; the named re-export is convenience
 * for tests that want to reach the definition directly.
 */

import { modeRegistry } from '../modeRegistry';
import { mode1ColorMatch } from './mode1ColorMatch';
import { mode2HighLow } from './mode2HighLow';
import { mode3Precision } from './mode3Precision';

modeRegistry.register(mode1ColorMatch);
modeRegistry.register(mode2HighLow);
modeRegistry.register(mode3Precision);

export { mode1ColorMatch, mode2HighLow, mode3Precision };
