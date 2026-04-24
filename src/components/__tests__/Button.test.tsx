import { fireEvent, render } from '@testing-library/react-native';

import { Button } from '../Button';

describe('Button', () => {
  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Button onPress={onPress}>Play</Button>);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores taps when disabled', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <Button onPress={onPress} disabled>
        Play
      </Button>,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it.each(['primary', 'cyan', 'outline'] as const)('renders %s variant', (variant) => {
    const tree = render(<Button variant={variant}>Tap</Button>).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders an lg size with icon', () => {
    const tree = render(
      <Button size="lg" icon={<></>}>
        Lock In Code
      </Button>,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
