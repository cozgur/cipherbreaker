import { USER_STORE_DEFAULTS, useUserStore } from '../userStore';

describe('useUserStore', () => {
  beforeEach(() => {
    useUserStore.setState({ ...USER_STORE_DEFAULTS });
  });

  it('starts at the documented defaults', () => {
    const state = useUserStore.getState();
    expect(state.tokens).toBe(1840);
    expect(state.username).toBe('nova_code');
    expect(state.hasOnboarded).toBe(true);
  });

  it('addTokens accumulates positively', () => {
    useUserStore.getState().addTokens(500);
    expect(useUserStore.getState().tokens).toBe(1840 + 500);
  });

  it('addTokens ignores zero / negative input', () => {
    useUserStore.getState().addTokens(0);
    useUserStore.getState().addTokens(-100);
    expect(useUserStore.getState().tokens).toBe(1840);
  });

  it('subtractTokens deducts and clamps at zero', () => {
    useUserStore.setState({ tokens: 100 });
    useUserStore.getState().subtractTokens(40);
    expect(useUserStore.getState().tokens).toBe(60);
    useUserStore.getState().subtractTokens(500);
    expect(useUserStore.getState().tokens).toBe(0);
  });

  it('subtractTokens ignores zero / negative input', () => {
    useUserStore.setState({ tokens: 100 });
    useUserStore.getState().subtractTokens(0);
    useUserStore.getState().subtractTokens(-50);
    expect(useUserStore.getState().tokens).toBe(100);
  });

  it('setUsername trims and rejects empty strings', () => {
    useUserStore.getState().setUsername('  neon_rider  ');
    expect(useUserStore.getState().username).toBe('neon_rider');
    useUserStore.getState().setUsername('   ');
    expect(useUserStore.getState().username).toBe('neon_rider');
  });

  it('setHasOnboarded flips the flag without touching siblings', () => {
    const before = useUserStore.getState();
    useUserStore.getState().setHasOnboarded(false);
    const after = useUserStore.getState();
    expect(after.hasOnboarded).toBe(false);
    expect(after.tokens).toBe(before.tokens);
    expect(after.username).toBe(before.username);
  });

  it('exposes a persist API (durable)', () => {
    expect(useUserStore.persist).toBeDefined();
    expect(typeof useUserStore.persist.clearStorage).toBe('function');
  });
});
