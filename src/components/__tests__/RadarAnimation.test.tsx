import { render } from '@testing-library/react-native';

import { RadarAnimation } from '../RadarAnimation';

describe('RadarAnimation', () => {
  it('renders the radar at the default size', () => {
    const tree = render(<RadarAnimation />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('respects a size override', () => {
    const tree = render(<RadarAnimation size={180} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
