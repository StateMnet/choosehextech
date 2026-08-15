<p align="center">
  <img src="logo.png" alt="ChooseHextech" width="140" />
</p>

<h1 align="center">ChooseHextech</h1>

<p align="center"><strong>《英雄联盟》海克斯大乱斗（海斗）辅助助手</strong> · Windows 桌面端</p>

<p align="center">选人界面实时参考 · 游戏内置顶浮窗 · 全英雄套路数据 · 开源免费 · 合规安全</p>

<p align="center">
  <code>173 位英雄</code> ·
  <code>675 条套路</code> ·
  <code>209 个海克斯强化</code> ·
  <code>216 件装备图标</code> ·
  <code>版本 26.16</code>
</p>

选人界面实时展示英雄套路、海克斯强化推荐、装备出装与对局技巧；游戏内可用热键唤出置顶浮窗随时查阅。开源、免费、纯静态参考信息工具。

## ✨ 特点优势

**数据全、来源真**
- 覆盖 **173 位英雄、675 条套路**（T1~T5 全层级），每英雄至少 1 条常规套路 + 社区玩家自编套路（如「炼狱导管无限W流」「终极刷新无限大招流」）。
- 海克斯强化、装备名称全部对照 **游戏内官方译名** 与国服对局统计（ARAMGG / 腾讯国服公开统计）逐一校验，绝不编造。
- 图标全部为可直链加载的 https 资源：强化 209 个、装备 216 件（腾讯官方素材 + 海斗专有装备图标）。

**选英雄决策快**
- 客户端连接后自动识别选人阶段，按英雄即时展示：推荐海克斯（按胜率排序）、出装顺序（出门装→核心三件→情境装备）、对局技巧。
- 支持数字 ID 与译名搜索、关键词过滤、快捷英雄列表（我方 / 队友 / 备选池去重分组）。

**轻量离线**
- 数据编译为版本化 JSON 包（`dist/data-*.json`），纯静态、无网络依赖、无过期签名。
- 桌面端 Electron + 托盘常驻，游戏内浮窗热键唤出，不遮挡关键信息。

**工程化数据管线**
- `data/` 一表一格式（TSV），社区可手工编辑；`pnpm validate` 严格校验名称 / 格式 / 字数，CI 强制。
- 采集管线（`collect/`）脚本化：抓取 → 解析 → 校验 → 打包全自动，版本更新后一键重跑。

**合规安全（详见下方红线）**
- 不读内存、不注入进程、不自动操作、不做实时对局提示，纯展示社区预写静态攻略，账号风险最低。

## 🚀 快速入门

### 环境要求
- Windows 10/11
- Node.js **22.6+**（建议 22.18+，原生 TS 类型擦除默认开启）
- pnpm **9**（Node 自带 Corepack：终端执行 `corepack enable` 后重开终端即可）

### 第一步：安装依赖

```powershell
pnpm install
```

受限网络环境（跳过生命周期脚本）：

```powershell
pnpm install --ignore-scripts
node node_modules/electron/install.js   # 手动下载 Electron 二进制
```

### 第二步：开发模式运行桌面端

```powershell
pnpm --filter @choosehextech/desktop dev
```

或在项目根目录直接双击/运行：

```powershell
dev-desktop.cmd
```

启动后：登录并打开英雄联盟客户端 → 进入选人界面即自动展示面板；游戏内用热键唤出浮窗；托盘图标可开关/退出。

### 第三步：数据校验、测试与打包

```powershell
pnpm validate      # 校验 data/champions.tsv 与 meta 表（CI 强制）
pnpm test          # 单测（data-core / lcu-client / game-session / desktop-logic）
pnpm typecheck     # TypeScript 类型检查
pnpm build:data    # 打包数据包 → dist/data-{version}.json + manifest.json
```

生产构建与发布：

```powershell
pnpm --filter @choosehextech/desktop build    # 构建 out/ 产物
pnpm --filter @choosehextech/desktop dist     # 打包安装程序（首次需联网下载打包工具）
```

