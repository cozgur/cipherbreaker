import { render } from '@testing-library/react-native';

import { OpponentCard } from '../OpponentCard';

describe('OpponentCard', () => {
  it('renders name, level, and online state', () => {
    const { getByText } = render(
      <OpponentCard name="shadowHunter47" level={23} flag="🇩🇪" isOnline />,
    );
    expect(getByText('shadowHunter47')).toBeTruthy();
    expect(getByText('Lv. 23')).toBeTruthy();
    expect(getByText('· 🇩🇪')).toBeTruthy();
    expect(getByText('Online')).toBeTruthy();
  });

  it('snapshots the active variant', () => {
    const tree = render(<OpponentCard name="Nova" level={12} active />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
