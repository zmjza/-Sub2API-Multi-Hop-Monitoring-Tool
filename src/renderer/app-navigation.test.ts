import { describe, expect, it } from 'vitest';
import { canSwitchSub2ApiServer } from './app-navigation';

describe('Sub2API server switching', () => {
  it('allows switching away from an already open server', () => {
    expect(canSwitchSub2ApiServer({ status: 'open', target: { id: 'server-a' } }, 'server-b')).toBe(
      true,
    );
  });

  it('blocks duplicate switches but allows replacing an opening target', () => {
    expect(canSwitchSub2ApiServer({ status: 'open', target: { id: 'server-a' } }, 'server-a')).toBe(
      false,
    );
    expect(
      canSwitchSub2ApiServer({ status: 'opening', target: { id: 'server-a' } }, 'server-b'),
    ).toBe(true);
  });
});
