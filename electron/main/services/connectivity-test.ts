import { randomUUID } from 'node:crypto';

export type ConnectivityEventType = 'started' | 'delta' | 'completed' | 'failed' | 'cancelled';

export interface ConnectivityEvent {
  requestId: string;
  type: ConnectivityEventType;
  message?: string;
  maskedKey?: string;
  model?: string;
}

export interface ConnectivityStartInput {
  siteId: string;
  keyId: string;
  model: string;
  prompt: string;
}

export function splitSse(buffer: string, chunk: string): { rest: string; blocks: string[] } {
  const text = buffer + chunk.replace(/\r\n/g, '\n');
  const parts = text.split('\n\n');
  return { rest: parts.pop() ?? '', blocks: parts.filter((block) => block.trim()) };
}

export function textFromSseBlock(block: string): string | undefined {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('');
  if (!data || data === '[DONE]') return undefined;
  try {
    return textFromJsonCompletion(JSON.parse(data));
  } catch {
    return undefined;
  }
}

export function textFromJsonCompletion(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const record = raw as Record<string, unknown>;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const first = asRecord(choices[0]);
  const delta = asRecord(first?.delta);
  const message = asRecord(first?.message);
  const content = delta?.content ?? message?.content;
  return typeof content === 'string' && content ? content : undefined;
}

export function redactSecret(text: string, secret: string): string {
  return secret ? text.split(secret).join('[redacted]') : text;
}

export class ConnectivityTestRunner {
  private active?: { requestId: string; abort: AbortController };
  private pending?: Promise<void>;

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 30_000,
  ) {}

  cancel(requestId?: string): boolean {
    if (!this.active) return false;
    if (requestId && this.active.requestId !== requestId) return false;
    this.active.abort.abort('cancelled');
    return true;
  }

  start(input: {
    baseUrl: string;
    apiKey: string;
    maskedKey: string;
    model: string;
    prompt: string;
    emit: (event: ConnectivityEvent) => void;
  }): { requestId: string } {
    if (this.active) {
      const previous = this.active;
      previous.abort.abort('replaced');
      input.emit({ requestId: previous.requestId, type: 'cancelled', message: '已被新的测试取代' });
    }
    const requestId = randomUUID();
    const abort = new AbortController();
    this.active = { requestId, abort };
    this.pending = this.run(requestId, abort, input);
    return { requestId };
  }

  wait(): Promise<void> {
    return this.pending ?? Promise.resolve();
  }

  private async run(
    requestId: string,
    abort: AbortController,
    input: {
      baseUrl: string;
      apiKey: string;
      maskedKey: string;
      model: string;
      prompt: string;
      emit: (event: ConnectivityEvent) => void;
    },
  ): Promise<void> {
    const emit = (event: ConnectivityEvent) => {
      if (this.active?.requestId !== requestId && event.type !== 'cancelled') return;
      input.emit(event);
    };
    const timer = setTimeout(() => abort.abort('timeout'), this.timeoutMs);
    const startedAt = Date.now();
    emit({
      requestId,
      type: 'started',
      maskedKey: input.maskedKey,
      model: input.model,
      message: '开始测试。测试会产生一次真实请求。',
    });
    try {
      const response = await this.fetchImpl(chatCompletionsUrl(input.baseUrl), {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + input.apiKey,
          'content-type': 'application/json',
          accept: 'text/event-stream',
        },
        body: JSON.stringify({
          model: input.model,
          stream: true,
          messages: [{ role: 'user', content: input.prompt }],
        }),
        signal: abort.signal,
      });
      if (abort.signal.aborted || this.active?.requestId !== requestId) {
        if (this.active?.requestId === requestId && abort.signal.aborted) {
          emit({
            requestId,
            type: abort.signal.reason === 'timeout' ? 'failed' : 'cancelled',
            message: abort.signal.reason === 'timeout' ? '测试超时' : '已取消',
          });
        }
        return;
      }
      if (!response.ok) {
        const body = redactSecret(await safeText(response), input.apiKey);
        emit({ requestId, type: 'failed', message: httpErrorMessage(response.status, body) });
        return;
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/event-stream')) {
        const raw = await safeJson(response);
        const text =
          textFromJsonCompletion(raw) ?? redactSecret(JSON.stringify(raw ?? {}), input.apiKey);
        emit({ requestId, type: 'delta', message: text });
        emit({
          requestId,
          type: 'completed',
          message: '测试完成，耗时 ' + formatDuration(Date.now() - startedAt),
        });
        return;
      }
      const reader = response.body?.getReader();
      if (!reader) {
        emit({ requestId, type: 'failed', message: '上游没有返回可读内容' });
        return;
      }
      const decoder = new TextDecoder();
      let buffer = '';
      while (this.active?.requestId === requestId) {
        const { done, value } = await reader.read();
        if (done) break;
        const parsed = splitSse(buffer, decoder.decode(value, { stream: true }));
        buffer = parsed.rest;
        for (const block of parsed.blocks) {
          const delta = textFromSseBlock(block);
          if (delta) emit({ requestId, type: 'delta', message: delta });
        }
      }
      if (this.active?.requestId !== requestId) return;
      const trailing = textFromSseBlock(buffer);
      if (trailing) emit({ requestId, type: 'delta', message: trailing });
      emit({
        requestId,
        type: 'completed',
        message: '测试完成，耗时 ' + formatDuration(Date.now() - startedAt),
      });
    } catch (error) {
      if (this.active?.requestId !== requestId) return;
      if (abort.signal.aborted) {
        emit({
          requestId,
          type: abort.signal.reason === 'timeout' ? 'failed' : 'cancelled',
          message: abort.signal.reason === 'timeout' ? '测试超时' : '已取消',
        });
        return;
      }
      emit({
        requestId,
        type: 'failed',
        message: redactSecret(errorMessage(error), input.apiKey),
      });
    } finally {
      clearTimeout(timer);
      if (this.active?.requestId === requestId) this.active = undefined;
    }
  }
}

export function chatCompletionsUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '') + '/v1/chat/completions';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function httpErrorMessage(status: number, body: string): string {
  if (status === 401 || status === 403) return '鉴权失败或 Key 无效';
  if (status === 429) return '请求过于频繁，请稍后再试';
  if (status === 404) return '接口或模型不存在';
  return body.trim()
    ? '上游返回 ' + String(status) + '：' + body.slice(0, 180)
    : '上游返回 ' + String(status);
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '连接失败';
}

function formatDuration(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(2) + 's';
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
