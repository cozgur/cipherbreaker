/**
 * Phase 7A.8 CP3 — jitTooltipManager queue + fireJITTooltip helper.
 *
 * Covers:
 *   - Queue: single tooltip becomes active immediately; concurrent
 *     show() calls queue FIFO; hide() promotes the next one;
 *     duplicate enqueues are no-ops.
 *   - fireJITTooltip: short-circuits when the seen flag is already
 *     set; marks the flag + enqueues when not seen; returns the
 *     fired/skipped boolean.
 *   - Variant configs: each kind has copy + matching seenKey/
 *     markAction pair, so the integration site can rely on the
 *     mapping without re-deriving it.
 */

import { JIT_TOOLTIP_CONFIGS, fireJITTooltip, useJITTooltipQueue } from '../jitTooltipManager';
import { useUserStore, USER_STORE_DEFAULTS } from '@state/userStore';

describe('jitTooltipManager', () => {
  beforeEach(() => {
    useUserStore.setState({ ...USER_STORE_DEFAULTS });
    useJITTooltipQueue.getState().__resetForTests();
  });

  describe('queue', () => {
    it('a single show() makes the tooltip active immediately', () => {
      useJITTooltipQueue.getState().show('TOKEN_EARN');
      expect(useJITTooltipQueue.getState().active).toBe('TOKEN_EARN');
      expect(useJITTooltipQueue.getState().queue).toEqual([]);
    });

    it('a second show() while one is active queues the kind', () => {
      const q = useJITTooltipQueue.getState();
      q.show('TOKEN_EARN');
      q.show('STREAK_MILESTONE');
      expect(useJITTooltipQueue.getState().active).toBe('TOKEN_EARN');
      expect(useJITTooltipQueue.getState().queue).toEqual(['STREAK_MILESTONE']);
    });

    it('hide() promotes the next queued tooltip and shifts the queue', () => {
      const q = useJITTooltipQueue.getState();
      q.show('TOKEN_EARN');
      q.show('STREAK_MILESTONE');
      q.show('HINT_SPEND');
      useJITTooltipQueue.getState().hide();
      expect(useJITTooltipQueue.getState().active).toBe('STREAK_MILESTONE');
      expect(useJITTooltipQueue.getState().queue).toEqual(['HINT_SPEND']);
      useJITTooltipQueue.getState().hide();
      expect(useJITTooltipQueue.getState().active).toBe('HINT_SPEND');
      expect(useJITTooltipQueue.getState().queue).toEqual([]);
      useJITTooltipQueue.getState().hide();
      expect(useJITTooltipQueue.getState().active).toBeNull();
    });

    it('duplicate enqueues (same kind already active or queued) are no-ops', () => {
      const q = useJITTooltipQueue.getState();
      q.show('TOKEN_EARN');
      q.show('TOKEN_EARN'); // same kind as active
      q.show('STREAK_MILESTONE');
      q.show('STREAK_MILESTONE'); // same kind already queued
      expect(useJITTooltipQueue.getState().queue).toEqual(['STREAK_MILESTONE']);
    });

    it('hide() on an empty queue is a no-op', () => {
      useJITTooltipQueue.getState().hide();
      expect(useJITTooltipQueue.getState().active).toBeNull();
    });
  });

  describe('JIT_TOOLTIP_CONFIGS', () => {
    it('every kind has a non-empty message + matching seen-key/mark-action pair', () => {
      for (const cfg of Object.values(JIT_TOOLTIP_CONFIGS)) {
        expect(cfg.message.length).toBeGreaterThan(0);
        expect(cfg.testID).toMatch(/^jit-tooltip-/);
        // markAction maps to a real userStore action that flips the
        // corresponding seenKey — pinned so a rename can't silently
        // break the integration site.
        const action = useUserStore.getState()[cfg.markAction];
        expect(typeof action).toBe('function');
        action();
        expect(useUserStore.getState().jitTooltipsSeen[cfg.seenKey]).toBe(true);
        useUserStore.setState({ ...USER_STORE_DEFAULTS });
      }
    });
  });

  describe('fireJITTooltip', () => {
    it('shows the tooltip + flips the seen flag when not previously seen', () => {
      const fired = fireJITTooltip('TOKEN_EARN');
      expect(fired).toBe(true);
      expect(useJITTooltipQueue.getState().active).toBe('TOKEN_EARN');
      expect(useUserStore.getState().jitTooltipsSeen.firstTokenEarn).toBe(true);
    });

    it('short-circuits when the seen flag is already true', () => {
      useUserStore.setState({
        jitTooltipsSeen: { ...USER_STORE_DEFAULTS.jitTooltipsSeen, firstTokenEarn: true },
      });
      const fired = fireJITTooltip('TOKEN_EARN');
      expect(fired).toBe(false);
      expect(useJITTooltipQueue.getState().active).toBeNull();
    });
  });
});
