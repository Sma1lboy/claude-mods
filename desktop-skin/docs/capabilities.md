# desktop-skin：官方 mod API 在 desktop 上能做什么

依据：`claude /plugin-types` 在 Claude Code 2.1.284 生成的 `types/claude-code.d.ts`（下文的行号都指这个文件）。本机 Claude Desktop 是 1.24012.9。

## 先说结论：本机 Desktop 现在跑不了任何 mod

Desktop 的 Code 标签不调用系统里的 `claude`，它跑的是自己固定版本的 Claude Code：`~/Library/Application Support/Claude/claude-code/2.1.219/`。日志 `~/Library/Logs/Claude/main.log` 里写着 `[CCD] Initialized with version 2.1.219`。

这一版还没有 function hooks。在它的二进制里搜 `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS`、`ui_render`、`ui_client_module`、`AbovePrompt`，一个都搜不到；`/plugin-types` 也报 `Unknown command`。2.1.284 里这几个字符串都在。

所以下面"能做"一栏的东西都写好了，也测过（`$.ui.mount({ surface: 'desktop' })` 和真实的终端会话），但要等 Desktop 把内置的 Claude Code 升到带 function hooks 的版本，才有机会在 Desktop 里显示出来；新版内置引擎与 Desktop 前端是否真正支持这些 render tree，仍须实机验证，不能由类型和 mount 测试推定。Desktop 支持用环境变量 `CLAUDE_CODE_LOCAL_BINARY` 指向别的 CLI，但这得重启 Claude.app。owner 说过不重启，所以没有试。

## 能做

| 能力 | 这个 mod 怎么用 | 类型位置 |
| --- | --- | --- |
| desktop 能画的元素：Box、Text、Button、Input、Select、Svg、Link、Code、Markdown、Client | 启动仪式、HUD 和 pane 卡片都用 `Svg`；跳过按钮用 `Button`，外观切换用 `Select` | `Elements.desktop` 3503–3514 |
| `Svg` 加 `isInteractive`：在没有脚本的沙箱 frame 里画，CSS 动画、SMIL 和 `:hover` 都能用 | 所有动画都只动 transform 和 opacity，交给合成器跑 | `SvgProps` 10874–10901，`isInteractive` 10900 |
| `Svg` 的大小上限是 131072 个字符 | 启动仪式约 24k，HUD 约 8k | 10876 |
| `AbovePrompt`：提示框正上方的一条带子，只在 terminal 和 desktop 上出现，用户可以折叠和聚焦 | 先放启动仪式，放完换成 HUD 带 | `RenderPropsOf.AbovePrompt` 9045–9087，各 surface 的说明在 9043 |
| `Spinner`：只在 terminal 和 desktop 上出现，desktop 上这一行显示当前步骤 | 只把 desktop 上光秃秃的 `Working` 换成主题词，具体的步骤描述原样保留 | 8913–8939，各 surface 的说明在 8911 |
| `Pane`：所有 surface 都有，用 `$.ui.open` 打开 | `/skin` 打开大号吉祥物卡片和设置 | 9098–9138，`ui.open` 2288 |
| 真实数据：上下文 token 数和占比、窗口大小、费用、5 小时和 7 天额度 | 气泡和遥测条里的数字都从这里取；拿不到的画成 `—`，气泡里也不提 | `$.session.usage` 2603，`SessionUsage` 10311–10338，`SessionRateLimit` 9893 |
| 模型、轮数、项目根目录 | 欢迎页和 HUD 显示"项目 · 模型" | `$.session.model/turns/repo/root` 2532–2561 |
| 插件自己的持久存储 | 外观、收起状态、"仪式已看过"、停止动画 | `$.store` 3080–3104 |
| 计时器 | 仪式放完自动切到 HUD | `$.clock.after` 3183 |
| 重画 | 一轮结束后刷新数字；每秒最多 10 次 | `$.ui.invalidate` 2169 |
| `Client`（surface module）：插件自己的模块在绘制线程上画一块区域，带帧时钟、键盘、指针和 `post` | 终端版启动仪式用它画字符动画，放完 `post({done})`，按任意键 `post({skip})` | `ClientModule` 1261，`ClientSurface` 1371–1426，`ui.message` 3694 |
| 测试工具：`$.ui.mount` 指定 surface；`advance`、`key`、`resize`、`select`、`press` | `tests/register.test.tsx` 的 11 个测试 | `EngineMount` 13314，`Mounted` 13795–13940 |

## 做不到（交给 owner 决定）

