/**
 * Phase 7A.7 CP2 — `@/lib/sound` helper tests.
 *
 * jest.setup.js mocks `@/lib/sound` globally as no-ops so the 5
 * trigger sites across the codebase don't need to know about
 * sound. This file exercises the REAL helper implementation
 * against the jest.setup.js mock of `expo-audio`.
 */

jest.unmock('@/lib/sound');

import { createAudioPlayer } from 'expo-audio';

import { __resetPlayersForTests, draw, earn, lose, win } from '@/lib/sound';
import { SETTINGS_STORE_DEFAULTS, useSettingsStore } from '@state/settingsStore';

const createAudioPlayerMock = createAudioPlayer as jest.MockedFunction<
  typeof createAudioPlayer
>;

interface MockPlayer {
  isLoaded: boolean;
  volume: number;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  remove: jest.Mock;
  replace: jest.Mock;
}

function makeMockPlayer(overrides: Partial<MockPlayer> = {}): MockPlayer {
  return {
    isLoaded: true,
    volume: 0,
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(async () => undefined),
    remove: jest.fn(),
    replace: jest.fn(),
    ...overrides,
  };
}

function setSound(enabled: boolean): void {
  useSettingsStore.setState({ ...SETTINGS_STORE_DEFAULTS, sound: enabled });
}

describe('Phase 7A.7 CP2 — @/lib/sound', () => {
  beforeEach(() => {
    __resetPlayersForTests();
    createAudioPlayerMock.mockReset();
    createAudioPlayerMock.mockImplementation(() => makeMockPlayer() as never);
    setSound(true);
  });

  describe('settings gate', () => {
    it('all five exports return early without creating a player when sound is disabled', () => {
      setSound(false);
      win();
      lose();
      draw();
      earn();
      expect(createAudioPlayerMock).not.toHaveBeenCalled();
    });

    it('flipping sound on/off between calls is respected per call', () => {
      win();
      const callsAfterEnabled = createAudioPlayerMock.mock.calls.length;
      expect(callsAfterEnabled).toBe(1);

      setSound(false);
      lose();
      // No new player created — gate short-circuits before the
      // memoised getter would have created a new lose player.
      expect(createAudioPlayerMock.mock.calls.length).toBe(callsAfterEnabled);

      setSound(true);
      lose();
      expect(createAudioPlayerMock.mock.calls.length).toBe(callsAfterEnabled + 1);
    });
  });

  describe('player lifecycle', () => {
    it('lazily creates a player on first call per sound key', () => {
      win();
      expect(createAudioPlayerMock).toHaveBeenCalledTimes(1);

      lose();
      expect(createAudioPlayerMock).toHaveBeenCalledTimes(2);
    });

    it('reuses the memoised player on subsequent calls of the same key', () => {
      const winPlayer = makeMockPlayer();
      createAudioPlayerMock.mockReturnValueOnce(winPlayer as never);

      win();
      win();
      win();
      // One creation, three plays.
      expect(createAudioPlayerMock).toHaveBeenCalledTimes(1);
      expect(winPlayer.play).toHaveBeenCalledTimes(3);
    });

    it('sets volume to 0.7 on the player when first created', () => {
      const winPlayer = makeMockPlayer();
      createAudioPlayerMock.mockReturnValueOnce(winPlayer as never);
      win();
      expect(winPlayer.volume).toBe(0.7);
    });

    it('returns silently if createAudioPlayer throws (native binding unavailable)', () => {
      createAudioPlayerMock.mockImplementationOnce(() => {
        throw new Error('native unavailable');
      });
      expect(() => win()).not.toThrow();
    });
  });

  describe('replay semantic', () => {
    it('seeks to 0 then plays so rapid repeat fires restart from the beginning', () => {
      const winPlayer = makeMockPlayer();
      createAudioPlayerMock.mockReturnValueOnce(winPlayer as never);

      win();
      expect(winPlayer.seekTo).toHaveBeenCalledWith(0);
      expect(winPlayer.play).toHaveBeenCalledTimes(1);
    });

    it('skips silently when player.isLoaded is false (asset still loading)', () => {
      const winPlayer = makeMockPlayer({ isLoaded: false });
      createAudioPlayerMock.mockReturnValueOnce(winPlayer as never);

      win();
      expect(winPlayer.seekTo).not.toHaveBeenCalled();
      expect(winPlayer.play).not.toHaveBeenCalled();
    });
  });

  describe('rejection swallowing', () => {
    it('does not throw when player.seekTo rejects', async () => {
      const winPlayer = makeMockPlayer({
        seekTo: jest.fn(async () => {
          throw new Error('audio session conflict');
        }),
      });
      createAudioPlayerMock.mockReturnValueOnce(winPlayer as never);

      expect(() => win()).not.toThrow();
      // Microtask flush so the rejection's catch handler runs
      // before the test ends.
      await new Promise((resolve) => setImmediate(resolve));
    });

    it('does not throw when player.play throws synchronously', () => {
      const winPlayer = makeMockPlayer({
        play: jest.fn(() => {
          throw new Error('audio session conflict');
        }),
      });
      createAudioPlayerMock.mockReturnValueOnce(winPlayer as never);

      expect(() => win()).not.toThrow();
    });
  });
});
