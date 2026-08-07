import { Calculator, Check, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { parseRechargeRatio } from './rate-comparison';

const PRESET_RATIOS = [1, 5, 8, 10] as const;

export function RechargeRatioControl(props: {
  siteName: string;
  ratio?: number;
  onChange?: (ratio: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstPresetRef = useRef<HTMLButtonElement>(null);

  const close = (restoreFocus = true) => {
    setOpen(false);
    setCustomOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!open) return;
    firstPresetRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const save = async (ratio: number) => {
    if (!props.onChange) return;
    setSaving(true);
    setError('');
    try {
      await props.onChange(ratio);
      close();
    } catch {
      setError('比例保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className="recharge-ratio-control"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className="recharge-ratio-trigger"
        aria-label={`${props.siteName} 设置充值比例`}
        aria-expanded={open}
        title={props.ratio ? `设置充值比例，当前 1:${props.ratio}` : '设置充值比例'}
        disabled={saving}
        onClick={() => setOpen((value) => !value)}
      >
        <Calculator size={16} aria-hidden />
      </button>
      {open && (
        <div
          className="recharge-ratio-popover"
          role="dialog"
          aria-label={`${props.siteName} 充值比例`}
        >
          <div className="recharge-ratio-heading">
            <span>充值比例</span>
            <button type="button" aria-label="关闭充值比例" onClick={() => close()}>
              <X size={14} />
            </button>
          </div>
          <div className="recharge-ratio-presets">
            {PRESET_RATIOS.map((ratio, index) => (
              <button
                ref={index === 0 ? firstPresetRef : undefined}
                type="button"
                className={props.ratio === ratio ? 'selected' : ''}
                key={ratio}
                disabled={saving}
                onClick={() => void save(ratio)}
              >
                1:{ratio}
              </button>
            ))}
          </div>
          {customOpen ? (
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
            </form>
          ) : (
            <button
              type="button"
              className="recharge-ratio-custom-trigger"
              onClick={() => {
                setDraft(props.ratio === undefined ? '' : String(props.ratio));
                setError('');
                setCustomOpen(true);
              }}
            >
              自定义比例
            </button>
          )}
          {error && <small className="ratio-error">{error}</small>}
        </div>
      )}
    </div>
  );
}
