import { describe, expect, it } from 'vitest';
import { buildModelRows, reasoningLabel } from './radar-data';

describe('buildModelRows', () => {
  it('includes the primary max result with the comparison configurations', () => {
    const rows = buildModelRows({
      latest: { model: 'gpt-5.6-sol', reasoning_effort: 'max', score: 120 },
      comparisons: {
        sol_high: {
          label: 'GPT-5.6 Sol high',
          latest: { model: 'gpt-5.6-sol', reasoning_effort: 'high', score: 105 },
        },
      },
    });

    expect(rows.map((row) => row.label)).toEqual(['GPT-5.6 Sol max', 'GPT-5.6 Sol high']);
  });

  it('does not duplicate the primary result when comparisons already contain it', () => {
    const latest = { model: 'gpt-5.6-sol', reasoning_effort: 'max', score: 120 };
    const rows = buildModelRows({
      latest,
      comparisons: { sol_max: { label: 'GPT-5.6 Sol max', latest } },
    });

    expect(rows).toHaveLength(1);
  });

  it('keeps the API effort value and provides its Chinese label', () => {
    expect(reasoningLabel('low')).toEqual({ english: 'low', chinese: '轻度' });
    expect(reasoningLabel('medium')).toEqual({ english: 'medium', chinese: '中' });
    expect(reasoningLabel('high')).toEqual({ english: 'high', chinese: '高' });
    expect(reasoningLabel('xhigh')).toEqual({ english: 'xhigh', chinese: '极高' });
    expect(reasoningLabel('max')).toEqual({ english: 'max', chinese: '最高' });
  });
});
