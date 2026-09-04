# Electron 构建避坑

## 渠道实时刷新不能放在 Renderer 页面定时器

**现象**

页面隐藏或切换到悬浮窗后，渠道状态停止更新。

**根因**

Renderer 的可见性判断和页面卸载会暂停或销毁定时器；不同页面还会重复请求同一站点。

**正确做法**

将渠道刷新放在主进程调度器，使用随机 10–20 秒窗口、站点级并发隔离和 IPC 广播；Renderer 只消费缓存事件。

**验证方式**

主窗口隐藏、悬浮窗显示期间观察 `channels:changed` 仍持续产生，并确认总览/渠道页/悬浮窗使用相同 `fetchedAt`。

**禁止事项**

不要恢复页面级后台轮询或用 visibilitychange 作为实时刷新开关。

**相关文件或命令**

- `electron/main/index.ts`
- `electron/main/services/site-service.ts`
- `src/renderer/App.tsx`

**适用范围**

所有需要在窗口隐藏时继续更新的桌面监控数据。

## 后台自动刷新会改变顺序敏感的本地夹具响应

**现象**

顺序敏感的 Electron 本地站点 E2E 在运行约一个调度周期后，倍率或渠道响应可能与测试预期不一致。

**根因**

主进程后台调度在真实应用生命周期内持续运行，可能与测试手动点击共享同一夹具端点。

**正确做法**

测试夹具应按请求语义/批次 ID 匹配，或显式控制自动调度时钟，不应依赖固定响应序列。

**验证方式**

单独运行几何用例和本地站点用例，记录后台调度触发时间；确认失败来自响应竞争而不是 Renderer 构建旧缓存。

**禁止事项**

不要关闭生产调度来掩盖竞态，也不要把一次偶发通过当作真实刷新验收。

**相关文件或命令**

- `electron/main/index.ts`
- `tests/e2e/electron-smoke.spec.ts`

**适用范围**

所有启用后台定时任务的 Electron 集成测试。

## Electron E2E 不会自动重建 Renderer

**现象**

修改 Renderer 后直接运行 `npm run test:e2e`，Playwright 启动成功但错误快照仍显示上一版本的文案和 DOM；新选择器找不到，容易被误判为实现未生效。

**根因**

当前 `test:e2e` 脚本只执行 `playwright test`，Electron 默认从现有 `dist/` 加载生产 Renderer，不会隐式执行 Vite 构建。

**正确做法**

Renderer 行为变更后先运行 `npm run build`，确认 `dist/` 已更新，再运行开发态或打包态 Electron E2E。排障时先检查错误快照中的版本文案和 DOM 是否与源码一致。

**验证方式**

本轮先直接 E2E 得到旧“自动关联 / 近 1 分钟”快照；执行 `npm run build` 后重跑同一核心集成用例，新“近 12 次”断言、刷新右移和弹框语义均通过。

**禁止事项**

不要通过放宽选择器或延长超时掩盖旧 `dist/`；不要在构建和 E2E 并行时读取正在变化的生产资源。

**相关文件或命令**

- `package.json`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run build`
- `npm run test:e2e`

**适用范围**

所有从仓库根目录启动、读取生产 `dist/` 的 Electron Playwright 测试。

## SemVer 递增后测试不能硬编码上一版本

**现象**

版本从 `1.7.3` 递增到 `1.7.4` 后，业务和构建均正常，但 Electron E2E 的版本徽标断言仍期待 `v1.7.3`，导致 6 项中仅版本断言失败；构建清单单测也出现同类旧版本断言。

**根因**

测试把发布版本写成固定字符串，没有从当前清单读取版本，也没有验证 CHANGELOG 的首个版本标题与清单同步。

**正确做法**

E2E 从当前 `package.json` 读取期望版本；构建清单测试校验 SemVer 格式并确认 CHANGELOG 首个 `## <version> -` 标题匹配。每次递增版本后串行重跑 Vitest、构建和 Electron E2E。

**验证方式**

运行 `npm test -- --run electron/build-config.test.ts`、`npm run build` 和 `npm run test:e2e`；1.7.4 本轮分别为 7 项通过、构建成功、E2E 6/6。

**禁止事项**

不要只替换测试中的旧版本字符串后跳过完整 E2E；不要把旧版本断言失败写成业务回归；不要在构建和 E2E 并行时判断 `dist/` 产物。

**相关文件或命令**

