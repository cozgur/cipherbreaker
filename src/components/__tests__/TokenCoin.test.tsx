import { render } from '@testing-library/react-native';

import { TokenCoin } from '../TokenCoin';

describe('TokenCoin', () => {
  it('renders at the default size', () => {
    const tree = render(<TokenCoin />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders at a larger size', () => {
    const tree = render(<TokenCoin size={36} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
