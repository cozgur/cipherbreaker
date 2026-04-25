import { render } from '@testing-library/react-native';

import { Avatar } from '../Avatar';

describe('Avatar', () => {
  it('renders the uppercased first letter', () => {
    const { getByText } = render(<Avatar name="nova" />);
    expect(getByText('N')).toBeTruthy();
  });

  it('falls back to "?" when the name is empty', () => {
    const { getByText } = render(<Avatar name="" />);
    expect(getByText('?')).toBeTruthy();
  });

  it('paints deterministically from the name hash', () => {
    const first = render(<Avatar name="Shadow" />).toJSON();
    const second = render(<Avatar name="Shadow" />).toJSON();
    expect(first).toEqual(second);
  });

  it('accepts a gradient override', () => {
    const tree = render(<Avatar name="Nova" colors={['#fbbf24', '#b45309']} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
