import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { formatTokenCount } from '../../lib/format';
import type { FloatingProps } from './types';
import { floatingSnapshot as data } from './data';
import './floating.css';

export function FloatingWindow(props: FloatingProps) {
  const runtime = Boolean(window.sub2apiDesktop);
  const busy = props.state === 'loading' || props.state === 'refreshing';
  const failed =
    props.state === 'error' || props.state === 'auth-required' || props.state === 'unsupported';
  const liveBalance = props.selectedSite?.balance;
  const estimate = props.selectedSite?.estimatedDurationMs ?? [3000, 5000];
  const phaseLabel =
    (
      {
        profile: '余额',
        keys: 'API Key',
        groups: '分组',
        rates: '倍率',
        usage: '今日统计',
      } as Record<string, string>
    )[props.queryPhase ?? ''] ?? '站点数据';
  const title = busy
    ? '正在查余额，先让 Codex 蹬一会儿… ⏳'
    : liveBalance === undefined
      ? '尚无余额数据'
      : liveBalance >= 2
        ? '这么有钱，就使劲蹬 Codex，别浪费！💸'
        : '快没钱了，赶紧充钱，别让天才程序员陨落！🥲';
  return (
    <main className={`floating-window state-${props.state}`}>
      <header className="floating-header">
        <button aria-label="上一个站点" onClick={props.onPreviousSite}>
          <ArrowLeft size={16} />
        </button>
        <strong title={props.selectedSite?.name ?? data.siteName}>
          {props.selectedSite?.name ?? data.siteName}
        </strong>
        <button aria-label="下一个站点" onClick={props.onNextSite}>
          <ArrowRight size={16} />
        </button>
      </header>
      <div className="floating-title" title={title}>
        {title}
      </div>
      {busy && (
        <div className="query-status">
          <LoaderCircle size={15} className="spin" />
          正在查询{phaseLabel} · 预计 {Math.max(1, Math.round(estimate[0] / 1000))}–
          {Math.max(1, Math.round(estimate[1] / 1000))} 秒
        </div>
      )}
      {failed && (
        <div className="query-status error">
          <RefreshCw size={15} />
          保留上次成功数据 · {props.state}
        </div>
      )}
      <section className="floating-balance">
        <span>
          {props.selectedSite?.balance !== undefined
            ? `$${props.selectedSite.balance.toFixed(2)}`
            : runtime
              ? '—'
              : data.balance}
        </span>
        <em>
          {props.selectedSite?.rate !== undefined
            ? `${props.selectedSite.rate}x`
            : runtime
              ? '倍率不可用'
              : data.rate}
        </em>
      </section>
      <small className="floating-key">
        {props.selectedSite?.defaultKeyLabel ?? (runtime ? '尚未选择站点' : data.keyLabel)}
      </small>
      <div className="floating-metrics">
        <span>
          今日 Token
          <b>
            {props.selectedSite?.todayTokens !== undefined
              ? formatTokenCount(props.selectedSite.todayTokens)
              : runtime
                ? '—'
                : data.todayTokens}
          </b>
        </span>
        <span>
          今日消费
          <b>
            {props.selectedSite?.todayActualCost !== undefined
              ? `$${props.selectedSite.todayActualCost.toFixed(4)}`
              : runtime
                ? '—'
                : data.todayCost}
          </b>
        </span>
      </div>
      <footer>
        <details className="floating-settings">
          <summary aria-label="悬浮窗设置">
            <Settings size={15} />
          </summary>
          <label>
            固定位置
            <select
              value={props.floatingPosition ?? 'top-right'}
              onChange={(event) =>
                props.onFloatingPositionChange?.(
                  event.target.value as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
                )
              }
            >
              <option value="top-left">左上角</option>
              <option value="top-right">右上角</option>
              <option value="bottom-left">左下角</option>
              <option value="bottom-right">右下角</option>
            </select>
          </label>
        </details>
        <span className={`floating-live-state state-${props.state}`}>
          <i />
          {props.state === 'success'
            ? '正常'
            : props.state === 'stale'
              ? '缓存数据 · 过期'
              : props.state === 'refreshing' || props.state === 'loading'
                ? '更新中'
                : props.state === 'error'
                  ? '查询失败'
                  : props.state}
          {props.selectedSite?.fetchedAt
            ? ` · ${new Date(props.selectedSite.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : ''}
        </span>
        <button aria-label="打开主页面" onClick={props.onOpenSite}>
          <ExternalLink size={15} />
        </button>
      </footer>
    </main>
  );
}
