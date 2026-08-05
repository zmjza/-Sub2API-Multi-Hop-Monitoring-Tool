import { ArrowUpRight, Globe, Radio } from 'lucide-react';
import {
  RADAR_TARGET_IDS,
  RADAR_TARGETS,
  type RadarEmbedState,
  type RadarTargetId,
} from './radar-data';
import './radar.css';

type RadarPageProps = {
  embedState: RadarEmbedState;
  onOpen: (targetId: RadarTargetId) => void;
};

export function RadarPage({ embedState, onOpen }: RadarPageProps) {
  if (embedState.status === 'error')
    return (
      <div className="radar-page radar-page-state" data-radar-state="error">
        <div className="radar-state-icon" aria-hidden="true">
          <Globe size={22} />
        </div>
        <h1>雷达网页暂时无法加载</h1>
        <p>{embedState.message}</p>
        <span>请点击右上角关闭图标返回雷达入口。</span>
      </div>
    );

  if (embedState.status === 'opening')
    return (
      <div className="radar-page radar-page-state" data-radar-state="opening" role="status">
        <div className="radar-state-icon radar-state-icon-loading" aria-hidden="true">
          <Radio size={22} />
        </div>
        <h1>正在打开 {RADAR_TARGETS[embedState.target].label}</h1>
        <p>网页将在当前 Electron 窗口内显示。</p>
      </div>
    );

  if (embedState.status === 'open')
    return (
      <div className="radar-page radar-page-state" data-radar-state="open" aria-hidden="true">
        <div className="radar-state-icon" aria-hidden="true">
          <Radio size={22} />
        </div>
        <h1>{RADAR_TARGETS[embedState.target].label}</h1>
      </div>
    );

  return (
    <div className="radar-page" data-radar-state="idle">
      <header className="radar-heading">
        <div>
          <p className="radar-eyebrow">
            <Radio size={15} aria-hidden="true" /> CODEX RADAR
          </p>
          <h1>雷达</h1>
          <p className="radar-subtitle">选择要打开的雷达站点</p>
        </div>
      </header>
      <section className="radar-target-grid" aria-label="雷达站点">
        {RADAR_TARGET_IDS.map((targetId) => {
          const target = RADAR_TARGETS[targetId];
          return (
            <button
              className="radar-target-card"
              type="button"
              key={targetId}
              aria-label={target.label}
              onClick={() => onOpen(targetId)}
            >
              <span className="radar-target-card-icon" aria-hidden="true">
                <Radio size={22} />
              </span>
              <span className="radar-target-card-copy">
                <strong>{target.label}</strong>
                <small>{new URL(target.url).hostname}</small>
              </span>
              <ArrowUpRight className="radar-target-card-arrow" size={20} aria-hidden="true" />
            </button>
          );
        })}
      </section>
    </div>
  );
}
