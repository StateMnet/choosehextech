# ChooseHextech

海克斯大乱斗辅助助手（Windows）。选人界面展示英雄套路、海克斯推荐、装备推荐、对局技巧；游戏内热键唤出置顶浮窗查阅。开源、免费、纯静态参考信息工具。

## 当前状态

- M0 数据奠基 ✅：仓库骨架、数据格式、校验/打包管线、单测全部跑通（data/ 内为 10 个热门英雄的**占位样例数据**，正式数据待接入）。
- M1 逻辑层 ✅：packages/lcu-client（lockfile 发现 + REST + WAMP 订阅）与 packages/game-session（对局状态机 + SessionTracker）完成，配套 tests/mock-lcu 本地模拟服务器，26 项测试全绿。
- M1 桌面端 ✅：apps/desktop 真机验收通过（国服客户端连接、选人识别、托盘、全英雄占位数据）；全英雄占位数据由 LCU 英雄目录生成（scripts/gen-all-champions.ts，172 英雄），其中 10 个英雄有手工样例行。42 项测试全绿。
- M2 起：游戏内浮窗等。

设计文档见 docs/DESIGN.md。

## 合规红线（重要）

本工具只展示社区预先编写的静态攻略数据，绝不越界：

- 不读取游戏内存、不注入游戏进程、不自动化任何操作（含自动选人/自动点符文）；
- 不调用英雄联盟客户端任何写操作接口；
- 不开发任何由实时对局状态驱动的提示功能（计时、走位、敌方动向等）；
- 不接受任何引入上述能力的 Pull Request。

依据：Riot「第三方程式」政策及 2025 年对实时信息类悬浮窗的封禁先例。详见 docs/DESIGN.md 第 8 章。

## 开发命令

需要 Node.js 22+ 与 pnpm 9。

    pnpm install      # 安装依赖（受限沙箱环境用：pnpm install --ignore-scripts）
    pnpm validate     # 校验 data/champions.tsv（CI 强制）
    pnpm test         # 运行单测
    pnpm typecheck    # TypeScript 检查
    pnpm build:data   # 打包 dist/data-{version}.json + manifest.json
    pnpm inspect      # 真机联调：只读探测运行中客户端的对局状态

桌面端（apps/desktop，在普通开发环境执行）：

    pnpm --filter @choosehextech/desktop dev     # 开发模式（HMR + 重启）
    pnpm --filter @choosehextech/desktop build   # 构建 out/ 产物

本机没有 pnpm 时，Windows 可直接用仓库内快捷脚本（无需安装任何东西）：

    dev-desktop.cmd      # 桌面端开发模式
    build-desktop.cmd    # 桌面端构建

或一次性安装 pnpm 到 PATH：终端执行 corepack enable（Node 22 自带 Corepack），重开终端后即可使用 pnpm。

修改 data/ 数据后需重新打包（本机无 pnpm 也可用）：

    node --experimental-strip-types scripts/build-data.ts

环境备注：

- 中文 Windows 终端若出现乱码（GBK/UTF-8 混用），在终端先执行 chcp 65001 切到 UTF-8 代码页，或使用 Windows Terminal。桌面端与控制台工具的日志已改英文，不受影响；数据校验等脚本的中文提示需要此设置。
- 脚本与测试直接用 Node 22 原生 TypeScript 类型擦除（--experimental-strip-types）运行，不依赖 tsx 等转译器；要求 Node 22.6+，建议 22.18+（类型擦除默认开启）。
- 测试是纯断言脚本（tests/data.test.ts），不依赖 test runner 的子进程模型，受限环境与 CI 行为一致。
- 本机受限沙箱禁止子进程管道通信，因此安装依赖时跳过生命周期脚本；M1 引入 Electron 后需手动执行 node node_modules/electron/install.js 下载二进制。CI（GitHub Actions）无此限制。

## 目录结构

- data/ — 数据源：champions.tsv（主数据表，社区直接编辑）、meta/（手工对照表）、generated/（生成物，勿手改，见 data/README.md）
- packages/data-core — 数据解析、校验、schema、打包（纯 TS，无 Electron 依赖）
- packages/lcu-client — 英雄联盟客户端 API（lockfile + 日志 + 进程命令行三通道发现）
- packages/game-session — 对局状态机（纯 TS，可单测）
- apps/desktop — Electron 桌面端（面板 + 托盘）
- scripts/ — 数据管线（validate / build-data / gen-all-champions）
- scripts/dev/ — 联调工具（inspect-lcu / probe-lcu / watch-champselect / gen-tray-icon）
- docs/ — 设计文档（DESIGN.md）
- tests/ — 单测 + mock-lcu 模拟服务器

## 数据格式

一行一个套路，TSV 表格，data/champions.tsv：

    英雄  套路名  海克斯推荐  装备推荐  对局技巧  作者  适用版本

海克斯推荐与装备推荐用顿号（、）分隔；对局技巧用全角分号（；）分隔多条。

## 许可

- 代码：MIT（见 LICENSE）
- 数据：CC BY-SA 4.0（见 DATA-LICENSE.md）
- Riot 素材（英雄/装备图标等）版权归 Riot Games 所有，本项目不随仓库分发。

## 免责声明

本项目非 Riot Games 官方产品，与 Riot 无关联。使用第三方工具存在账号风险，请知悉 Riot 相关政策后自行决定是否使用。
