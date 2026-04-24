import { render } from '@testing-library/react-native';

import { DigitTile } from '../DigitTile';

describe('DigitTile', () => {
  it('renders an em-dash for empty slots', () => {
    const { getByText } = render(<DigitTile />);
    expect(getByText('—')).toBeTruthy();
  });

  it('renders a supplied digit', () => {
    const { getByText } = render(<DigitTile digit={4} state="green" />);
    expect(getByText('4')).toBeTruthy();
  });

  it.each(['neutral', 'green', 'yellow', 'gray', 'violet', 'blackout'] as const)(
    'snapshots the %s state',
    (state) => {
      const tree = render(<DigitTile digit={7} state={state} />).toJSON();
      expect(tree).toMatchSnapshot();
    },
  );
});
