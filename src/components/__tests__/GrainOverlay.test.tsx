import { render } from '@testing-library/react-native';

import { GrainOverlay } from '../GrainOverlay';

describe('GrainOverlay', () => {
  it('uses the 2% default opacity', () => {
    const tree = render(<GrainOverlay />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('accepts a custom opacity', () => {
    const tree = render(<GrainOverlay opacity={0.05} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