- `electron/build-config.test.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `package.json`
- `CHANGELOG.md`
- `npm run build`
- `npm run test:e2e`

**适用范围**

所有 Electron 版本徽标、构建清单、安装包版本和发布前 E2E 断言。

## 总览内容变高后页面切换必须操作真实滚动容器

**现象**

倍率卡片内联渠道状态后总览高度增加，切换到使用记录时顶部统计卡可能仍位于滚动视口之外；DOM 和无障碍树有内容，但 Playwright 判定目标隐藏。

**根因**

页面实际滚动节点是 `.content-scroll`，外层 `.app-content` 不是滚动容器。对外层调用 `scrollTo` 不会复位内部滚动位置。

**正确做法**

页面切换时对 `.content-scroll` 执行 `scrollTo({ top: 0, left: 0 })`。新增高内容量模块后必须在窄窗口验证统计卡和主列表的实际几何位置。

**验证方式**

运行 `npm run test:e2e`，在使用记录断言 Token 统计可见；macOS 窄窗口切换总览/使用记录并检查截图。

**禁止事项**

不要仅延长可见性断言超时；不要把 `.app-content` 当成滚动节点；不要用固定负 margin 掩盖内部滚动位置。

**相关文件或命令**

- `src/renderer/App.tsx`
- `src/renderer/styles.css`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

所有会改变总览页面高度的 Renderer 功能和页面切换滚动复位逻辑。

## macOS 内部目录构建应显式关闭自动签名发现

**现象**

在本机使用 `electron-builder --dir` 生成 macOS ARM64 内部目录包时，自动发现本机签名身份可能停留在逐文件 `codesign`，长时间没有完成；这不是 Renderer 或 Electron 编译失败。

**根因**

构建机存在可发现的本地签名身份，但内部验收包不需要签名/公证，electron-builder 仍会尝试执行分发签名流程。

**正确做法**

内部目录验收使用 `CSC_IDENTITY_AUTO_DISCOVERY=false ./node_modules/.bin/electron-builder --dir ...`，把输出放到独立证据目录；正式发布阶段再按发布规则单独处理签名、公证和产物门禁。

**验证方式**

确认日志出现 `skipped macOS application code signing`，应用目录生成且 Electron Playwright 能连接两个窗口并通过业务 E2E。

**禁止事项**

不要把签名等待误判为源码失败；不要把未签名内部包写成正式发布包；不要为绕过等待修改窗口安全配置或版本号。

**相关文件或命令**

- `package.json`
- `real-test-evidence/macos-1.1.0/app-nosign/`
- `CSC_IDENTITY_AUTO_DISCOVERY=false ./node_modules/.bin/electron-builder --dir`

**适用范围**

macOS 本地内部目录构建和真机验收准备。

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

## 原生 WebContentsView 打开时必须同步切换 Renderer Shell

**现象**

打开 Sub2API 服务器后，原生网页覆盖在全部站点内容上方，看起来像遮挡了左侧菜单或其他菜单。

**根因**

WebContentsView 与 Renderer Shell 是两套独立层；只显示原生视图而不切换 Shell 时，底层仍保留全部站点页面，造成视觉叠加。

**正确做法**

首次打开服务器时同步切换到 `sub2api-servers` Shell；从其他菜单切换时关闭原生视图。服务器之间切换只替换原生视图，失败时恢复旧视图。

**验证方式**

Electron E2E 断言打开服务器后的 Shell、服务器切换和返回其他菜单时原生视图生命周期；macOS 真机需截图确认左侧菜单未被遮挡。

**禁止事项**

## 关闭嵌入网页时必须先清空 Renderer 状态

**现象**

从 Sub2API 服务器、Radar 或常用网站内嵌页点击主导航后，页面仍显示内嵌网页，主导航像被网页拦截。

**根因**

关闭 IPC 到达主进程并销毁 `WebContentsView` 是异步的；Renderer 若等待主进程回传 `idle` 才清空状态，期间旧视图和旧异步事件仍可能覆盖新 Shell。

**正确做法**

关闭动作立即在 Renderer 设置对应嵌入状态为 `idle`，同时发送主进程关闭 IPC；主进程状态同步还必须校验事件来源仍是当前视图。

**验证方式**

打开常用网站内嵌页后点击“全部站点”和其他主导航，断言 Shell 切换成功且 `data-*-embedded` 不存在；重复快速切换并确认旧事件不回写。

**禁止事项**

不要只依赖主进程 `destroyed`/`idle` 回调更新 Renderer；不要通过延长点击等待时间掩盖异步状态竞态。

**相关文件或命令**

- `src/renderer/App.tsx`
- `electron/main/services/favorite-websites-manager.ts`
- `electron/main/services/sub2api-server-manager.ts`
- `tests/e2e/favorite-websites.spec.ts`

**适用范围**

所有原生 `WebContentsView` 与 Renderer Shell 并行存在的导航关闭流程。

不要通过修改远程 Sub2API DOM、提高 z-index 或扩大/缩小 WebContentsView 几何范围掩盖 Shell 状态错误。

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

## 外发版合并不能恢复 `show() + focus()` 窗口回归

**现象**

对比 `外发版/源码/electron/main/index.ts` 时发现，朋友版为透明度功能改造删除了主线的 `showFloatingWindow()` 非激活封装，并在主窗口最小化路径使用 `floatingWindow?.show()` 与 `focus()`。直接移植会让 macOS 台前调度/Space 下的悬浮窗重新进入前台应用集合，破坏主线已通过的常驻行为。

**根因**

透明度设置与窗口显示策略属于不同职责。朋友版把原生窗口聚焦行为带入透明度变更，覆盖了主线针对 macOS 无框窗口和台前调度的非激活显示修复。

**正确做法**

功能合并时只移植透明度 schema、设置持久化、Renderer 控件和 `setOpacity` 调用；所有常驻显示、托盘显示和主窗最小化路径继续统一使用 `showInactive()`，用户主动点击扩大按钮时才允许显示并聚焦主窗口。

**验证方式**

在 macOS 打包应用中验证透明度 35/84/100、重启恢复、失焦、Chrome 覆盖、Stage Manager、Space 和全屏路径；Electron E2E 同时断言透明度 IPC 与窗口非激活显示。

**禁止事项**

不要整文件覆盖 `electron/main/index.ts`；不要用 `focus()` 修复透明度显示；不要把透明度 CSS 变量应用到整个内容面板；不要以“窗口可见”替代“窗口非激活且不进入前台集合”的行为断言。

**相关文件或命令**

- `electron/main/index.ts`
- `electron/shared/contracts.ts`
- `src/renderer/shells/floating/FloatingWindow.tsx`
- `外发版/源码/electron/main/index.ts`
- `npm run test:e2e`

**适用范围**

本次外发版功能级合并、macOS 台前调度/Space、Windows 普通窗口层和所有涉及悬浮窗透明度的后续改动。

## 无框悬浮窗拖动必须区分用户移动与程序化停靠

**现象**

给无框窗口增加 CSS drag region 后，用户拖动可以触发 `move`，但四角预设调用 `setBounds` 也会触发同一事件；若统一保存 custom 坐标，用户刚选择的预设会立即被覆盖成自定义位置。

**根因**

Electron 的窗口 `move` 事件不区分指针拖动和主进程程序化移动，多次事件还可能在 `setBounds` 返回后继续到达。Renderer 交互控件若未声明 `no-drag`，点击也会被窗口拖动区域吞掉。

**正确做法**

只把 header 非交互区域设为 drag，所有按钮、下拉和 footer 控件设为 `no-drag`。主进程在程序化停靠期间记录目标坐标并忽略对应 move；用户移动使用防抖保存最终 custom x/y。恢复时按可见显示器工作区校正，屏幕消失则回退主显示器安全位置。

**验证方式**

Electron E2E 依次验证预设停靠、模拟用户 move、custom 设置持久化、重启恢复和再次选择预设覆盖；纯函数覆盖负坐标、越界和显示器消失。macOS 打包应用实际拖动标题并点击所有右下角控件。

**禁止事项**

不要在每个 move 事件同步写数据库；不要把整个窗口设为 drag；不要用全局鼠标监听；不要假定所有显示器坐标都为正数。

**相关文件或命令**

- `electron/main/index.ts`
- `electron/main/domain/window-bounds.ts`
- `src/renderer/shells/floating/floating.css`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

macOS 和 Windows 无框 Electron 悬浮窗、四角停靠、自由拖动和多显示器恢复。

## 启动时无站点的后台加载必须响应站点集合变化

**现象**

应用首次启动时没有站点，倍率后台加载立即完成；随后用户新增站点并设置充值比例，跨站倍率区仍为空，只有手动打开单站弹层后才取得数据。

**根因**

Renderer 的倍率初始化 effect 只在挂载时运行一次，启动时的空站点集合成为永久结果。普通余额刷新又不能直接作为依赖，否则每次快照时间变化都会重复请求倍率。

**正确做法**

使用排序后的稳定 site ID 集合作为倍率初始化依赖。新增或删除站点时重新读取安全缓存并后台刷新；余额、状态、更新时间等快照字段变化不触发该 effect。倍率请求继续与 Key 和全站余额刷新隔离。

**验证方式**

Electron E2E 从空 userData 添加站点，等待后台倍率加载，设置 `1:10` 后断言跨站区出现 `0.04`；单站倍率刷新时 `/groups/available` 计数增加而 `/keys` 计数不变。

**禁止事项**

不要把整个 dashboard 对象作为 effect 依赖；不要要求用户先打开 Popover 才加载跨站数据；不要用 Key 刷新顺带承担倍率刷新。

**相关文件或命令**

- `src/renderer/App.tsx`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

所有依赖动态实体集合、但不应随实体快照字段反复重载的 Renderer 后台数据源。

## IPC 最后进度事件必须自身表达终态

**现象**

批量验证 Promise 已完成并显示“全部完成”后，最后一个 `sites:batch-progress` 事件可能迟到，把界面覆盖成“当前站点失败，继续处理”，即使进度已经是 `2/2（100%）`。

**根因**

Renderer 只根据单项 success/failed 设置阶段文案，没有使用事件携带的 `current/total` 判断整批终态。IPC 事件投递与 invoke Promise 返回的先后顺序不能作为业务保证。

**正确做法**

每个进度事件必须可独立还原状态：当 `total > 0 && current >= total` 时直接显示“全部完成”；只有尚未到最后一项时才显示“已完成当前站点”或“当前站点失败，继续处理”。Promise 结果继续负责最终成功/失败汇总。

**验证方式**

Electron E2E 批量提交一个成功 URL 和一个非法 URL，断言面板最终同时显示 `全部完成`、`100%`、成功 1 和失败 1；重复运行不得依赖 IPC 与 Promise 的偶然顺序。

**禁止事项**

不要用 `setTimeout` 猜测最后事件何时到达；不要仅在 Promise `.then()` 中写终态；不要把最后一个失败项继续描述为仍有任务待处理。

**相关文件或命令**

- `src/renderer/shells/sites/SitesPage.tsx`
- `electron/main/index.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

