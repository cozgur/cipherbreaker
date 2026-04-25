import { buildMockTimeline } from '../mockMatchHistory';

describe('buildMockTimeline', () => {
  it('returns a timeline for each of the seven modes', () => {
    for (let id = 1; id <= 7; id += 1) {
      const timeline = buildMockTimeline(id);
      expect(timeline.length).toBeGreaterThan(0);
    }
  });

  it('returns an empty array for an unknown mode id', () => {
    expect(buildMockTimeline(99)).toEqual([]);
  });

  it('Mode 4 entries include elapsedMs (Blitz extra label)', () => {
    const timeline = buildMockTimeline(4);
    for (const entry of timeline) {
      expect(entry.elapsedMs).toBeDefined();
    }
  });

  it('Mode 7 timeline is solo — no opponent rows', () => {
    const timeline = buildMockTimeline(7);
    expect(timeline.every((entry) => entry.side === 'self')).toBe(true);
  });

  it('Mode 5 entries carry blackout feedback with a locked count', () => {
    const timeline = buildMockTimeline(5);
    for (const entry of timeline) {
      expect(entry.feedback.kind).toBe('blackout');
    }
  });

  it('Mode 2 entries carry direction feedback', () => {
    const timeline = buildMockTimeline(2);
    for (const entry of timeline) {
      expect(entry.feedback.kind).toBe('direction');
    }
  });

  it('Mode 3 entries carry precision feedback', () => {
    const timeline = buildMockTimeline(3);
    for (const entry of timeline) {
      expect(entry.feedback.kind).toBe('precision');
    }
  });
});
