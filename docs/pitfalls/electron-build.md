# Electron 构建避坑

## macOS 无框窗口不应依赖原生 minimize 完成产品切换

**现象**

主窗口使用无框模式后调用原生 `BrowserWindow.minimize()`，macOS 上窗口仍可能保持可见，无法稳定实现“主窗口消失并显示悬浮窗”的产品行为。

**根因**

产品要求的是主窗口与悬浮窗之间的确定性生命周期切换，不是操作系统原生最小化动画。无框窗口的原生最小化表现还会受到窗口状态和平台行为影响。

**正确做法**

把“最小化”按钮定义为产品级 IPC：隐藏主窗口，并在悬浮窗启用时显示悬浮窗；悬浮窗停用时仅隐藏到托盘。扩大按钮执行反向的隐藏悬浮窗、显示并聚焦主窗口。关闭按钮继续执行真正退出。

**验证方式**

运行 Electron Playwright E2E，点击主窗口最小化按钮后分别断言主窗口不可见、悬浮窗按设置显示；点击悬浮窗扩大按钮后断言主窗口恢复并获得焦点；关闭按钮后断言应用进程退出。

**禁止事项**

不要用 `BrowserWindow.minimize()` 的调用成功代替可见性结果验证；不要混淆最小化与关闭；不要让停用悬浮窗的设置失效。

**相关文件或命令**

- `electron/main/index.ts`
- `electron/preload/bridge.cts`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

macOS 无框主窗口、悬浮窗切换和跨平台生命周期自动化。

## Vite 生产资源路径不能使用文件系统根路径

**现象**

开发服务器模式可以显示 Renderer，但 Playwright Electron 从生产构建启动时找不到“UI 壳施工预览”，构建后的 `dist/index.html` 使用 `/assets/...` 资源路径。

**根因**

Vite 默认生成以 `/` 开头的绝对资源路径。Electron 使用 `file://` 加载生产页面时，该路径会指向文件系统根目录，导致 Renderer 脚本和样式未按构建目录解析。

**正确做法**

在 `vite.config.ts` 中设置 `base: './'`，让生产资源相对于 `dist/index.html` 加载。开发服务器和生产文件入口都必须分别验证。

**验证方式**

运行 `npm run build:renderer` 后确认 `dist/index.html` 使用相对资源路径，再运行 `npm run test:e2e`。当前项目的 Electron 烟测应能找到“UI 壳施工预览”。

**禁止事项**

不要因为 Vite 开发服务器可以访问页面，就推断 Electron 的生产 `file://` 入口也能加载；不要在测试中通过延长等待时间掩盖资源未加载问题。

**相关文件或命令**

- `vite.config.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run build:renderer`
- `npm run test:e2e`

**适用范围**

Electron 主面板、悬浮窗及任何由 Vite 构建后通过 `file://` 加载的 Renderer。

## BrowserWindow 外框尺寸存在平台取整误差

**现象**

按主显示器工作区的比例创建 `BrowserWindow` 后，macOS 自动化测试读取到的窗口外框高度可能与计算值相差 1–2px。

**根因**

Electron 的窗口尺寸使用设备无关像素，原生窗口边框和系统缩放换算可能产生整数取整差异。

**正确做法**

产品代码分别使用 `Math.round(workArea.width * 0.6)` 和 `Math.round(workArea.height * 0.9)`；跨平台自动化断言对外框宽高允许最多 2px 误差，同时单独断言窗口保持 `resizable`。

**验证方式**

运行 `npm run test:e2e`，确认主窗口宽高接近工作区的 `60% × 90%` 且可缩放。

**禁止事项**

不要为了消除原生边框的像素取整差而硬编码某个平台专属补偿值；不要放宽到无法识别明显尺寸回归的误差范围。

**相关文件或命令**

