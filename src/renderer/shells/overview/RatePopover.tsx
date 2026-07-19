import { BadgePercent, RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RateSiteContext } from '../../../../electron/shared/contracts';
import {
  effectiveRate,
  filterRateGroups,
  findPlatformMinima,
  formatRateMultiplier,
  normalizePlatform,
} from './rate-comparison';

export function RatePopover(props: {
  anchor: HTMLElement;
  siteName: string;
  context?: RateSiteContext;
  ratio?: number;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('all');
  const [style, setStyle] = useState<React.CSSProperties>({});
  const groups = props.context?.groups ?? [];
  const minima = useMemo(() => findPlatformMinima(groups, props.ratio), [groups, props.ratio]);
  const platforms = useMemo(
    () =>
      [
        ...new Map(
          groups.map((group) => {
            const value = normalizePlatform(group.platform);
            return [value.key, value] as const;
          }),
        ).values(),
      ].sort((left, right) => left.label.localeCompare(right.label, 'zh-CN')),
    [groups],
  );
  const filtered = useMemo(
    () =>
      filterRateGroups(groups, platform, search)
        .filter((group) => !group.status || group.status === 'active')
        .sort((left, right) => {
          const leftRate = effectiveRate(left.rate, props.ratio) ?? left.rate;
          const rightRate = effectiveRate(right.rate, props.ratio) ?? right.rate;
          return leftRate - rightRate || left.name.localeCompare(right.name, 'zh-CN');
        }),
    [groups, platform, props.ratio, search],
  );

  useLayoutEffect(() => {
    const update = () => {
      const rect = props.anchor.getBoundingClientRect();
      const width = Math.max(0, Math.min(720, window.innerWidth - 32));
      const left = Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16));
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const maxHeight = Math.max(0, Math.min(620, window.innerHeight - 32, Math.max(below, above)));
      const top =
        below >= Math.min(420, maxHeight)
          ? rect.bottom + 8
          : Math.max(16, rect.top - maxHeight - 8);
      setStyle({ width, left, top, maxHeight });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [props.anchor]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !props.anchor.contains(target)) props.onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [props.anchor, props.onClose]);

  return createPortal(
    <div
      ref={panelRef}
      className="rate-popover"
      style={style}
      role="dialog"
      aria-label={`${props.siteName} 分组倍率`}
    >
      <header className="rate-popover-header">
        <div>
          <span>分组倍率</span>
          <strong>{props.siteName}</strong>
        </div>
        <div>
          <button
            type="button"
            aria-label="刷新当前站点倍率"
            title="刷新当前站点倍率"
            onClick={() => void props.onRefresh()}
            disabled={props.refreshing}
          >
            <RefreshCw size={16} className={props.refreshing ? 'spin' : ''} />
          </button>
          <button type="button" aria-label="关闭倍率弹窗" title="关闭" onClick={props.onClose}>
            <X size={17} />
          </button>
        </div>
      </header>

      {props.context?.state === 'error' || props.context?.state === 'auth-required' ? (
        <div className="rate-popover-alert" role="status">
          <span>{props.context.state === 'auth-required' ? '需要重新登录' : '倍率更新失败'}</span>
          {props.context.groups.length > 0 && <small>正在显示上次缓存结果</small>}
        </div>
      ) : null}

      {props.refreshing && groups.length === 0 ? (
        <div className="rate-popover-state" role="status">
          <RefreshCw size={20} className="spin" />
          <span>正在读取分组倍率…</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="rate-popover-state">
          <BadgePercent size={22} />
          <strong>暂无可用分组倍率</strong>
          <button type="button" onClick={() => void props.onRefresh()}>
            重试
          </button>
        </div>
      ) : (
        <>
          <section className="rate-minimum-grid" aria-label="各平台最低倍率">
            {minima.map((minimum) => (
              <article key={minimum.platformKey}>
                <span>{minimum.platformLabel}</span>
                <strong>
                  {minimum.effectiveRate === undefined
                    ? formatRateMultiplier(minimum.comparisonRate)
                    : formatRateMultiplier(minimum.effectiveRate)}
                </strong>
                <small title={minimum.groups.map((group) => group.name).join('、')}>
                  {minimum.groups.map((group) => group.name).join('、')}
                </small>
                {minimum.groups.length > 1 && <i>并列最低</i>}
              </article>
            ))}
          </section>

          <div className="rate-popover-tools">
            <label>
              <Search size={15} />
              <input
                aria-label="搜索分组倍率"
                placeholder="搜索分组名称或描述"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="rate-platform-tabs" role="tablist" aria-label="按平台筛选">
              <button
                type="button"
                className={platform === 'all' ? 'active' : ''}
                onClick={() => setPlatform('all')}
              >
                全部
              </button>
              {platforms.map((item) => (
                <button
                  type="button"
                  className={platform === item.key ? 'active' : ''}
                  key={item.key}
                  onClick={() => setPlatform(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rate-group-list">
            {filtered.length === 0 ? (
              <div className="rate-search-empty">没有匹配的分组</div>
            ) : (
              filtered.map((group) => {
                const normalized = effectiveRate(group.rate, props.ratio);
                return (
                  <article key={`${group.platform}:${group.id}`}>
                    <div>
                      <span>{normalizePlatform(group.platform).label}</span>
                      <strong>{group.name}</strong>
                      {group.description && <p>{group.description}</p>}
                    </div>
                    <div className="rate-group-values">
                      <span>原始 {formatRateMultiplier(group.rate)}</span>
                      <strong>
                        {normalized === undefined
                          ? '折算待设置'
                          : `折算 ${formatRateMultiplier(normalized)}`}
                      </strong>
                    </div>
                  </article>
                );
              })
            )}
          </div>
          <footer className="rate-popover-footer">
            <span>
              {props.ratio === undefined ? '充值比例待设置' : `充值比例 1:${props.ratio}`}
            </span>
            <span>
              {props.context?.fetchedAt
                ? `更新于 ${new Date(props.context.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : '尚未更新'}
            </span>
          </footer>
        </>
      )}
    </div>,
    document.body,
  );
}
