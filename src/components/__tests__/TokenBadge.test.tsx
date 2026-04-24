import { render } from '@testing-library/react-native';

import { TokenBadge } from '../TokenBadge';

describe('TokenBadge', () => {
  it('renders the amount', () => {
    const { getByText } = render(<TokenBadge amount="1,840" />);
    expect(getByText('1,840')).toBeTruthy();
  });

  it.each(['sm', 'md', 'lg'] as const)('snapshots the %s size', (size) => {
    const tree = render(<TokenBadge amount={420} size={size} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
