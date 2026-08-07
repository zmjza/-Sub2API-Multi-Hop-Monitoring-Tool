# macOS 1.9.2 真机证据

## 对象与结果

- 对象：`Sub2API-Multi-Hub-Monitor-1.9.2-mac-arm64.dmg` 只读挂载应用。
- 完整 Electron E2E：6 项通过、1 项真实 Radar 网络用例按配置跳过。
- 补充短历史流程：同一构建输出的 `release/mac-arm64` 打包应用 1 项通过，用于验证 3 条真实记录与左侧 9 个空槽。
- 视觉尺寸：截图为 Retina 2x 的 `760×520`，对应逻辑窗口 `380×260`。

## 关键截图

- `05-floating.png`：主卡只保留近 12 次可用率和 12 个真实状态格，最右为最新记录。
- `27-floating-channel-dialog.png`：全部关联渠道弹框统一使用最近 12 次语义。
- `packaged-directory-short-history/28-floating-short-history.png`：左侧 9 个“暂无更早记录”空槽，右侧 3 条真实检查；空槽浅灰与 unknown 灰色不同。

## 产物校验

- DMG SHA-256：`b8e52c97c42f5fc4d229aeec84690cca4057c05755d03c7af092ca513fe167c7`
- DMG blockmap SHA-256：`fc579687906bb5348677506bd4bb5e66421e117646bb995c74ba53ad8b50c0d9`
- Windows EXE SHA-256：`e327240541533466f28cbda8d1642ee4672af74660a9bb653fdfa661502fa8ec`
- Windows EXE blockmap SHA-256：`8fe877311aae25a18bd5cfba1ad29066c8106075e1d75282cef54fc215501fa5`
- `hdiutil verify`：`VALID`
- macOS：严格签名结构通过，Mach-O arm64，bundle/asar 版本 `1.9.2`，入口 `dist-electron/main/index.js`。
- Windows：NSIS PE32、解包主程序 PE32+ x86-64，asar 版本/入口通过；未做 Windows 真机。

## 已知边界

首次从挂载应用执行完整 E2E 成功。随后为补充短历史截图重复启动同一挂载路径时，Playwright 停在 `electron.launch` 握手；直接运行挂载二进制正常，同源打包目录应用的预览与短历史流程通过。因此顶层完整流程和满历史截图标记为 DMG 挂载态，短历史子目录明确标记为同源打包目录应用，不混写证据来源。

## 发布验证

- 版本提交：`13dfdf34580b606d7ffbfd5150a4d13f2f774f16`
- GitHub/Gitee 当前发布分支均指向该提交；标签 `1.9.2` 指向同一提交。
- GitHub Release：`https://github.com/zmjza/-Sub2API-Multi-Hop-Monitoring-Tool/releases/tag/1.9.2`
- Release 为 stable、非草稿、非预发布；DMG、EXE、两个 blockmap 和 `update-manifest.json` 五项资产均为 uploaded。
- 远端 manifest SHA-256：`f0c38b5c44ea301ca8a56c9132892433de945d58c4458af9e671d43a82eba5a2`；内容为 `stable`、`testOnly:false`，DMG/EXE 哈希与本页产物校验一致。
