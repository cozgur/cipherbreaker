import { render } from '@testing-library/react-native';

import { ConfettiOverlay } from '../ConfettiOverlay';

describe('ConfettiOverlay', () => {
  it('renders nothing when disabled', () => {
    const { toJSON } = render(<ConfettiOverlay enabled={false} />);
    expect(toJSON()).toBeNull();
  });

  it('snapshots the deterministic 36-particle scatter', () => {
    const tree = render(<ConfettiOverlay seed={1} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('produces an identical layout for the same seed (deterministic)', () => {
    const a = render(<ConfettiOverlay seed={42} />).toJSON();
    const b = render(<ConfettiOverlay seed={42} />).toJSON();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