产物在 `apps/desktop/release/`，将 `ChooseHextech-Setup-*.exe` 上传 GitHub Releases 即可发布。

### 修改数据后

1. 编辑 `data/champions.tsv`（或 `data/userjson/` 后运行 `collect/scripts/userjson-merge.mts` 合并）；
2. 重新打包：`node --experimental-strip-types scripts/build-data.ts`。

> 中文 Windows 终端乱码时先执行 `chcp 65001`；脚本与测试均用 `node --experimental-strip-types` 直接运行，不依赖转译器。

## 当前状态

- ✅ **M0 数据奠基**：仓库骨架、数据格式、校验/打包管线、单测全绿。
- ✅ **M1 逻辑层**：`packages/lcu-client`（lockfile + 日志 + 进程命令行三通道发现客户端）与 `packages/game-session`（对局状态机 + SessionTracker），配套 `tests/mock-lcu` 模拟服务器。
- ✅ **M1 桌面端**：Electron 面板 + 托盘，国服客户端连接、选人识别、全英雄数据展示。
- ✅ **M2 数据接入**：全量采集管线（`collect/`）落地 —— 173 英雄 / 675 套路 / 209 强化 / 154+ 装备，社区套路已并入主数据表，版本 26.16。

设计文档见 `docs/DESIGN.md`。

## 合规红线（重要）

本工具只展示社区预先编写的静态攻略数据，绝不越界：

- 不读取游戏内存、不注入游戏进程、不自动化任何操作（含自动选人/自动点符文）；
- 不调用英雄联盟客户端任何写操作接口；
- 不开发任何由实时对局状态驱动的提示功能（计时、走位、敌方动向等）；
- 不接受任何引入上述能力的 Pull Request。

依据：Riot「第三方程式」政策及 2025 年对实时信息类悬浮窗的封禁先例。详见 `docs/DESIGN.md` 第 8 章。

## 目录结构

- `data/` — 数据源：`champions.tsv`（主数据表，675 条）、`meta/`（强化/装备名称与图标对照表）、`generated/`（生成物，勿手改）、`userjson/`（社区套路源数据，可编辑）
- `packages/data-core` — 数据解析、校验、schema、打包（纯 TS，无 Electron 依赖）
- `packages/lcu-client` — 英雄联盟客户端 API（lockfile + 日志 + 进程命令行三通道发现）
- `packages/game-session` — 对局状态机（纯 TS，可单测）
- `apps/desktop` — Electron 桌面端（面板 + 托盘）
- `scripts/` — 数据管线（validate / build-data / gen-all-champions）
- `scripts/dev/` — 联调工具（inspect-lcu / probe-lcu / watch-champselect / gen-tray-icon）
- `collect/` — 数据采集工作区（爬取脚本 + 中间产物，详见 `collect/README.md`）
- `docs/` — 设计文档（DESIGN.md）
- `tests/` — 单测 + mock-lcu 模拟服务器

## 数据格式

一行一个套路，TSV 表格，`data/champions.tsv`：

```
英雄  套路名  海克斯推荐  装备推荐  对局技巧  作者  适用版本
```

- 海克斯推荐、装备推荐用顿号（`、`）分隔；对局技巧多条用全角分号（`；`）分隔。
- 名称以国服官方译名为准，`pnpm validate` 会对照 `data/generated/aliases.csv`、`meta/hextech.tsv`、`meta/items.tsv` 严格校验。

## 许可

- 代码：MIT（见 LICENSE）
- 数据：CC BY-SA 4.0（见 DATA-LICENSE.md）
- Riot 素材（英雄/装备图标等）版权归 Riot Games 所有，本项目不随仓库分发。

## 免责声明

本项目非 Riot Games 官方产品，与 Riot 无关联。使用第三方工具存在账号风险，请知悉 Riot 相关政策后自行决定是否使用。
