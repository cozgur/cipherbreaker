/**
 * Snapshot + behaviour tests for every per-mode guess row. Snapshots
 * cover the happy-path layout; targeted assertions cover mode-specific
 * feedback rendering (Higher/Lower pill, precision counter, etc.).
 */

import { render } from '@testing-library/react-native';

import type { GuessRowProps } from '@game/types';
import { Mode1Row, Mode2Row, Mode3Row, Mode4Row, Mode5Row, Mode6Row, Mode7Row } from '../index';

const colorMatch: GuessRowProps = {
  side: 'left',
  avatar: 'Nova',
  digits: [
    { val: 3, state: 'green' },
    { val: 7, state: 'gray' },
    { val: 2, state: 'yellow' },
    { val: 9, state: 'gray' },
  ],
  feedback: { kind: 'colorMatch', states: ['green', 'gray', 'yellow', 'gray'] },
};

describe('Mode1Row', () => {
  it('snapshots the left-side color-match row', () => {
    expect(render(<Mode1Row {...colorMatch} />).toJSON()).toMatchSnapshot();
  });

  it('snapshots the right-side variant', () => {
    expect(
      render(<Mode1Row {...colorMatch} side="right" avatar="Shadow" />).toJSON(),
    ).toMatchSnapshot();
  });
});

describe('Mode2Row', () => {
  const base: GuessRowProps = {
    side: 'left',
    avatar: 'Nova',
    digits: [
      { val: 5, state: 'neutral' },
      { val: 0, state: 'neutral' },
      { val: 0, state: 'neutral' },
      { val: 0, state: 'neutral' },
    ],
    feedback: { kind: 'direction', dir: 'lower' },
  };

  it('renders the lower pill with its ▼ glyph', () => {
    const { getByText } = render(<Mode2Row {...base} />);
    expect(getByText(/Lower/)).toBeTruthy();
  });

  it('renders the higher pill with its ▲ glyph', () => {
    const { getByText } = render(
      <Mode2Row {...base} feedback={{ kind: 'direction', dir: 'higher' }} />,
    );
    expect(getByText(/Higher/)).toBeTruthy();
  });

  it('snapshots the row', () => {
    expect(render(<Mode2Row {...base} />).toJSON()).toMatchSnapshot();
  });
});

describe('Mode3Row', () => {
  const base: GuessRowProps = {
    side: 'left',
    avatar: 'Nova',
    digits: [
      { val: 3, state: 'neutral' },
      { val: 7, state: 'neutral' },
      { val: 2, state: 'neutral' },
      { val: 9, state: 'neutral' },
    ],
    feedback: { kind: 'precision', plus: 1, minus: 2 },
  };

  it('shows +N and −M counters', () => {
    const { getByText } = render(<Mode3Row {...base} />);
    expect(getByText('+1')).toBeTruthy();
    expect(getByText('−2')).toBeTruthy();
  });

  it('snapshots the row', () => {
    expect(render(<Mode3Row {...base} />).toJSON()).toMatchSnapshot();
  });
});

describe('Mode4Row', () => {
  const base: GuessRowProps = {
    ...colorMatch,
    extra: '0:08s',
  };

  it('renders the elapsed extra label', () => {
    const { getByText } = render(<Mode4Row {...base} />);
    expect(getByText('0:08s')).toBeTruthy();
  });

  it('snapshots the row', () => {
    expect(render(<Mode4Row {...base} />).toJSON()).toMatchSnapshot();
  });
});

describe('Mode5Row', () => {
  const locked: GuessRowProps = {
    side: 'left',
    avatar: 'Nova',
    digits: [
      { val: 3, state: 'green' },
      { val: 4, state: 'blackout' },
      { val: 2, state: 'green' },
      { val: 6, state: 'blackout' },
    ],
    feedback: {
      kind: 'blackout',
      states: ['green', 'blackout', 'green', 'blackout'],
      locked: 2,
    },
  };

  it('renders the N LOCKED pill', () => {
    const { getByText } = render(<Mode5Row {...locked} />);
    expect(getByText('2 LOCKED')).toBeTruthy();
  });

  it('falls back to NONE when locked count is zero', () => {
    const { getByText } = render(
      <Mode5Row
        {...locked}
        feedback={{
          kind: 'blackout',
          states: ['blackout', 'blackout', 'blackout', 'blackout'],
          locked: 0,
        }}
      />,
    );
    expect(getByText('NONE')).toBeTruthy();
  });

  it('snapshots the row', () => {
    expect(render(<Mode5Row {...locked} />).toJSON()).toMatchSnapshot();
  });
});

describe('Mode6Row', () => {
  const base: GuessRowProps = { ...colorMatch, extra: '3/5' };

  it('renders the N/5 extra label', () => {
    const { getByText } = render(<Mode6Row {...base} />);
    expect(getByText('3/5')).toBeTruthy();
  });

  it('snapshots the row', () => {
    expect(render(<Mode6Row {...base} />).toJSON()).toMatchSnapshot();
  });
});

describe('Mode7Row', () => {
  it('always renders on the left side regardless of incoming side prop', () => {
    const tree = render(<Mode7Row {...colorMatch} side="right" />).toJSON();
    // Snapshot locks the forced-left layout in place — if Phase 6
    // introduces a right-side mirror variant, this snapshot updates.
    expect(tree).toMatchSnapshot();
  });
});
