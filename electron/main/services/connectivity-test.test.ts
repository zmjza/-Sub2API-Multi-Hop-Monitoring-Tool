import { describe, expect, it } from 'vitest';
import {
  chatCompletionsUrl,
  ConnectivityTestRunner,
  redactSecret,
  splitSse,
  textFromSseBlock,
  type ConnectivityEvent,
} from './connectivity-test.js';

const secret = 'sk-live-complete-key-fixture-never-leak';

function sseResponse(chunks: string[], status = 200, contentType = 'text/event-stream') {
  const encoder = new TextEncoder();
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index++]));
    },
  });
  return new Response(stream, { status, headers: { 'content-type': contentType } });
}

describe('connectivity SSE helpers', () => {
  it('extracts chat deltas and ignores done sentinels', () => {
    const parsed = splitSse(
      '',
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n\n',
    );
    expect(parsed.blocks.map((block) => textFromSseBlock(block))).toEqual(['Hi', undefined]);
  });

  it('builds the public chat completions URL from the site origin', () => {
    expect(chatCompletionsUrl('https://api.example.invalid/')).toBe(
      'https://api.example.invalid/v1/chat/completions',
    );
  });
});

describe('ConnectivityTestRunner', () => {
  it('streams deltas, completes, and never emits the raw key', async () => {
    const events: ConnectivityEvent[] = [];
    const runner = new ConnectivityTestRunner(async (url) => {
      expect(String(url)).toBe('https://api.example.invalid/v1/chat/completions');
      return sseResponse([
        'data: {"choices":[{"delta":{"content":"hel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n\ndata: [DONE]\n\n',
      ]);
    }, 1_000);
    const { requestId } = runner.start({
      baseUrl: 'https://api.example.invalid',
      apiKey: secret,
      maskedKey: 'Key · ••••',
      model: 'gpt-5.6-sol',
      prompt: 'hi',
      emit: (event) => events.push(event),
    });
    await runner.wait();
    expect(events[0]).toMatchObject({
      requestId,
      type: 'started',
      maskedKey: 'Key · ••••',
      model: 'gpt-5.6-sol',
    });
    expect(events.map((event) => event.message)).toContain('hel');
    expect(events.map((event) => event.message)).toContain('lo');
    expect(events.at(-1)?.type).toBe('completed');
    expect(JSON.stringify(events)).not.toContain(secret);
    expect(redactSecret('using ' + secret, secret)).toBe('using [redacted]');
  });

  it('drops late deltas after cancel', async () => {
    const events: ConnectivityEvent[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const runner = new ConnectivityTestRunner(async () => {
      await gate;
      return sseResponse(['data: {"choices":[{"delta":{"content":"late"}}]}\n\n']);
    }, 1_000);
    const { requestId } = runner.start({
      baseUrl: 'https://api.example.invalid',
      apiKey: secret,
      maskedKey: 'Key · ••••',
      model: 'gpt-5.6-sol',
      prompt: 'hi',
      emit: (event) => events.push(event),
    });
    expect(runner.cancel(requestId)).toBe(true);
    release();
    await runner.wait();
    expect(events.some((event) => event.type === 'cancelled')).toBe(true);
    expect(events.some((event) => event.message === 'late')).toBe(false);
    expect(JSON.stringify(events)).not.toContain(secret);
  });

  it('maps 401 to a failed auth message without falling back', async () => {
    const events: ConnectivityEvent[] = [];
    const runner = new ConnectivityTestRunner(
      async () => sseResponse(['unauthorized'], 401, 'application/json'),
      1_000,
    );
    runner.start({
      baseUrl: 'https://api.example.invalid',
      apiKey: secret,
      maskedKey: 'Key · ••••',
      model: 'missing',
      prompt: 'hi',
      emit: (event) => events.push(event),
    });
    await runner.wait();
    expect(events.at(-1)).toMatchObject({ type: 'failed', message: '鉴权失败或 Key 无效' });
    expect(JSON.stringify(events)).not.toContain(secret);
  });
});
