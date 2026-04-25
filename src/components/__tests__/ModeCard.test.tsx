import { fireEvent, render } from '@testing-library/react-native';

import { ModeCard } from '../ModeCard';
import { modeCatalog } from '@data/modeCatalog';

const colorMatch = modeCatalog[0];
const blackout = modeCatalog[4];

if (!colorMatch || !blackout) {
  throw new Error('ModeCard tests: modeCatalog missing expected entries');
}

describe('ModeCard', () => {
  it('renders name, description, and stake', () => {
    const { getByText } = render(<ModeCard meta={colorMatch.meta} />);
    expect(getByText('COLOR MATCH')).toBeTruthy();
    expect(getByText(colorMatch.meta.description)).toBeTruthy();
    expect(getByText('50')).toBeTruthy();
  });

  it('shows the badge for advanced modes', () => {
    const { getByText } = render(<ModeCard meta={blackout.meta} />);
    expect(getByText('PRESTIGE')).toBeTruthy();
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<ModeCard meta={colorMatch.meta} onPress={onPress} />);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('suppresses onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<ModeCard meta={colorMatch.meta} onPress={onPress} disabled />);
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