所有通过 Electron IPC 同时使用逐项事件和最终 Promise 返回值的批处理、导入、刷新与验证流程。

## 悬浮窗自动切站不能继承旧站点的刷新状态

**现象**

macOS 打包应用中，悬浮窗根据最近使用记录自动切到另一个站点后，刷新按钮可能持续禁用并一直显示更新中；相同 E2E 在开发环境因时序不同可能通过。

**根因**

Renderer 使用一个全局 `state` 表示当前站点状态。自动用量扫描只更新 `currentSiteId`，没有同步更新 `currentSiteRef` 和目标站点的刷新状态。若切换发生在旧站点 `refreshing` 期间，新站点会继承旧状态；旧站点终态随后因 siteId 不匹配被正确忽略，但全局状态因此无法收口。

**正确做法**

维护按 siteId 记录的刷新集合。自动切站时先同步 `currentSiteRef`，再根据目标 siteId 是否正在刷新及其运行状态设置 Renderer 状态，并清除旧站点查询阶段。目标站点未刷新时必须退出 busy；目标站点自身正在刷新时仍保持 busy。后续 IPC 终态必须能命中新站点引用。

**验证方式**

先用纯函数 RED/Green 测试覆盖旧站刷新、新站刷新、鉴权状态和未知状态回退；再用修复后的生产构建运行开发主链路，并对 macOS 打包应用执行完整 Electron E2E 6/6，确认“刷新悬浮窗”在自动切站后恢复可用且手动刷新仍会正确禁用再恢复。

