import { render } from '@testing-library/react-native';

import { LevelBar } from '../LevelBar';

describe('LevelBar', () => {
  it('renders level, progress label, and XP counter', () => {
    const { getByText } = render(
      <LevelBar level={12} currentXP={2340} targetXP={3200} />,
    );
    expect(getByText('LEVEL 12')).toBeTruthy();
    expect(getByText('2,340 / 3,200 XP')).toBeTruthy();
  });

  it('handles a zero target without dividing by zero', () => {
    const tree = render(<LevelBar level={1} currentXP={0} targetXP={0} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('clamps overflow above 100%', () => {
    const tree = render(<LevelBar level={9} currentXP={999} targetXP={100} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
