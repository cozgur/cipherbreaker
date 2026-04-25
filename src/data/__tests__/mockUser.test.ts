import {
  __resetMockUserForTests,
  chargeTokens,
  grantTokens,
  markOnboarded,
  mockUser,
  setUsername,
  toggleSetting,
} from '../mockUser';

describe('mockUser', () => {
  beforeEach(() => {
    __resetMockUserForTests();
  });

  it('starts the player with onboarded state and a positive balance', () => {
    expect(mockUser.hasOnboarded).toBe(true);
    expect(mockUser.tokens).toBeGreaterThan(0);
  });

  it('exposes a per-mode win rate for each of the seven modes', () => {
    for (let id = 1; id <= 7; id += 1) {
      expect(mockUser.perMode[id]).toBeDefined();
    }
  });

  it('ships with hasSeenBlitzTip=false so the Phase 7A tip fires once', () => {
    expect(mockUser.settings.hasSeenBlitzTip).toBe(false);
  });

  it('grants tokens additively', () => {
    const before = mockUser.tokens;
    grantTokens(500);
    expect(mockUser.tokens).toBe(before + 500);
  });

  it('flips hasOnboarded via markOnboarded without touching other fields', () => {
    mockUser.hasOnboarded = false;
    markOnboarded();
    expect(mockUser.hasOnboarded).toBe(true);
  });

  it('updates username only with a non-empty trimmed value', () => {
    setUsername('  neon_rider  ');
    expect(mockUser.username).toBe('neon_rider');
    setUsername('   ');
    expect(mockUser.username).toBe('neon_rider');
  });

  it('chargeTokens deducts and clamps the balance at zero', () => {
    mockUser.tokens = 100;
    chargeTokens(40);
    expect(mockUser.tokens).toBe(60);
    chargeTokens(500);
    expect(mockUser.tokens).toBe(0);
  });

  it('chargeTokens ignores zero or negative inputs', () => {
    mockUser.tokens = 100;
    chargeTokens(0);
    chargeTokens(-50);
    expect(mockUser.tokens).toBe(100);
  });

  it('toggles boolean settings without flipping neighbours', () => {
    const initialHaptics = mockUser.settings.haptics;
    toggleSetting('sound');
    expect(mockUser.settings.sound).toBe(false);
    expect(mockUser.settings.haptics).toBe(initialHaptics);
  });
});
