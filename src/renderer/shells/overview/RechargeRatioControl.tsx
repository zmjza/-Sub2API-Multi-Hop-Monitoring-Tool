import { Calculator, Check, X } from 'lucide-react';
import { useState } from 'react';
import { parseRechargeRatio } from './rate-comparison';

const PRESET_RATIOS = [1, 5, 8, 10] as const;

export function RechargeRatioControl(props: {
  siteName: string;
  ratio?: number;
  onChange?: (ratio: number) => Promise<void>;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const preset = PRESET_RATIOS.includes(props.ratio as (typeof PRESET_RATIOS)[number]);
  const value = props.ratio === undefined ? '' : preset ? String(props.ratio) : 'custom';

  const save = async (ratio: number) => {
    if (!props.onChange) return;
    setSaving(true);
    setError('');
    try {
      await props.onChange(ratio);
      setCustomOpen(false);
    } catch {
      setError('比例保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="recharge-ratio-control"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <label>
        <Calculator size={14} />
        <select
          aria-label={`${props.siteName} 充值比例`}
          value={customOpen ? 'custom' : value}
          disabled={saving}
          onChange={(event) => {
            if (event.target.value === 'custom') {
              setDraft(props.ratio === undefined ? '' : String(props.ratio));
              setError('');
              setCustomOpen(true);
              return;
            }
            const ratio = parseRechargeRatio(event.target.value);
            if (ratio !== undefined) void save(ratio);
          }}
        >
          <option value="">充值比例：待设置</option>
          {PRESET_RATIOS.map((ratio) => (
            <option key={ratio} value={ratio}>
              充值比例 1:{ratio}
            </option>
          ))}
          <option value="custom">自定义比例…</option>
        </select>
      </label>
      {customOpen && (
        <form
          className="recharge-ratio-custom"
          onSubmit={(event) => {
            event.preventDefault();
            const ratio = parseRechargeRatio(draft);
            if (ratio === undefined) {
              setError('请输入大于 0 的数字');
              return;
            }
            void save(ratio);
          }}
        >
          <span>1:</span>
          <input
            autoFocus
            inputMode="decimal"
            aria-label={`${props.siteName} 自定义充值比例`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" aria-label="保存充值比例" disabled={saving}>
            <Check size={13} />
          </button>
          <button type="button" aria-label="取消自定义比例" onClick={() => setCustomOpen(false)}>
            <X size={13} />
          </button>
        </form>
      )}
      {error && <small className="ratio-error">{error}</small>}
    </div>
  );
}
