import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { InfoModal } from './InfoModal';

describe('InfoModal', () => {
  it('renders instructional content when visible', async () => {
    const { getByText } = await render(
      <InfoModal visible={true} onClose={jest.fn()} />,
    );

    expect(getByText('HOW TO PLAY')).toBeTruthy();
    expect(getByText(/Use the D-Pad to steer the snake/)).toBeTruthy();
    expect(getByText(/Feeling stressed\? Flip on FIDGET mode!/)).toBeTruthy();
    expect(getByText('GOT IT')).toBeTruthy();
  });

  it('calls onClose when the close button is pressed', async () => {
    const onClose = jest.fn();
    const { getByText } = await render(
      <InfoModal visible={true} onClose={onClose} />,
    );

    fireEvent.press(getByText('GOT IT'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
