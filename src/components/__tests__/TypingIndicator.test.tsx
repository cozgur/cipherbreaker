import { render } from '@testing-library/react-native';

import { TypingIndicator } from '../TypingIndicator';

describe('TypingIndicator', () => {
  it('renders at the default size', () => {
    const tree = render(<TypingIndicator />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders with a custom colour + size', () => {
    const tree = render(<TypingIndicator color="#06b6d4" size={12} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