- `electron/main/index.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

macOS、Windows 的 Electron 初始窗口尺寸和跨平台窗口自动化测试。

## Renderer 视觉参考尺寸不能变成固定画布约束

**现象**

将 Stitch 的 `1440 × 1024` 设计尺寸直接实现为 Renderer 固定画布后，窗口变大时 UI 无法铺满，形成大面积空白；窗口变小时则依赖整体缩放，降低可读性和布局弹性。

**根因**

`1440 × 1024` 是视觉规格校对基准，不是运行时固定尺寸。Electron `BrowserWindow` 的外框尺寸决定可用视口，Renderer 应使用响应式布局占满视口；两者不能通过固定缩放绑定。

**正确做法**

保留 `1440 × 1024` 作为 Stitch 视觉参考，在 Electron 主进程按主屏工作区创建宽 `60%`、高 `90%` 的主窗口；Renderer 使用 `width/height: 100%`、弹性轨道和局部滚动铺满窗口，左侧菜单固定在内容区左侧。

**验证方式**

运行 `npm run test:e2e`，改变主窗口尺寸并断言 `.app-shell` 始终贴合 Renderer 视口、左侧菜单稳定、内容区无大片空白，同时确认主 `BrowserWindow` 初始宽高接近主屏工作区的 `60% × 90%`。

**禁止事项**

不要把设计稿尺寸硬编码为运行时画布；不要通过对整个 Renderer 做统一缩放来模拟响应式布局；不要只测试原生窗口而忽略页面铺满结果。

**相关文件或命令**

- `electron/main/index.ts`
- `src/renderer/App.tsx`
- `src/renderer/styles.css`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

Electron 主面板初始窗口、Renderer 响应式布局与跨平台窗口测试。

## Electron E2E 不应假设 firstWindow 是主面板

**现象**

主窗口和独立悬浮窗同时创建时，`firstWindow()` 可能返回悬浮窗，导致主面板断言找不到 `.app-shell`。

**根因**

Electron 窗口创建和页面加载的观察顺序不是业务窗口优先顺序，测试按枚举顺序绑定窗口会产生竞态。

**正确做法**

等待预期窗口数量后，通过稳定的页面标识（例如 `.app-shell` 或 `.floating-window`）选择目标窗口。

**验证方式**

运行 `npm run test:e2e`，分别验证主面板和悬浮窗。

**禁止事项**

不要通过固定窗口数组下标或 `firstWindow()` 推断业务窗口身份。

**相关文件或命令**

- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

所有同时创建多个 Electron BrowserWindow 的端到端测试。

## sandbox preload 必须验证桥对象真实存在

**现象**

Renderer 页面和静态 E2E 均能正常显示，但所有业务按钮一直停留在 loading，`window.sub2apiDesktop` 实际为 `undefined`。

**根因**

在 `sandbox: true` 的窗口中直接使用本项目生成的 ESM preload 没有成功暴露桥对象；页面代码使用 optional chaining 后又把缺失桥静默吞掉，使视觉烟测产生假阳性。

**正确做法**

使用 `.cts` 生成 CommonJS preload（`bridge.cjs`），继续保持 `sandbox: true`、`contextIsolation: true` 和 `nodeIntegration: false`；Electron E2E 必须断言 `typeof window.sub2apiDesktop === 'object'`，并至少完成一次真实 IPC 业务流程。

**验证方式**

运行 `npm run build:electron` 和 `npm run test:e2e`，确认 preload 桥断言、站点录入、总览、使用记录、渠道状态及悬浮窗本地集成流程通过。

**禁止事项**

不要通过关闭 sandbox 修复 preload；不要只验证页面 DOM 存在；不要用 optional chaining 将桥加载失败长期隐藏。

**相关文件或命令**

- `electron/preload/bridge.cts`
- `electron/main/index.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

Electron 安全 preload、Renderer IPC 和所有依赖 preload 的业务 E2E。

## macOS 首次显示会覆盖过早应用的窗口恢复坐标

**现象**

主窗口退出前已保存完整 bounds，重启后宽、高和 Y 坐标恢复正确，但 X 坐标被系统重新居中。

**根因**

