# macOS 1.8.1 Radar 真机复验

## 测试命令

```text
SUB2API_RADAR_REAL_E2E=1 SUB2API_REAL_EVIDENCE_DIR=real-test-evidence/macos-1.8.1-radar-final-rerun npm run test:e2e -- --grep "embeds both real Radar sites"
```

结果：1/1 通过。

## 验收范围

- 雷达入口页只显示 `Codex 雷达` 和 `分布式雷达 Codex 站` 两张卡片。
- 两个固定 HTTPS 站点均在当前 Electron 主窗口的 `WebContentsView` 内加载。
- 应用顶部控制区和右上角关闭图标保持可见，网页未覆盖侧栏或控制区。
- 测试覆盖关闭图标、远程网页 `Escape`、窗口尺寸调整和两个站点之间的切换。
- 大窗口、小窗口和两个远程页面截图均完成目视检查，未发现重叠、裁剪、横向溢出或无法滚动。

## 截图

- `radar-chooser.png`：雷达两个入口卡片。
- `radar-codex-window.png`：Codex 雷达大窗口与应用壳。
- `radar-codex-window-small.png`：Codex 雷达小窗口与应用壳。
- `radar-distributed-window.png`：分布式雷达 Codex 站大窗口与应用壳。
- `radar-codex.png`：Codex 雷达远程视图内容。
- `radar-distributed.png`：分布式雷达 Codex 站远程视图内容。

本目录不记录账号、密码、Cookie、Token、CDP 地址或完整敏感响应。
