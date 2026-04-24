import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Screen } from '../Screen';

describe('Screen', () => {
  it('renders children above the ambient + grain layers', () => {
    const { getByText } = render(
      <Screen>
        <Text>Hello</Text>
      </Screen>,
    );
    expect(getByText('Hello')).toBeTruthy();
  });

  it('snapshots a gold-tinted variant', () => {
    const tree = render(
      <Screen ambientTint="#fbbf24" ambientIntensity={0.3}>
        <Text>Body</Text>
      </Screen>,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
