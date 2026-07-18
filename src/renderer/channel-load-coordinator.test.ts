import { describe, expect, it } from 'vitest';
import { ChannelLoadCoordinator } from './channel-load-coordinator';

describe('ChannelLoadCoordinator', () => {
  it('allows independent sites to have current requests at the same time', () => {
    const coordinator = new ChannelLoadCoordinator();
    const firstSite = coordinator.begin('site-a');
    const secondSite = coordinator.begin('site-b');

    expect(coordinator.isCurrent(firstSite, 'site-a')).toBe(true);
    expect(coordinator.isCurrent(secondSite, 'site-b')).toBe(true);
  });

  it('rejects an older response after a newer request starts for that site', () => {
    const coordinator = new ChannelLoadCoordinator();
    const older = coordinator.begin('site-a');
    const newer = coordinator.begin('site-a');

    expect(coordinator.isCurrent(older, 'site-a')).toBe(false);
    expect(coordinator.isCurrent(newer, 'site-a')).toBe(true);
  });

  it('rejects a response when the user has switched to another site', () => {
    const coordinator = new ChannelLoadCoordinator();
    const request = coordinator.begin('site-a');

    expect(coordinator.isCurrent(request, 'site-b')).toBe(false);
  });
});