| 想做的 | 为什么做不到 | 类型位置 |
| --- | --- | --- |
| 整窗壁纸、大号时钟、侧栏和输入框的毛玻璃 | 插件只能往 engine 给的槽位里画树，碰不到 Desktop 的 DOM；也没有"窗口背景"这种槽位 | `RenderComponent` 8192 列出了所有槽位 |
| 改原生侧栏、设置页、弹窗、artifact 面板 | 同上，这些不在槽位列表里，权限弹窗也只由 engine 自己画 | 8188–8190 |
| 在 `Client` 里画矢量图 | `Client` 的元素表是终端那套，去掉了 `Client`、`Raster`、`Image`，也没有 `Svg`，desktop 上只能画字符格 | `ClientElements` 1230 |
| 用 Box 做动画或半透明 | `BoxProps` 里没有 opacity、transform、阴影和滤镜，动画只能写在 `Svg` 里 | 739–828 |
| SVG 里的按钮或点击 | 沙箱 frame 不允许脚本，事件属性会被清掉；要点击就在外面套一个 `Button` | 10893–10899 |
| 换 SVG 内容时保住动画进度 | 新的 `source` 会让 frame 重新加载，动画从头开始【推断，未在 Desktop 实测】。所以 HUD 只在一轮结束、数字真的变了的时候才重画，吉祥物每轮"重新探头报到"一次 | 8467–8469 |
| 在 SVG 里读 Desktop 的深浅模式和"减少动态"设置 | SVG 里写了 `prefers-color-scheme` 和 `prefers-reduced-motion`，但沙箱 frame 是否会继承 Desktop 的设置，没法实测【推断】。所以 `/skin dark\|light\|auto\|still` 提供了手动切换 | 无对应 API |
| 气泡显示"余额" | 没有余额 API。能拿到的只有本次会话费用和额度占比，余额就不显示 | 10304–10338 |
| 只在 desktop 一出现就开始仪式 | SDK 或 Desktop 会话的 `session.start.surface` 是 `null`，所以仪式在第一次画 `AbovePrompt` 时开始 | 10284–10287 |
| vscode 和 mobile 上的仪式和 HUD | vscode 没有 `Client`；mobile 没有 Input 和 Select。这两个 surface 上带子交回给 engine，pane 在 mobile 上只显示文字 | 3515–3547 |
| `TurnDuration`、`InfoNotice`、`ToolProgress` 换皮 | 这三个只在 terminal 上出现 | 8880、8944、8970 |

## terminal surface

terminal 上没有 `Svg`，所以代码按 surface 分开画：

- 启动仪式是一个 `Client`：阶段名、六边形一格格点亮、同步率读数和进度条。放完自动收起；在带子里按任意键（先用点击或 ctrl+x tab 聚焦）可以跳过。
- 仪式之后，带子只占一行：`◢◤ SCARLET LINK │ CTX … │ TOK … │ COST … │ MODEL … │ BOLT› …`。
- `/skin` 打开的 pane 是文字加控件。

在 tmux 里用 claude 2.1.284 加 `--plugin-dir` 实际跑过：

```
SCARLET LINK  SL-03 / 04
同步率爬升  SYNC RATE RISING
⬢ ⬢ ⬢ ⬢ ⬢ ⬢ ⬢ ⬢ ⬢
SYNC  61%  ████████████████████████████████░░░░░░░░░░░░░░░░
同步率爬升中，保持呼吸平稳 · 任意键跳过
[ 跳过 SKIP ]
```

```
◢◤ SCARLET LINK │ CTX — │ TOK — │ COST $0.00 │ MODEL opus 5.5 │ BOLT› 本次会话花了 $0.00
```

重启后仪式不会再放；`/skin boot` 会重放。

## docs 里的图是怎么来的

`boot-*.png`、`hud-*.png`、`pane-card-*.png`、`boot-reduced-motion.png` 和 `boot.mp4` 都来自同一份 SVG：就是 mod 交给 desktop `Svg` 元素的那份（`hooks/art.ts`），在无头 Chromium 里渲染后截的图和录屏。它们不是 Claude Desktop 的截图，原因见本页开头。

## 交接复验（2026-10-09）

- 使用本机 `/Users/jacksonc/.nvm/versions/node/v22.23.2/bin/claude`，版本 **2.1.284**。PATH 默认的 `/opt/homebrew/bin/claude` 是 **2.1.271**，会报 `session.root is not an event` / `$.ui.mount is not a function`；不要把旧运行时的失败当成相同版本回归。
- `PATH=/Users/jacksonc/.nvm/versions/node/v22.23.2/bin:$PATH npm test`：21 项通过（usageline 9、goal 1、desktop-skin 11）。新增测试先复现手动停止动画无效，再验证启动、HUD、pane 全部停动及恢复。
- `npx tsc -p desktop-skin/tsconfig.json`、2.1.284 的 `claude plugin validate desktop-skin` 和 `claude plugin validate .` 均通过。
- 根目录 `npm run typecheck` 仍失败于未改动的 `usageline/tests/register.test.ts`：usage mock 缺 `startedAt`，process mock 缺 `isStdoutTruncated` / `isStderrTruncated`。保留范围限制，不修改其他 mod。
- 再次读取应用版本与本地内置引擎目录，仍为 Desktop **1.24012.9** / CCD **2.1.219**。没有重启应用、开调试端口或尝试注入。
- 待兼容 Desktop 环境实测：安装后实际渲染、输入/发送/侧栏/设置/弹窗/artifact、系统深浅与减少动态的沙箱继承、帧率、禁用或卸载后的还原，以及真实截图和 15–20 秒录屏。当前证据不能代替这些验收。终端没有 OS 减少动态信号，使用 `/skin still`；跳过键需聚焦启动区域。
