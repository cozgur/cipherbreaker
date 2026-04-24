import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { GlassCard } from '../GlassCard';

describe('GlassCard', () => {
  it('renders the provided children', () => {
    const { getByText } = render(
      <GlassCard>
        <Text>Hello</Text>
      </GlassCard>,
    );
    expect(getByText('Hello')).toBeTruthy();
  });

  it('snapshots with a custom padding', () => {
    const tree = render(
      <GlassCard padding={18}>
        <Text>Body</Text>
      </GlassCard>,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
