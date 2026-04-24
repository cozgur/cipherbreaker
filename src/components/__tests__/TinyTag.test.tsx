import { render } from '@testing-library/react-native';

import { TinyTag } from '../TinyTag';

describe('TinyTag', () => {
  it('renders the tag label', () => {
    const { getByText } = render(<TinyTag>PRESTIGE</TinyTag>);
    expect(getByText('PRESTIGE')).toBeTruthy();
  });

  it('snapshots a coloured variant', () => {
    const tree = render(<TinyTag color="#dc2626">HIGH RISK</TinyTag>).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