macOS 会在 `BrowserWindow` 首次 `show()` 时执行原生窗口放置。构造参数或 Renderer 加载前调用的 `setBounds()` 可能被这次放置覆盖。

**正确做法**

先校验保存位置仍与任一显示器工作区相交；Renderer 加载并首次 `show()` 后再调用 `setBounds(savedBounds)`，随后才注册 move/resize 持久化监听，避免把恢复动作误记为用户移动。

**验证方式**

运行 `npm run test:e2e`，在同一临时 userData 中启动应用、改变窗口 bounds、退出并重启，严格比较重启后的完整 bounds。

**禁止事项**

不要仅断言宽高恢复；不要用放宽 X 坐标断言掩盖系统居中；不要在未做显示器可见性校验时恢复历史坐标。

**相关文件或命令**

- `electron/main/index.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

macOS Electron 主窗口位置持久化、多显示器恢复和首次显示流程。

## electron 必须留在 electron-builder 可识别的开发依赖中

**现象**

Renderer 和 TypeScript 构建均通过，但 `electron-builder --dir` 在打包阶段拒绝继续，或把 Electron 运行时当作应用生产依赖处理。

**根因**

Electron 是构建工具和打包运行时，由 electron-builder 从 `devDependencies` 解析；放入普通 `dependencies` 会违反其打包模型。

**正确做法**

将 `electron` 固定在 `devDependencies`，并用清单测试保护该边界。

**验证方式**

运行 `npm test -- --run electron/build-config.test.ts` 和 `npm run pack`，确认本地目录包生成。

**禁止事项**

不要为了绕过打包错误把 Electron 移入生产依赖；不要只以 Renderer 构建通过判断可打包。

**相关文件或命令**

- `package.json`
- `electron/build-config.test.ts`
- `npm run pack`

**适用范围**

macOS、Windows 的 electron-builder 本地构建和 CI。

## 无人值守本地打包应关闭签名身份自动发现

**现象**

本地目录打包在 macOS 签名身份扫描阶段长时间无输出，无法稳定作为自动验收门禁。

**根因**

electron-builder 默认尝试自动发现本机签名身份；当前任务只要求未签名的内部目录包，自动发现既无必要又可能受钥匙串状态影响。

**正确做法**

本地 `pack` 命令显式设置 `CSC_IDENTITY_AUTO_DISCOVERY=false`。正式分发签名必须另建明确流程，不能把未签名目录包写成签名通过。

**验证方式**

运行 `npm run pack`，确认生成 `release/mac-arm64/Sub2API 多站监控.app`，并确认输出明确记录跳过签名。

**禁止事项**

不要在无人值守验收中等待自动签名发现；不要把跳过签名描述成公证或正式发布完成。

**相关文件或命令**

- `package.json`
- `electron/build-config.test.ts`
- `npm run pack`

**适用范围**

macOS 内部目录包、自动验收和后续正式签名流程的边界说明。

## Electron nativeImage 不应直接依赖 SVG Data URL

**现象**

托盘 SVG 在源码和浏览器中可见，但 Electron 43 的 `nativeImage.createFromDataURL()` 返回空图像，菜单栏没有可靠的可见图标。

**根因**

本项目实测的 Electron 原生图像解码路径没有接受 URL 编码或 base64 编码的 SVG Data URL；字符串格式测试不能证明原生对象可用。

**正确做法**

将同一单色图形预栅格化为内嵌 PNG，macOS 继续调用 `setTemplateImage(true)`；同时用 Electron 原生进程验证 `isEmpty() === false`，并在真实菜单栏截图中核对图标。

**验证方式**

运行 `npm test -- --run electron/main/tray-icon.test.ts`，再使用 Electron 验证入口调用 `nativeImage.createFromDataURL(trayIconDataUrl())`，确认原图为非空 `36 x 36`，生产路径缩放为 `18 x 18`。

**禁止事项**

不要只断言 SVG 字符串存在或 Data URL 前缀正确；不要用透明像素冒充托盘资源；不要把浏览器能显示 SVG 等同于 Electron 原生菜单栏能显示。

**相关文件或命令**

- `electron/main/tray-icon.ts`
- `electron/main/tray-icon.test.ts`
- `electron/main/index.ts`

**适用范围**

macOS 菜单栏托盘图标及其他依赖 Electron `nativeImage` 的内嵌资源。

## 本地导出文件不能依赖进程 umask 保护权限

**现象**

CSV 内容和脱敏测试均通过，但最终打包应用导出的文件权限为 `0644`，同一台机器上的其他本地用户可能读取。

**根因**

只使用普通文本写入时，文件权限由系统默认 mode 与进程 umask 共同决定；内容安全测试不会发现文件系统权限过宽。

**正确做法**

创建文件时显式指定 `0o600`，写入完成后再次执行 `chmod(0o600)`，同时在 Electron E2E 中检查最终落盘权限，而不只检查 CSV 文本。

**验证方式**

运行 `npm run test:e2e`，并对最终打包应用导出的文件执行 `stat`，确认权限为 `0600`；同时继续验证表头、行数、脱敏和公式注入防护。

**禁止事项**

不要把“未导出密码或 Token”等同于文件权限安全；不要依赖开发机当前 umask；不要只测内存中的 CSV 字符串。

**相关文件或命令**

- `electron/main/index.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

