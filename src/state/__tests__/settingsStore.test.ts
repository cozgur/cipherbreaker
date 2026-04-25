import { SETTINGS_STORE_DEFAULTS, useSettingsStore } from '../settingsStore';

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...SETTINGS_STORE_DEFAULTS });
  });

  it('starts at documented defaults', () => {
    const s = useSettingsStore.getState();
    expect(s.sound).toBe(true);
    expect(s.haptics).toBe(true);
    expect(s.hasSeenBlitzTip).toBe(false);
  });

  it('toggleSetting flips a single key without touching siblings', () => {
    useSettingsStore.getState().toggleSetting('sound');
    const s = useSettingsStore.getState();
    expect(s.sound).toBe(false);
    expect(s.haptics).toBe(true);
  });

  it('toggleSetting twice returns to the original value', () => {
    useSettingsStore.getState().toggleSetting('haptics');
    useSettingsStore.getState().toggleSetting('haptics');
    expect(useSettingsStore.getState().haptics).toBe(true);
  });

  it('exposes a persist API (durable)', () => {
    expect(useSettingsStore.persist).toBeDefined();
  });
});
