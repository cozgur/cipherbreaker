import { render } from '@testing-library/react-native';

import { SectionLabel } from '../SectionLabel';

describe('SectionLabel', () => {
  it('renders the supplied label', () => {
    const { getByText } = render(<SectionLabel>CLASSIC</SectionLabel>);
    expect(getByText('CLASSIC')).toBeTruthy();
  });

  it('snapshots with a custom colour', () => {
    const tree = render(<SectionLabel color="#ec4899">ADVANCED</SectionLabel>).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