macOS 和 Windows 的本地 CSV/JSON 导出及其他包含用户业务数据的文件。

## 未签名内部目录包不能作为 macOS 登录项验收载体

**现象**

在未签名、未安装到 Applications 的目录包中调用 `app.setLoginItemSettings()` 后，读取状态仍为关闭，`sfltool dumpbtm` 也没有应用登录项。

**根因**

当前内部验收包缺少正式签名身份、TeamIdentifier 和标准安装位置，不满足新版本 macOS 登录项服务的注册条件。这是验收产物边界，不代表应该在 UI 中伪造开启成功。

**正确做法**

内部目录包只验证默认关闭、失败后状态保持真实且无系统残留；把登录项实际生效留给具备签名和正式安装条件的分发产物。UI 必须以 `getLoginItemSettings()` 的实际结果回显。

**验证方式**

检查 `codesign`/Info.plist 的签名属性，操作开关后读取 `app.getLoginItemSettings()` 并运行 `sfltool dumpbtm`；确认状态仍关闭且没有残留条目。

**禁止事项**

不要为通过内部验收擅自签名、移动安装包、修改系统安全策略或模拟开启成功；不要把“不适用”写成开机启动真机通过。

**相关文件或命令**

- `electron/main/index.ts`
- `sfltool dumpbtm`
- `codesign -dvv`

**适用范围**

macOS 13 及以上的未签名内部 Electron 目录包与后续正式分发登录项验收边界。

## Stitch 图像必须按真实字节格式标准化后再生成桌面图标

**现象**

Stitch Screen 声明为 `1024 × 1024`，下载 URL 保存为 PNG 文件名后，实际字节却是无透明通道的 `512 × 512` JPEG。直接改扩展名或交给打包器会造成格式判断错误、尺寸不足或图标生成不稳定。

**根因**

Stitch 的 Screen 元数据描述设计画布，不保证托管截图的编码格式、实际像素尺寸或透明通道；URL 本身也不提供可靠扩展名。

**正确做法**

下载后先用 `file` 和 `sips` 检查真实编码、尺寸及 Alpha，再统一转成 `1024 × 1024` PNG。由标准 PNG 生成 macOS 多尺寸 ICNS 和 Windows 256px ICO，Renderer 也引用同一标准 PNG。electron-builder 分别显式配置 `build/icon.icns` 与 `build/icon.ico`。

**验证方式**

运行图标配置单测、`npm run dist:mac` 和 `npm run dist:win`；检查 macOS `Info.plist` 的 `CFBundleIconFile` 及包内 ICNS，并确认 Windows 产物为带资源更新步骤的 NSIS PE 可执行文件。Electron E2E 还需断言 Renderer Logo 已完成解码且 `naturalWidth` 符合基准尺寸。

