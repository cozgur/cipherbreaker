import { render } from '@testing-library/react-native';

import { AmbientBackground } from '../AmbientBackground';

describe('AmbientBackground', () => {
  it('renders with default violet tint', () => {
    const tree = render(<AmbientBackground />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('honours a custom tint + intensity', () => {
    const tree = render(<AmbientBackground tint="#fbbf24" intensity={0.3} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
