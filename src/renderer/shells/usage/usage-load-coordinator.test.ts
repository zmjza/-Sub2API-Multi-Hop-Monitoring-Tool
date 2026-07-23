import { describe, expect, it } from 'vitest';
import { UsageLoadCoordinator } from './usage-load-coordinator';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('UsageLoadCoordinator', () => {
  it('commits list and server stats together for the newest query only', async () => {
    const oldList = deferred<string>();
    const oldStats = deferred<string>();
    const commits: string[][] = [];
    const coordinator = new UsageLoadCoordinator();

    const oldRequest = coordinator.load(
      () => oldList.promise,
      () => oldStats.promise,
      (list, stats) => commits.push([list, stats]),
    );
    const newRequest = coordinator.load(
      async () => 'new-list',
      async () => 'new-stats',
      (list, stats) => commits.push([list, stats]),
    );
    await newRequest;
    oldList.resolve('old-list');
    oldStats.resolve('old-stats');
    await oldRequest;

    expect(commits).toEqual([['new-list', 'new-stats']]);
  });

  it('invalidates an in-flight request when the selected site changes', async () => {
    const list = deferred<string>();
    const stats = deferred<string>();
    const commits: string[][] = [];
    const coordinator = new UsageLoadCoordinator();

    const request = coordinator.load(
      () => list.promise,
      () => stats.promise,
      (nextList, nextStats) => commits.push([nextList, nextStats]),
    );
    coordinator.invalidate();
    list.resolve('list');
    stats.resolve('stats');
    await request;

    expect(commits).toEqual([]);
  });
});