**禁止事项**

不要只根据文件名、URL 或 Stitch 画布尺寸推断图像格式；不要把 JPEG 字节简单重命名为 PNG；不要只配置一个平台图标后假定另一个平台会自动正确转换。

**相关文件或命令**

- `build/stitch-logo-source.jpg`
- `build/icon.png`
- `build/icon.icns`
- `build/icon.ico`
- `src/renderer/assets/sub2api-logo.png`
- `electron/build-config.test.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run dist:mac`
- `npm run dist:win`

**适用范围**

Stitch 托管图像、Electron 应用图标、macOS DMG、Windows NSIS 和 Renderer 品牌资源。

## Stage Manager 常驻不等于 alwaysOnTop

**现象**

产品要求悬浮窗切换应用后继续存在，同时浏览器和其他前台软件必须能够覆盖它。若直接启用 `alwaysOnTop`，悬浮窗会遮挡正常工作；若在失焦或切换应用时隐藏，则返回桌面后窗口已经消失。

**根因**

“常驻桌面”包含窗口生命周期与窗口层级两个独立要求：窗口应保持 `visible`，但层级仍应是普通窗口。macOS 台前调度和 Space 还需要单独配置跨工作区可见性，不能用置顶替代。

**正确做法**

所有平台保持 `alwaysOnTop=false`，不在 `blur`、应用切换或窗口切换事件中调用 `hide()`/`minimize()`。macOS 使用 `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false })`，让悬浮窗在台前调度和 Space 间保持存在，但不覆盖全屏应用；Windows 保持普通工作区窗口。只有点击“打开主页面”时才隐藏悬浮窗并显示、聚焦主窗口。

**验证方式**

Electron E2E 断言 `isAlwaysOnTop() === false`、失焦后 `isVisible() === true`，并验证打开主页面后的反向切换。macOS 打包应用还需在开启台前调度时切换到浏览器，确认浏览器可以覆盖悬浮窗，同时通过应用状态确认悬浮窗仍为 visible。

**禁止事项**

不要把“保持显示”实现成 `alwaysOnTop`；不要监听失焦后自动隐藏；不要设置 `visibleOnFullScreen=true`；不要只凭一个原生标志推断台前调度下的实际遮挡行为。

**相关文件或命令**

- `electron/main/index.ts`
- `electron/main/domain/window-bounds.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

macOS 台前调度、多 Space、Windows 普通窗口层，以及主窗口与悬浮窗的生命周期切换。

## 桌面常驻显示不能调用 show 并 focus

**现象**

悬浮窗设置为非置顶并跨 Space 可见，但在 macOS 台前调度中仍可能被收进当前应用缩略区域或出现窗口变小。

**根因**

桌面常驻要求窗口继续可见，不要求应用成为前台活动应用。`show()` 后再 `focus()` 会激活 Electron 应用，改变台前调度的前台窗口集合；这与“不遮挡前台应用”也不一致。

**正确做法**

显示悬浮窗时使用 `showInactive()`，不调用 `focus()`；只有用户点击悬浮窗“打开主页面”时才隐藏悬浮窗并显示、聚焦主窗口。托盘显示悬浮窗也必须走同一套非激活显示策略。

**验证方式**

Electron E2E 断言悬浮窗的非置顶和可见状态，并检查主窗最小化、托盘显示和扩大恢复路径。macOS 真机需开启台前调度，切换到其他应用后观察悬浮窗保持原尺寸和位置，且前台应用仍可覆盖。

**禁止事项**

不要在桌面常驻显示路径中调用 `focus()`；不要用 `alwaysOnTop=true` 补偿激活导致的窗口集合变化；不要把 `showInactive()` 的“非激活”误写成隐藏或最小化。

**相关文件或命令**

- `electron/main/index.ts`
- `electron/main/domain/window-bounds.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

macOS Stage Manager、Space 切换、Windows 桌面常驻显示，以及主窗口最小化和托盘切换。
