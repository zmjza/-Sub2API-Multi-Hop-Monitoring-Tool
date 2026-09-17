import { useEffect, useRef, useState } from 'react';
import { Play, X } from 'lucide-react';
import { resolveEffectiveKey } from './current-key-stats';
import type { ConnectivityEvent } from '../../../../electron/shared/contracts';

export interface ConnectivityKeyOption {
  id: string;
  maskedLabel: string;
  status: string;
}

export function defaultConnectivityKeyId(
  keys: ConnectivityKeyOption[],
  preference: { mode: 'auto' | 'manual'; keyId?: string },
  effectiveKeyId?: string,
): string {
  const active = keys.filter((key) => key.status === 'active');
  return resolveEffectiveKey(active, preference, effectiveKeyId)?.id ?? active[0]?.id ?? '';
}

export function canStartConnectivityTest(keyId: string, model: string, running: boolean): boolean {
  return Boolean(keyId && model && !running);
}

export type ConnectivityPanelState =
  'idle' | 'waiting' | 'streaming' | 'success' | 'failed' | 'timeout-failed' | 'cancelled';

export function connectivityPanelState(event: {
  type: string;
  message?: string;
}): ConnectivityPanelState {
  if (event.type === 'started') return 'waiting';
  if (event.type === 'delta') return 'streaming';
  if (event.type === 'completed') return 'success';
  if (event.type === 'cancelled') return 'cancelled';
  if (event.type === 'failed' && (event.message ?? '').includes('测试超时'))
    return 'timeout-failed';
  if (event.type === 'failed') return 'failed';
  return 'idle';
}

export function ConnectivityTestModal(props: {
  siteId: string;
  siteName: string;
  siteStatus: string;
  keys: ConnectivityKeyOption[];
  preference: { mode: 'auto' | 'manual'; keyId?: string };
  effectiveKeyId?: string;
  onClose(): void;
}) {
  const activeKeys = props.keys.filter((key) => key.status === 'active');
  const [keyId, setKeyId] = useState(() =>
    defaultConnectivityKeyId(props.keys, props.preference, props.effectiveKeyId),
  );
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [prompt, setPrompt] = useState('hi');
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[]>(['准备测试。点击“开始测试”按钮开始...']);
  const [panelState, setPanelState] = useState<ConnectivityPanelState>('idle');
  const requestIdRef = useRef<string | undefined>(undefined);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let cancelled = false;
    const desktop = window.sub2apiDesktop;
    if (!desktop) {
      setModels(['gpt-5.6-sol']);
      setModel('gpt-5.6-sol');
      return;
    }
    setModels([]);
    setModel('');
    void desktop.sites
      .keyModels({ siteId: props.siteId, keyId })
      .then((value) => {
        if (cancelled) return;
        const next = Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
        setModels(next);
        setModel(next[0] ?? '');
      })
      .catch(() => {
        if (cancelled) return;
        setModels([]);
        setModel('');
      });
    return () => {
      cancelled = true;
    };
  }, [props.siteId, keyId]);

  useEffect(() => {
    const desktop = window.sub2apiDesktop;
    if (!desktop) return;
    return desktop.sites.onConnectivityEvent((event) => {
      if (event.requestId !== requestIdRef.current) return;
      setPanelState(connectivityPanelState(event));
      appendEvent(event, setLines, setRunning);
    });
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [lines]);

  useEffect(
    () => () => {
      const requestId = requestIdRef.current;
      if (requestId) void window.sub2apiDesktop?.sites.cancelConnectivityTest(requestId);
    },
    [],
  );

  const selected = activeKeys.find((key) => key.id === keyId);

  async function start() {
    if (!canStartConnectivityTest(keyId, model, running)) return;
    const desktop = window.sub2apiDesktop;
    setRunning(true);
    setPanelState('waiting');
    setLines([
      '开始测试。测试会产生一次真实请求。',
      'Key：' + (selected?.maskedLabel ?? keyId),
      '模型：' + model,
    ]);
    if (!desktop) {
      setLines((current) => current.concat(['预览模式，未发送真实请求。']));
      setRunning(false);
      setPanelState('cancelled');
      return;
    }
    try {
      const result = await desktop.sites.startConnectivityTest({
        siteId: props.siteId,
        keyId,
        model,
        prompt: prompt.trim() || 'hi',
      });
      requestIdRef.current = result.requestId;
    } catch (error) {
      requestIdRef.current = undefined;
      setRunning(false);
      setPanelState('failed');
      setLines((current) =>
        current.concat([error instanceof Error ? error.message : '启动测试失败']),
      );
    }
  }

  function close() {
    const requestId = requestIdRef.current;
    if (requestId) void window.sub2apiDesktop?.sites.cancelConnectivityTest(requestId);
    props.onClose();
  }

  return (
    <div className="connectivity-dialog-backdrop" onClick={close} role="presentation">
      <div
        className="connectivity-dialog"
        role="dialog"
        aria-labelledby="connectivity-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="connectivity-dialog-title">测试账号连接</h2>
          <button type="button" aria-label="关闭" onClick={close}>
            <X size={16} />
          </button>
        </header>
        <div className="connectivity-site-card">
          <span className="connectivity-site-icon">
            <Play size={16} />
          </span>
          <div>
            <strong>{props.siteName}</strong>
            <small>APIKEY 账号</small>
          </div>
          <em>
            {props.siteStatus === 'success' || props.siteStatus === '正常'
              ? 'active'
              : props.siteStatus}
          </em>
        </div>
        <p className="connectivity-warning">测试会产生一次真实请求，并可能计入所选 Key 的用量。</p>
        <label>
          选择 Key
          <select
            className="select-field"
            value={keyId}
            onChange={(event) => setKeyId(event.target.value)}
          >
            {activeKeys.length === 0 ? <option value="">没有可用 Key</option> : null}
            {activeKeys.map((key) => (
              <option value={key.id} key={key.id}>
                {key.maskedLabel}
              </option>
            ))}
          </select>
        </label>
        <label>
          选择测试模型
          <select
            className="select-field"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            disabled={models.length === 0}
          >
            {models.length === 0 ? <option value="">没有可用模型</option> : null}
            {models.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          提示词
          <input
            className="select-field"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>
        <pre className="connectivity-log" ref={logRef} data-state={panelState}>
          {lines.map((line, index) => (
            <span key={index}>{'▶ ' + line}</span>
          ))}
        </pre>
        <footer>
          <button type="button" onClick={close}>
            关闭
          </button>
          <button
            type="button"
            className="connectivity-start"
            onClick={() =>
              void (running
                ? window.sub2apiDesktop?.sites.cancelConnectivityTest(requestIdRef.current ?? '')
                : start())
            }
            disabled={!running && !canStartConnectivityTest(keyId, model, running)}
          >
            <Play size={14} />
            {running ? '取消测试' : '开始测试'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function appendEvent(
  event: ConnectivityEvent,
  setLines: (update: (current: string[]) => string[]) => void,
  setRunning: (value: boolean) => void,
) {
  if (event.type === 'delta' && event.message) {
    setLines((current) => appendDelta(current, event.message!));
    return;
  }
  if (event.message) setLines((current) => current.concat([event.message!]));
  if (event.type === 'completed' || event.type === 'failed' || event.type === 'cancelled') {
    setRunning(false);
  }
}

function appendDelta(lines: string[], delta: string): string[] {
  const prefix = '响应：';
  const last = lines[lines.length - 1];
  if (last?.startsWith(prefix)) {
    return lines.slice(0, -1).concat([last + delta]);
  }
  return lines.concat([prefix + delta]);
}
