import { previewStates, type MainShell, type PreviewContext } from './types';
interface Props extends PreviewContext {
  shell: MainShell;
  onShellChange(value: MainShell): void;
  onStateChange(value: PreviewContext['state']): void;
  onReducedTransparencyChange(value: boolean): void;
  onHighContrastChange(value: boolean): void;
}
export function PreviewControls(props: Props) {
  return (
    <aside className="preview-controls" aria-label="临时 UI 壳预览控制">
      <strong>UI 壳施工预览</strong>
      <label>
        壳
        <select
          value={props.shell}
          onChange={(e) => props.onShellChange(e.target.value as MainShell)}
        >
          <option value="overview">主框架与全站总览</option>
          <option value="api-keys">API 密钥</option>
          <option value="usage">使用记录</option>
          <option value="channels">渠道状态</option>
          <option value="sites">站点管理</option>
          <option value="general-settings">通用设置</option>
          <option value="notification-rules">通知规则设置</option>
        </select>
      </label>
      <label>
        状态
        <select
          value={props.state}
          onChange={(e) => props.onStateChange(e.target.value as PreviewContext['state'])}
        >
          {previewStates.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <span className="preview-fixed-theme">固定浅色</span>
      <label>
        <input
          type="checkbox"
          checked={props.reducedTransparency}
          onChange={(e) => props.onReducedTransparencyChange(e.target.checked)}
        />
        减少透明
      </label>
      <label>
        <input
          type="checkbox"
          checked={props.highContrast}
          onChange={(e) => props.onHighContrastChange(e.target.checked)}
        />
        高对比度
      </label>
    </aside>
  );
}