**禁止事项**

不要在自动切站时只调用 `setCurrentSiteId`；不要无条件把新站点设为 success；不要仅延长 E2E 超时掩盖跨站状态泄漏；不要让旧站点终态覆盖新站点。

**相关文件或命令**

- `src/renderer/App.tsx`
- `src/renderer/shells/floating/latest-usage-site.ts`
- `src/renderer/shells/floating/latest-usage-site.test.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

所有由后台轮询、最近活动、通知或路由自动切换当前实体，同时复用全局 loading/refreshing 状态的 Renderer。

## electron-builder 缓存 7zz 的 linker 签名可能被 macOS 直接终止

**现象**

Windows NSIS 交叉构建已生成 `win-unpacked`，但压缩阶段报 `ERR_ELECTRON_BUILDER_CANNOT_EXECUTE`，缓存目录中的 `7za` 退出码为空；直接运行其目标 `7zz` 稳定以 137 退出。

**根因**

缓存内 universal `7zz` 架构和执行权限正常，`codesign -dv` 仅显示 linker-generated ad-hoc 标记，但 `codesign --verify --strict` 判定未签名。当前 macOS 会在启动阶段终止该二进制。

**正确做法**

先复制到 `/tmp`，执行 `codesign --force --sign -` 后直接运行验证假设。验证成功后，只对 electron-builder 对应缓存的 `7zz` 补 ad-hoc 签名，再重跑原始 `npm run dist:win`，不修改 NSIS 或业务配置。

**验证方式**

签名后的 `7zz i` 正常输出格式列表；`npm run dist:win` 生成当前版本 NSIS 和 blockmap；安装器为 PE32，`win-unpacked` 主程序为 PE32+ x86-64。

**禁止事项**

不要把 137 直接归因于架构不匹配；不要为了绕过缓存问题修改发布目标、关闭系统安全机制或冒充 Windows 真机通过。

**相关文件或命令**

- `~/Library/Caches/electron-builder/7zip@1.0.0/.../bin/7zz`
- `codesign --verify --strict --verbose=4 <7zz>`
- `codesign --force --sign - <7zz>`
- `npm run dist:win`

**适用范围**

Apple Silicon macOS 上使用 electron-builder/NSIS 进行 Windows x64 交叉构建。

## 未签名 Electron 目录副本的手工 deep 签名可能破坏可运行性

**现象**

`dist:mac` 生成的 DMG 内应用可以启动并通过 E2E，但对 `release/mac-arm64/*.app` 目录副本执行普通或带 entitlement 的 `codesign --deep` 后，目录副本均以 SIGKILL 退出；严格签名校验通过也不能证明 Electron 可运行。

**根因**

Electron 下载包自带 linker-generated ad-hoc 签名。手工 deep 重签会改变主程序和 Framework 的签名标志、资源封装及运行时语义；即使使用 electron-builder entitlement 模板，也不等价于 electron-builder/electron-osx-sign 的完整签名流程。

**正确做法**

未配置正式签名身份时，以 electron-builder 生成且只读挂载的 DMG 内应用作为发布物真机对象。不要为了让 `codesign --verify --strict` 变绿而手工重签整个 `.app`。诊断中修改过的目录副本移出工作区保留，再从已验证 DMG 还原目录副本。

**验证方式**

直接运行 DMG 挂载点内可执行文件，并通过 `SUB2API_PACKAGED_EXECUTABLE=<mounted-app>` 执行完整 Electron E2E；同时运行 `hdiutil verify`、`file` 和 asar 版本/入口检查。

**禁止事项**

不要把严格签名校验失败单独当作未签名内部包不可运行；不要对最终 `.app` 盲目执行 `codesign --deep`；不要把 ad-hoc 内部包描述为开发者签名或已公证。

**相关文件或命令**

- `npm run dist:mac`
- `hdiutil attach -readonly <dmg>`
- `SUB2API_PACKAGED_EXECUTABLE=<mounted-app> npm run test:e2e`
- `hdiutil verify <dmg>`

**适用范围**

本项目未签名 macOS ARM64 DMG、打包应用 E2E 和签名问题诊断。

## 关闭身份发现会留下不完整 linker 签名，分发包应由 electron-builder 完成 ad-hoc 签名

**现象**

本机构建、DMG 挂载启动和隔离 E2E 可以通过，但把应用安装到 `/Applications` 或从下载渠道获取后可能显示损坏、无法验证或无法打开。`codesign --verify --deep --strict <app>` 报 `code has no resources but signature indicates they must be present`，顶层标识仍是 `Electron`。

**根因**

仅设置 `CSC_IDENTITY_AUTO_DISCOVERY=false` 会阻止 electron-builder 执行整包签名，但 Electron 主程序仍带 linker-generated ad-hoc 标记。该标记没有绑定 Info.plist 和 bundle 资源，本机无 quarantine 或关闭 Gatekeeper 时可以启动，不能代表下载分发路径安全。

**正确做法**

在 electron-builder 的 `mac` 配置中显式设置 `identity: "-"`，让 electron-builder/electron-osx-sign 按 Electron bundle 顺序签名主程序、Helper、Framework 和资源。不要对构建完成的 App 手工执行 `codesign --deep`。ad-hoc 签名只解决 bundle 完整性，不等于 Apple Developer ID 签名或公证。

**验证方式**

对最终 DMG 执行 `hdiutil verify`，只读挂载后对镜像内 App 执行 `codesign --verify --deep --strict --verbose=4`；确认标识为项目 appId、`Sealed Resources` 存在。再安装到 `/Applications`，用 LaunchServices 打开并确认前台窗口，最后以安装副本执行完整 Electron E2E。

**禁止事项**

不要把无 quarantine 的本机直接启动当作分发验证；不要因为 `codesign -dv` 出现 `adhoc` 就推断 bundle 签名完整；不要关闭系统安全机制作为产品修复；不要把 ad-hoc 包描述为 Apple 已信任、已公证或首次打开无提示。

**相关文件或命令**

- `package.json` 的 `build.mac.identity`
- `electron/build-config.test.ts`
- `npm run dist:mac`
- `codesign --verify --deep --strict --verbose=4 <app>`
- `SUB2API_PACKAGED_EXECUTABLE=<installed-executable> npm run test:e2e`

**适用范围**

macOS Electron 内部分发、DMG 安装、下载隔离属性与后续 Developer ID 发布流程。

## 更新源切换后设置页静态文案也必须同步

**现象**

在线更新服务和 Release 已切换到 GitHub，但 macOS 打包应用设置页仍显示“检查 Gitee 稳定版更新”，会误导用户对实际更新源的判断。

**根因**

更新源边界先在主进程、发布脚本和文档中完成切换，Renderer 设置页保留了旧的静态 fallback 文案；自动化只验证了检查结果，没有验证来源说明文字。

**正确做法**

切换远程更新源时同时搜索并更新 Renderer 的静态文案，并增加源码回归断言。发布后的 macOS 打包应用至少点击一次版本徽标、进入设置页检查来源文字和 toast。

**验证方式**

使用 `SUB2API_PACKAGED_EXECUTABLE` 启动新 DMG 对应应用，点击版本徽标确认“当前已是最新版本”，进入站点管理确认“检查 GitHub 稳定版更新”；截图保存到独立 `real-test-evidence` 目录。

**禁止事项**

不要只验证远程 manifest 就宣称 UI 已切换；不要保留与实际发布源冲突的旧平台名称；不要把截图中的旧文案当成无害视觉差异跳过。

**相关文件或命令**

- `src/renderer/shells/sites/SitesPage.tsx`
- `src/renderer/preview/preview.test.ts`
- `SUB2API_PACKAGED_EXECUTABLE=<app-executable> npm run test:e2e`

**适用范围**

在线更新源、设置页 fallback 文案、发布后 macOS/Windows 页面验收。

## “稍后提醒”不能把当前时间当作截止时间

**现象**

用户点击“稍后提醒”后，下一次启动或手动检查立即再次显示同一版本更新，提醒没有真正延后。

**根因**

持久化逻辑把 `update:remindAt` 写成 `Date.now()`，而检查逻辑要求 `remindAt > Date.now()` 才抑制提醒；写入完成后条件已经失效。

**正确做法**

写入明确的未来截止时间。本项目默认延后 24 小时，并通过服务层单元测试验证提醒时间大于调用前时间加延迟常量。

**验证方式**

调用 `UpdateService.remindLater()`，检查 `update:remindVersion` 和 `update:remindAt`；随后在截止时间内执行 `check()` 应返回 `skipped`，过期后才允许再次返回 `available`。

**禁止事项**

不要只验证 Renderer modal 关闭；不要把“本次弹框关闭”当作持久化稍后提醒成功；不要使用当前时间作为提醒截止时间。

**相关文件或命令**

- `electron/main/services/update-service.ts`
- `electron/main/services/update-service.test.ts`
- `npm test -- --run electron/main/services/update-service.test.ts`

**适用范围**

在线更新跳过/稍后提醒、应用重启后的更新检查和所有持久化提醒状态。

## 渠道详情卡片不能嵌套 button

**现象**

渠道状态弹层原先用整张 `button` 表示详情卡片；新增右上角关联按钮后如果直接嵌套，会产生非法 HTML、点击冒泡异常和 Playwright 定位不稳定。

**根因**

HTML 不允许交互式 `button` 嵌套 `button`。详情查看与关联切换是两个独立动作，不能共用一个嵌套按钮层级。

**正确做法**

使用非交互式卡片容器，内部放独立的详情按钮和关联按钮；关联按钮显式阻止冒泡，详情按钮只负责加载当前渠道详情。

**验证方式**

运行渠道状态 Electron E2E，分别点击关联按钮和详情按钮，确认关联状态变化、详情渠道不误切换，并检查最终 DOM 不存在嵌套 `button`。

**禁止事项**

不要通过 CSS 或事件补丁掩盖嵌套交互元素；不要让整张卡片和右上角按钮共享同一个点击处理器。

**相关文件或命令**

- `src/renderer/shells/overview/ChannelStatusPopover.tsx`
- `src/renderer/shells/overview/overview.css`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

所有需要在渠道、列表、表格或卡片内部增加独立操作按钮的 Renderer UI。

## 在线更新不能依赖无缓存的 latest 请求和 preload 版本常量

**现象**

新 Release 已存在时，旧客户端可能仍提示“当前已是最新版本”；安装包界面版本还可能显示上一个版本号，导致用户误判更新不可用。

**根因**

GitHub `releases/latest` 请求可能命中缓存；同时 preload 中硬编码的 `shellVersion` 不会随着 `package.json` 版本自动变化。

**正确做法**

更新检查 URL 增加时间戳并发送 `Cache-Control: no-cache`，版本显示通过同步 IPC 从主进程 `app.getVersion()` 获取。发布前用旧版本号实例化 `UpdateService` 对真实 latest/manifest 做回归。

**验证方式**

使用当前构建的服务以 `1.5.1` 检查真实 GitHub，结果必须为 `available`；打包 E2E 断言徽标显示当前 SemVer，点击后出现检查中、最新、可用或错误反馈之一。

**禁止事项**

不要只修改 Release 说明或重新上传同名资产；不要在 preload、Renderer 测试或安装包文件名中保留旧版本常量；不要把一次缓存命中误判为远端没有新版本。

**相关文件或命令**

- `electron/main/services/update-service.ts`
- `electron/preload/bridge.cts`
- `electron/main/index.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run release:publish -- --notes "..."`

**适用范围**

所有 GitHub Release 在线更新检查、版本徽标、设置页检查按钮和双平台安装包发布。

## 应用退出必须等待 Chrome 会话清理完成

**现象**

应用触发 `before-quit` 后如果只启动异步清理而不阻止 Electron 默认退出，主进程可能先结束，Chrome 临时 Profile 和带远程调试端口的子进程来不及清理，随后真机测试会看到残留目录或残留进程。

**根因**

Electron 的 `before-quit` 回调不会等待异步 Promise；没有调用 `event.preventDefault()` 时，异步 `closeAllChromeAuthenticationSessions()` 只是后台启动，默认退出流程会继续执行。

**正确做法**

退出第一次触发时停止调度器和定时器，调用 `preventDefault()`，等待所有 Chrome 会话终止并删除临时 Profile，最后显式调用 `app.quit()`。用一次性门禁避免重复 `before-quit` 事件反复清理。

**验证方式**

运行 `app-shutdown.test.ts`，确认第一次退出只调用一次清理且默认退出被阻止；再运行打包应用 Chrome 烟测，关闭应用后检查本次 `sub2api-chrome-*` Profile 与带回环 CDP 参数的 Chrome 进程均不存在。

**禁止事项**

不要依赖 `before-quit` 中未等待的 async 回调；不要按进程名批量终止用户日常 Chrome；不要把历史临时目录或用户 Chrome Profile 当作本次会话清理对象。

**相关文件或命令**

- `electron/main/index.ts`
- `electron/main/services/app-shutdown.ts`
- `electron/main/services/app-shutdown.test.ts`
- `electron/main/services/chrome-auth-window.ts`
- `SUB2API_PACKAGED_EXECUTABLE=<app-executable> npm run test:e2e`

**适用范围**

所有 Electron 退出时需要等待外部子进程、临时目录、网络会话或安全凭据清理的流程。

## macOS 临时目录不能硬编码为 `/tmp`

**现象**

真实打包应用启动 Chrome 登录器后，按 `/tmp/sub2api-chrome-*` 搜索不到进程，容易误判为 Chrome 没有启动。

**根因**

macOS 的 Node `os.tmpdir()` 通常返回 `/var/folders/...` 下的系统临时目录；应用实际创建的 Profile 名称仍包含 `sub2api-chrome-`，但路径不在 `/tmp`。

**正确做法**

真机观测使用进程参数中的 `sub2api-chrome-` 前缀和应用本次生成的 Profile 路径进行匹配，不要假设平台临时目录的固定前缀。清理验证必须同时检查带该 Profile 的 Chrome 进程和对应目录是否消失。

**验证方式**

运行打包应用的 Chrome 启动烟测，确认进程参数包含回环 CDP、独立 `sub2api-chrome-*` Profile；关闭应用后再次检查进程和目录均不存在。当前 1.7.10 证据位于 `real-test-evidence/macos-1.7.10-final/`，未记录真实账号或令牌。

**禁止事项**

不要把 `/tmp` 搜索失败写成应用启动失败；不要用进程名批量终止用户日常 Chrome；不要为了让测试通过修改应用的临时目录或关闭 Profile 清理。

**相关文件或命令**

- `electron/main/services/chrome-auth-window.ts`
- `electron/main/services/chrome-auth-policy.ts`
- `npm run pack`
- `SUB2API_PACKAGED_EXECUTABLE=<app-executable> npm run test:e2e`

**适用范围**

macOS/Windows Chrome 真实启动、临时 Profile 隔离、CDP 进程观察和应用退出清理验收。

## WebContentsView 的 bounds 相对 BrowserWindow contentView

**现象**

远程页面已经成功加载，但如果直接使用主窗口外框尺寸设置 `WebContentsView`，网页会覆盖应用 toolbar、左侧导航或在 resize 后留下空白。只检查远程 URL 不能证明应用控制区仍可见。

**根因**

`WebContentsView` 是 `BrowserWindow.contentView` 的子视图，bounds 使用相对 contentView 的坐标；项目当前无框主壳的内容区从 `x=284`、`y=80` 开始，分别对应左侧导航和顶部 toolbar 的占位。

**正确做法**

根据主窗口 `getContentSize()` 计算子视图 bounds，保持 `x=284`、`y=80`，宽高扣除对应偏移；在主窗口 `resize` 时重新设置 bounds。应用自有 toolbar 和关闭按钮保持在远程视图范围之外，并在远程视图关闭、主窗口关闭和应用退出时移除 child view。

**验证方式**

运行真实 Electron Radar 流程，打开两个公网目标，断言远程视图 URL 和 bounds；将内容尺寸调整为 `960x640` 后断言 bounds 为 `x=284,y=80,width=676,height=560`，再通过应用关闭按钮和远程 webContents 的 `Escape` 输入恢复两个卡片。历史证据见 `real-test-evidence/macos-1.8.1-radar-final/`，1.9.3 动态列表复测证据见 `real-test-evidence/macos-1.9.3/`。

**禁止事项**

不要把 `WebContentsView` 当作 Renderer DOM 子节点定位；不要用 `BrowserWindow` 外框坐标代替 contentView 坐标；不要只截取远程页面或只读取 URL 就声称应用 toolbar 和关闭按钮可见；不要在 resize 后复用旧 bounds。

**相关文件或命令**

- `electron/main/index.ts`
- `electron/shared/radar.ts`
- `tests/e2e/electron-smoke.spec.ts`
- `real-test-evidence/macos-1.8.1-radar-final/`

**适用范围**

所有把 `WebContentsView`、BrowserView 或其他 Electron 原生子视图挂载到无框主窗口 contentView 的功能。

## Radar 持久化重复校验必须比较规范化 URL

**现象**

Radar 从固定枚举改为持久化站点列表后，`https://example.com` 与 `https://example.com/` 被当作不同网址通过，用户可保存语义重复的条目。

**根因**

重复校验直接比较用户输入的字符串；`URL.toString()` 会补全根路径、编码和默认端口，但原始字符串不会。

**正确做法**

在共享 Zod schema 的数组 `superRefine` 和主进程创建 IPC 中统一调用 `normalizeRadarUrl()` 后比较；同时限制仅 `https:`、禁止用户名密码，并在新增时持久化规范化 URL。

**验证方式**

`electron/shared/radar.test.ts` 断言 `https://example.com` 与 `https://example.com/` 重复被拒绝；Electron E2E 在新增弹窗填入 `https://codexradar.com/` 时显示重复网址错误。

**禁止事项**

不要只比较 trim 后的原始字符串；不要把 `URL` 解析失败吞掉；不要允许 `http/file/data/javascript` 或带凭据 URL 进入持久化列表。

**相关文件或命令**

- `electron/shared/radar.ts`
- `electron/main/index.ts`
- `electron/shared/radar.test.ts`
- `tests/e2e/electron-smoke.spec.ts`

**适用范围**

所有需要保存并重新打开外部 HTTPS 地址的本地列表功能。

## 在线更新下载必须对瞬时网络失败重试并清理残留包

**现象**

GitHub Release 安装包较大，下载过程中遇到 CDN 瞬时断连或连接重置时，界面显示“更新下载失败，请稍后重试”；用户再次点击可能继续受损坏临时文件影响。

**根因**

下载请求原先只执行一次，且异常路径没有统一覆盖所有流中断场景。90MB 以上的 DMG/EXE 在普通网络抖动下容易触发一次性失败。

**正确做法**

下载每次从干净临时文件开始，对连接重置、超时、请求中止和 5xx 响应做有限次数重试；所有失败路径清理临时包，成功后仍必须校验 manifest 中的 SHA-256。

**验证方式**

更新服务测试注入第一次抛出 ECONNRESET、第二次返回有效流，断言最终成功且请求次数为 2；另注入断流并断言临时文件被删除。运行 npm run test -- electron/main/services/update-service.test.ts 和 npm run typecheck。

**禁止事项**

不要无限重试；不要重试 SHA-256 不匹配等确定性错误；不要保留未完成安装包；不要跳过最终哈希校验。

**相关文件或命令**

- electron/main/services/update-service.ts
- electron/main/services/update-service.test.ts
- npm run test -- electron/main/services/update-service.test.ts

**适用范围**

所有 GitHub Release 在线更新下载、临时安装包和平台安装入口。

## 固定尺寸悬浮窗必须按真实盒模型预留页脚

**现象**

在 380×260 悬浮窗增加速度徽标或渠道入口后，指标区可能与底部状态栏重叠；仅检查父元素写了 `height` 或 `min-height` 无法证明可用高度正确。

**根因**

子元素默认 `content-box`，页脚的 `min-height` 之外还会叠加上下 padding；新增普通流内容也会继续向下挤压绝对定位页脚。

**正确做法**

固定窗口页脚使用明确的 `box-sizing: border-box` 和固定高度，主指标区按页脚上边界定位；辅助详情使用受限高度的覆盖层并允许内部滚动。对 380×260 真实 Electron 窗口同时断言内容与页脚几何不相交。

**验证方式**

运行 Electron E2E，读取 `.floating-metrics` 与 `.floating-window footer` 的 `getBoundingClientRect()`，确认 `metrics.bottom <= footer.top`，并人工检查展开渠道详情后的截图。

**禁止事项**

不要把 `min-height` 当成包含 padding 的最终高度；不要只在大窗口或未加载数据状态下检查悬浮窗；不要让可展开详情改变固定窗口整体高度。

**相关文件或命令**

- `src/renderer/shells/floating/floating.css`
- `tests/e2e/electron-smoke.spec.ts`
- `npm run test:e2e`

**适用范围**

固定尺寸悬浮窗、托盘窗口和其他使用绝对定位页脚的 Electron 页面。

## 相同 bundle id 的打包应用会阻塞真机定位

**现象**

Computer Use 启动或读取打包应用连续超时，系统同时存在 `/Applications` 安装副本和 `release` 构建副本。

**根因**

两个应用使用相同 bundle id，系统窗口/激活目标无法仅凭 bundle id 唯一确定实际副本。

**正确做法**

真机验收前关闭或移走旧副本，记录绝对应用路径，并通过打包目录 E2E 或明确路径启动；无法唯一定位时将验收标记为待实测。

**验证方式**

列出 `/Applications` 与 `release` 下应用，核对 bundle id 和进程路径；Computer Use 连续超时不得写成真机通过。

**禁止事项**

不要伪造截图、登录态或真实服务结果；不要把开发态浏览器或夹具验证冒充打包应用真机验收。

**相关文件或命令**

- `release/mac-arm64/看看你还有💰吗？.app`
- `liran_docs/09-真机实测.md`
- `npm run test:e2e`

**适用范围**

所有需要 Computer Use 或系统窗口定位的 Electron macOS 打包应用验收。
