import { describe, expect, it } from 'vitest';
import { createAsyncQuitHandler } from './app-shutdown.js';

describe('async application quit handler', () => {
  it('holds the first quit event until cleanup resolves and lets the second event continue', async () => {
    let resolveCleanup!: () => void;
    const cleanup = new Promise<void>((resolve) => {
      resolveCleanup = resolve;
    });
    let cleanupCalls = 0;
    let quitCalls = 0;
    let prevented = 0;
    const handleQuit = createAsyncQuitHandler(
      async () => {
        cleanupCalls += 1;
        await cleanup;
      },
      () => {
        quitCalls += 1;
      },
    );
    const event = { preventDefault: () => (prevented += 1) };

    handleQuit(event);
    handleQuit(event);
    await Promise.resolve();
    expect({ cleanupCalls, quitCalls, prevented }).toEqual({
      cleanupCalls: 1,
      quitCalls: 0,
      prevented: 1,
    });

    resolveCleanup();
    await new Promise((resolve) => setImmediate(resolve));
    expect({ cleanupCalls, quitCalls, prevented }).toEqual({
      cleanupCalls: 1,
      quitCalls: 1,
      prevented: 1,
    });
  });
});
