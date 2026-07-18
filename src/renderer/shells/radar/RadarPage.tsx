import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Radio, Trophy } from 'lucide-react';
import {
  buildModelRows,
  reasoningLabel,
  type RadarComparison,
  type RadarLatest,
} from './radar-data';
import './radar.css';

const DATA_URL = 'https://codexradar.com/current.json';
const SITE_URL = 'https://codexradar.com/';

type RadarData = {
  monitored_at?: string;
  model_iq?: { latest?: RadarLatest; comparisons?: Record<string, RadarComparison> };
  api_access?: { attribution_text?: string };
  links?: { html?: string };
};

function parseRadarData(value: unknown): RadarData {
  if (!value || typeof value !== 'object') throw new Error('INVALID_RADAR_DATA');
  const record = value as Record<string, unknown>;
  if (
    record.model_iq !== undefined &&
    (typeof record.model_iq !== 'object' || record.model_iq === null)
  )
    throw new Error('INVALID_RADAR_DATA');
  return value as RadarData;
}

function formatTime(value?: string) {
  if (!value) return '暂无';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function recommendation(item: RadarLatest) {
  const score = item.score ?? 0;
  const cost = item.cost_usd ?? 0;
  if (score >= 120)
    return {
      title: '复杂推理 / 核心开发',
      text: '评分高，适合架构设计、疑难排错和长链路任务。成本与耗时通常也更高。',
    };
  if (cost > 0 && score / cost >= 5)
    return {
      title: '日常开发 / 性价比',
      text: '单位成本产出较好，适合日常编码、文档、批量修改和快速迭代。',
    };
  return { title: '通用任务', text: '适合一般问答和中等复杂度工作，建议结合历史稳定性使用。' };
}

export function RadarPage() {
  const [data, setData] = useState<RadarData>();
  const [error, setError] = useState<string>();
  const [fetchedAt, setFetchedAt] = useState<Date>();
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData(parseRadarData(await response.json()));
      setFetchedAt(new Date());
    } catch {
      setError('公开数据读取失败，请检查网络或稍后重试。');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const rows = useMemo(() => buildModelRows(data?.model_iq), [data]);
  const ranked = useMemo(
    () => [...rows].sort((a, b) => (b.latest?.score ?? 0) - (a.latest?.score ?? 0)),
    [rows],
  );
  const valuePick = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          (b.latest?.score ?? 0) / Math.max(b.latest?.cost_usd ?? 1, 0.01) -
          (a.latest?.score ?? 0) / Math.max(a.latest?.cost_usd ?? 1, 0.01),
      )[0],
    [rows],
  );
  const smartest = ranked[0];
  return (
    <div className="radar-page">
      <div className="radar-heading">
        <div>
          <p className="eyebrow">
            <Radio size={15} /> CODEX RADAR
          </p>
          <h1>模型选型雷达</h1>
          <p className="radar-subtitle">读取公开摘要，按评分、成本和耗时给出辅助决策。</p>
        </div>
        <div className="radar-actions">
          <button className="radar-refresh" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            刷新
          </button>
          <a href={SITE_URL} target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            查看原站
          </a>
        </div>
      </div>
      {error && <div className="radar-error">{error}</div>}
      <div className="radar-meta">
        雷达数据时间：<strong>{formatTime(data?.monitored_at)}</strong> · 本机读取：
        {fetchedAt ? formatTime(fetchedAt.toISOString()) : '读取中'} · 来源：
        <a href={SITE_URL} target="_blank" rel="noreferrer">
          codexradar.com
        </a>
      </div>
      {loading && <div className="radar-state">正在读取公开雷达数据…</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="radar-state">暂无可用模型数据。</div>
      )}
      <section className="radar-highlights">
        <article>
          <span>
            <Trophy size={16} />
            当前最聪明
          </span>
          <strong>{smartest?.label ?? '暂无数据'}</strong>
          <small>
            {smartest?.latest?.score ?? '-'} 分 · {smartest?.latest?.passed ?? '-'} /{' '}
            {smartest?.latest?.tasks ?? '-'} 个任务通过
          </small>
        </article>
        <article>
          <span>最具性价比</span>
          <strong>{valuePick?.label ?? '暂无数据'}</strong>
          <small>
            {valuePick
              ? `${valuePick.latest?.score ?? '-'} 分 / $${(valuePick.latest?.cost_usd ?? 0).toFixed(2)}`
              : '-'}
          </small>
        </article>
        <article>
          <span>当前样本</span>
          <strong>{rows.length} 个配置</strong>
          <small>以公开基准摘要计算，不代表所有实际场景</small>
        </article>
      </section>
      <section className="radar-models">
        <div className="radar-panel-title">
          <div>
            <h2>模型配置</h2>
            <span>按公开基准评分和等价成本，选择最适合当前工作的配置</span>
          </div>
          <span className="radar-model-count">{rows.length} 个配置</span>
        </div>
        <div className="radar-card-grid">
          {rows.map((item) => {
            const latest = item.latest!;
            const fit = recommendation(latest);
            const effort = reasoningLabel(latest.reasoning_effort);
            const ratio = latest.cost_usd ? (latest.score ?? 0) / latest.cost_usd : 0;
            const isSmartest = item === smartest;
            const isValue = item === valuePick;
            return (
              <article
                className={`model-card ${isSmartest || isValue ? 'model-card-featured' : ''}`}
                key={item.label}
              >
                <div className="model-card-top">
                  <div>
                    <span className="model-card-kicker">{latest.model ?? 'CODEX MODEL'}</span>
                    <h3>{item.label ?? latest.model ?? '未知模型'}</h3>
                  </div>
                  <span className={`model-status status-${latest.status ?? 'green'}`}>
                    {latest.status === 'red'
                      ? '需关注'
                      : latest.status === 'yellow'
                        ? '观察中'
                        : '稳定'}
                  </span>
                </div>
                <div className="model-badges">
                  <span className="effort-badge">
                    <b>{effort.english}</b>
                    <small>{effort.chinese}</small>
                  </span>
                  {isSmartest && <b>最聪明</b>}
                  {isValue && <b>性价比</b>}
                </div>
                <div className="model-score-row">
                  <div className="model-score">
                    <strong>{latest.score ?? '-'}</strong>
                    <small>IQ 评分</small>
                  </div>
                  <div className="model-pass">
                    <strong>
                      {latest.passed ?? '-'}
                      <em> / {latest.tasks ?? '-'}</em>
                    </strong>
                    <small>任务通过</small>
                  </div>
                  <div className="model-efficiency">
                    <strong>
                      {ratio ? ratio.toFixed(1) : '-'}
                      <em>×</em>
                    </strong>
                    <small>评分 / 美元</small>
                  </div>
                </div>
                <div className="model-stats">
                  <span>
                    <small>等价成本</small>
                    <strong>${(latest.cost_usd ?? 0).toFixed(2)}</strong>
                  </span>
                  <span>
                    <small>测试耗时</small>
                    <strong>
                      {latest.wall_seconds ? `${Math.round(latest.wall_seconds / 60)} 分钟` : '-'}
                    </strong>
                  </span>
                </div>
                <div className="model-fit">
                  <span>推荐工作</span>
                  <strong>{fit.title}</strong>
                  <p>{fit.text}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <p className="radar-disclaimer">
        数据来自 Codex 雷达 codexradar.com。公开摘要可能延迟，推荐仅作选型参考；完整 API
        和二次开发接口需向站方申请授权。
      </p>
    </div>
  );
}
