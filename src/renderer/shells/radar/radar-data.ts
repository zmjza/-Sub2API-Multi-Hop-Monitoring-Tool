export type RadarLatest = {
  score?: number;
  passed?: number;
  tasks?: number;
  cost_usd?: number;
  wall_seconds?: number;
  status?: string;
  model?: string;
  reasoning_effort?: string;
};

export type RadarComparison = { label?: string; latest?: RadarLatest };

export function reasoningLabel(value?: string): { english: string; chinese: string } {
  const english = value || 'default';
  const labels: Record<string, string> = {
    low: '轻度',
    medium: '中',
    high: '高',
    xhigh: '极高',
    max: '最高',
  };
  return { english, chinese: labels[english] ?? '默认' };
}

export function buildModelRows(modelIq?: {
  latest?: RadarLatest;
  comparisons?: Record<string, RadarComparison>;
}): RadarComparison[] {
  const comparisons = Object.values(modelIq?.comparisons ?? {}).filter((item) => item.latest);
  const primary = modelIq?.latest;
  if (!primary) return comparisons;

  const duplicate = comparisons.some(
    (item) =>
      item.latest?.model === primary.model &&
      item.latest?.reasoning_effort === primary.reasoning_effort,
  );
  if (duplicate) return comparisons;

  const modelName = (primary.model ?? 'Codex model')
    .split('-')
    .map((part, index) =>
      index === 0 ? part.toUpperCase() : part[0]?.toUpperCase() + part.slice(1),
    )
    .join('-');
  return [
    {
      label:
        `${modelName.replace('GPT-', 'GPT-').replace('-Sol', ' Sol')} ${primary.reasoning_effort ?? ''}`.trim(),
      latest: primary,
    },
    ...comparisons,
  ];
}
