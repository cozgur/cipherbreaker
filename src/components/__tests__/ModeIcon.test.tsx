import { render } from '@testing-library/react-native';

import { ModeIcon } from '../ModeIcon';
import type { ModeIconKey } from '@game/types';

const KEYS: readonly ModeIconKey[] = [
  'color-match',
  'high-low',
  'precision',
  'blitz',
  'blackout',
  'sudden-death',
  'mirror',
];

describe('ModeIcon', () => {
  it.each(KEYS)('renders the %s glyph', (key) => {
    const tree = render(<ModeIcon iconKey={key} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
