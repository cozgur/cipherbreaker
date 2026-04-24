import { fireEvent, render } from '@testing-library/react-native';

import { DigitKeypad } from '../DigitKeypad';

describe('DigitKeypad', () => {
  it('emits the tapped digit', () => {
    const onDigit = jest.fn();
    const onBackspace = jest.fn();
    const { getByLabelText } = render(
      <DigitKeypad onDigit={onDigit} onBackspace={onBackspace} />,
    );
    fireEvent.press(getByLabelText('7'));
    expect(onDigit).toHaveBeenCalledWith(7);
    expect(onBackspace).not.toHaveBeenCalled();
  });

  it('emits backspace from the delete key', () => {
    const onDigit = jest.fn();
    const onBackspace = jest.fn();
    const { getByLabelText } = render(
      <DigitKeypad onDigit={onDigit} onBackspace={onBackspace} />,
    );
    fireEvent.press(getByLabelText('Delete digit'));
    expect(onBackspace).toHaveBeenCalledTimes(1);
    expect(onDigit).not.toHaveBeenCalled();
  });

  it('blocks presses when disabled', () => {
    const onDigit = jest.fn();
    const { getByLabelText } = render(
      <DigitKeypad onDigit={onDigit} onBackspace={jest.fn()} disabled />,
    );
    fireEvent.press(getByLabelText('4'));
    expect(onDigit).not.toHaveBeenCalled();
  });
});
