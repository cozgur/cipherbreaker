import { modeCatalog } from '@data/modeCatalog';
import { getRowRenderer, guessRowRenderers } from '../renderers';

describe('guessRowRenderers', () => {
  it('maps every mode in the catalog to a renderer', () => {
    for (const entry of modeCatalog) {
      expect(guessRowRenderers[entry.id]).toBeDefined();
    }
  });

  it('defines exactly seven renderers', () => {
    expect(Object.keys(guessRowRenderers)).toHaveLength(7);
  });

  it('getRowRenderer returns a component for known ids and undefined otherwise', () => {
    expect(getRowRenderer(1)).toBe(guessRowRenderers[1]);
    expect(getRowRenderer(99)).toBeUndefined();
  });
});
