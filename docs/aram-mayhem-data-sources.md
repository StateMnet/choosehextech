# 海克斯大乱斗（ARAM Mayhem）数据源调研报告

> 面向「英雄联盟海克斯大乱斗助手」的数据源选型调研。目标数据形态为「每个英雄的套路」：
> **套路名 + 海克斯推荐（增幅/强化）+ 装备推荐**。
>
> **调研方法说明**：本会话运行在无出网能力的沙箱中，无法用脚本直接抓取页面正文；所有结论均通过
> `web_search` 工具追到一手来源（官方文档/官方 API/数据站点原始页面 URL）后，依据搜索结果返回的
> 页面标题、URL 形态与摘要核实。下文每个事实后都附有来源链接；凡标注「未在搜索中确认到」的，表示
> 多轮检索均未返回该站点对应页面 URL，属于「未发现覆盖」而非「确证不存在」。

---

## 1. 模式背景

### 1.1 名称与上线

| 项目 | 内容 | 来源 |
| --- | --- | --- |
| 国服名称 | 海克斯大乱斗 | [lol.qq.com 开发者日志：海克斯大乱斗](https://lol.qq.com/news/detail.shtml?docid=14645770214471584183)、[lol.qq.com 海克斯大乱斗超多新符文](https://lol.qq.com/news/detail_m.html?docid=6942755214558842600) |
| 国际服名称 | ARAM Mayhem | [League Wiki: ARAM: Mayhem](https://wiki.leagueoflegends.com/en-us/ARAM%3A_Mayhem)、[官方开发者博客 /dev: Bringing Mayhem to ARAM](https://www.leagueoflegends.com/en-au/news/dev/dev-bringing-mayhem-to-aram/) |
| 上线时间/版本 | V25.21（2025 年 11 月）上线 | [League Wiki: ARAM: Mayhem/Patch history（"since its live launch in V25.21"）](https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem/Patch_history)、[Strafe 报道 Dev Update](https://www.strafe.com/news/read/league-of-legends-dev-update-aram-mayhem-arcane-fractured-jinx-upgrades-smurfings-bans/) |
| 后续大版本 | 26.3 推出 "ARAM Mayhem 2.0"（进度/联动系统） | [arammayhem.com Patch 26.3](https://arammayhem.com/patch/26-3/) |

### 1.2 服务器覆盖

- 国际服（Riot 自营）：NA、EUW、EUNE、KR、JP、OCE、BR、LAS/LAN、RU、TR、SG、PH、TH、VN、TW 等。
- 国服（腾讯自营）：模式名为「海克斯大乱斗」，League Wiki 的排期表中明确标注 `Live (TENCENT)` 国服运营档期 —— [League Wiki: ARAM: Mayhem（"Live (TENCENT): Whole run"）](https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem?oldid=3990188&veaction=edit#3)。
- 官方客服文章：Riot Support 有专门的模式说明页 —— [Riot Support: League of Legends - ARAM: Mayhem Game Mode](https://support-leagueoflegends.riotgames.com/hc/en-us/articles/45460878435987-League-of-Legends-ARAM-Mayhem-Game-Mode)。
- 另有限时变体 "ARAM: Mayhem Classic-ish"，与官方「League Classic / Mayhem」系列 Dev Update 相关，是独立子模式（OP.GG 与 METAsrc 均单列为 `aram-mayhem-classic`）—— [G2A: ARAM Mayhem Classic-ish Confirmed](https://www.g2a.com/news/features/aram-mayhem-classic-ish-confirmed-for-league-of-legends/)、[官方 Dev Update: Classic, Mayhem & More](https://www.leagueoflegends.com/en-us/news/dev/tldw-classic-mayhem-more-dev-update/)。

### 1.3 数据上的特殊字段

- **增幅（Augment / 海克斯强化 / 海克斯符文）**：核心新增字段。初始选择界面固定填充 4 个增幅槽，其余在达到等级突破点时获得 —— [League Wiki: ARAM: Mayhem（"Four of the augment slots are always filled from the initial selection screen and the ones granted from reaching the level break..."）](https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem?oldid=3970448&veaction=edit#2)。增幅完整列表见 [League Wiki: ARAM: Mayhem/Augments](https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem/Augments)。
- **选人/规则字段**：全随机、盲选、无禁用（Draft type: All random, blind, no bans）—— [League Wiki: ARAM: Mayhem 修订记录](https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem?diff=cur&oldid=3986646#5)。
- **新增装备**：如 Hextech Gunblade 等模式专属新装备 —— [League Wiki: ARAM: Mayhem（"Hextech Gunblade - New item"）](https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem?mobileaction=toggle_view_mobile&oldid=3986646#2)。
- **禁用英雄**：选人无禁用（no bans），但模式参与英雄池为约 172 名 —— [arammayhem.com: All 172 ARAM Mayhem Champions](https://arammayhem.com/build/)；各版本是否有具体「禁用英雄」未在本次检索的一手页面中确认到明确清单，建议以客户端内实际英雄池为准。
- **召唤师技能替换**：部分增幅会替换召唤师技能（如 Orbital Laser 替换非闪现槽）—— [League Wiki: ARAM: Mayhem（"Replaces the summoner spell ... with Orbital Laser"）](https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem?oldid=3990184#2)。

---

## 2. OP.GG 覆盖结论（用户重点关心）

**一句话结论：OP.GG 已经有海克斯大乱斗的英雄子页面（胜率/出装/符文/技能加点），但页面字段仍是传统 ARAM 的
「Build / Runes / Items / Skills」，未发现「海克斯强化/增幅推荐」字段；且 OP.GG 官网不直接提供国服（腾讯服）数据。**

具体核实：

1. **有 ARAM Mayhem 专区（英雄维度）**：URL 形态为 `op.gg/lol/modes/aram-mayhem/{champion}/{build|runes|items|skills}`，以及限时变体
   `op.gg/lol/modes/aram-mayhem-classic/{champion}/build`。已实际检索到的页面：
   - [Graves ARAM: Mayhem - Build](https://op.gg/fr/lol/modes/aram-mayhem/graves/build)
   - [Amumu ARAM: Mayhem - Skills](https://op.gg/da/lol/modes/aram-mayhem/amumu/skills)
   - [Kayle ARAM: Mayhem Classic-ish - Build](https://op.gg/lol/modes/aram-mayhem-classic/kayle/build)
   - [Anivia ARAM: Mayhem Classic-ish - Build](https://op.gg/lol/modes/aram-mayhem-classic/anivia/build)
   - [Miss Fortune ARAM: Mayhem Classic-ish - Build](https://op.gg/lol/modes/aram-mayhem-classic/missfortune/build)

2. **提供字段**：页面标题统一为 `Build, Runes, Items, Skills`（无 "Augments"）。对比之下，u.gg 标题为
   `... Augments Guide`、METAsrc 为 `Augments, Items, Counters`、Blitz 为 `Builds and Augments`。因此可判断：
   OP.GG 的海克斯大乱斗页沿用其 ARAM 页字段（胜率、出装、符文、技能加点），**未提供「海克斯强化/增幅推荐」**。
   —— 见上述 OP.GG 页面标题 vs [U.GG Nilah ARAM Mayhem Augments Guide](https://u.gg/lol/champions/aram-mayhem/nilah-aram-mayhem)、
   [METAsrc Udyr ARAM: Mayhem Build – Augments](https://www.metasrc.com/lol/mayhem/champions/udyr/build)、
   [Blitz.gg Lucian ARAM Mayhem Builds and Augments](https://blitz.gg/vi/lol/champions/Lucian/aram-mayhem)。

3. **国服数据**：OP.GG 官网不直接支持国服（腾讯服）查询，有第三方「OPGG 国内版」等应用但非官方 ——
   [游侠网：《英雄联盟》opgg不能查国服原因介绍](https://gl.ali213.net/html/2024-2/1308463.html)、
   [游侠网：《英雄联盟》opgg查国服战绩介绍](https://gl.ali213.net/html/2024-2/1308477.html)。

> 对助手而言：OP.GG 可用作「外服海克斯大乱斗胜率/出装」的补充来源，但**不满足三个字段中的「海克斯推荐」**，
> 也无法直接服务国服用户。

---

## 3. 各数据/攻略站点逐个评估

> 判定口径：站点是否「按英雄」给出 **套路名 + 增幅推荐 + 装备推荐**。
> 字段简称：🧭=套路名（命名流派）、🔮=海克斯/增幅推荐、🛡️=装备推荐。

### 3.1 海外统计/攻略站

| 站点 | ARAM Mayhem 覆盖 | 🔮增幅 | 🛡️装备 | 🧭套路名 | 语言 | 代表 URL |
| --- | --- | --- | --- | --- | --- | --- |
| **OP.GG** | 有（英雄子页） | ❌ 未见 | ✅ | ❌ | 多语 | [Graves ARAM: Mayhem](https://op.gg/fr/lol/modes/aram-mayhem/graves/build) |
| **u.gg** | 有（英雄专页 + 新闻 tier list） | ✅ | ✅ | ❌ | 英/韩等 | [U.GG Nilah ARAM Mayhem Augments Guide](https://u.gg/lol/champions/aram-mayhem/nilah-aram-mayhem)、[U.GG ARAM Mayhem Tier List 新闻](https://u.gg/lol/news/aram-mayhem-tier-list) |
| **METAsrc** | 有（最完整的区域/段位/版本参数化） | ✅ | ✅ | ❌ | 英 | [METAsrc Udyr ARAM: Mayhem Build – Augments, Items, Counters](https://www.metasrc.com/lol/mayhem/champions/udyr/build)、[METAsrc Augment Tier List](https://www.metasrc.com/lol/mayhem/tier-list/augments) |
| **Mobalytics** | 有（专区 + 英雄 + 指南） | ✅ | ✅ | ❌ | 英 | [Mobalytics ARAM Mayhem 专区](https://mobalytics.gg/lol/aram-mayhem)、[Twitch Mayhem Build – Augments, Items](https://mobalytics.gg/lol/champions/twitch/mayhem-builds)、[ARAM Mayhem Tier List](https://mobalytics.gg/lol/guides/aram-mayhem-tier-list) |
| **Blitz.gg** | 有（英雄专页） | ✅ | ✅ | ❌ | 英/多语 | [Blitz.gg Lucian ARAM Mayhem Builds and Augments](https://blitz.gg/vi/lol/champions/Lucian/aram-mayhem) |
| **lolalytics.com** | ❌ 未在搜索中确认到 | — | — | — | — | （多轮检索均未返回 lolalytics 的 Mayhem 页） |
| **leagueofgraphs / porofessor** | ❌ 未在搜索中确认到 | — | — | — | — | （检索返回均为 metasrc/aramgg 等） |

### 3.2 海克斯大乱斗专用站（重点）

| 站点 | 定位 | 🔮增幅 | 🛡️装备 | 🧭套路名 | 语言 | 代表 URL |
| --- | --- | --- | --- | --- | --- | --- |
| **aramgg.com** | 海斗专用数据+攻略平台（有 zh-CN/zh-TW/en） | ✅（每英雄 "Tier & Augments"） | ✅ | ✅（博客命名流派，如「自爆流」「AP 赵信补丁流」） | 简中/繁中/英 | [首页](https://aramgg.com/en)、[Kennen champion-stats](https://aramgg.com/en/champion-stats/85)、[增幅分级 en/augments](https://aramgg.com/en/augments)、[自爆流攻略 zh-CN](https://aramgg.com/zh-CN/blog/self-destruct-flow-guide)、[关于/数据来源](https://aramgg.com/zh-CN/about#data-sources) |
| **arammayhem.com** | 海斗专用站（zh-cn/zh-tw/en），含 combo/增幅单独页 | ✅ | ✅ | ❌（无命名套路，按英雄+增幅给 combo） | 简中/繁中/英 | [172 英雄 build](https://arammayhem.com/build/)、[赵信 zh-tw build（装备/强化符文/胜率）](http://arammayhem.com/zh-tw/build/xinzhao/#combos)、[Hextech Soul 增幅页](https://arammayhem.com/augments/hextech-soul/)、[Maokai+Void Rift combo](https://arammayhem.com/combo/maokai-%e8%99%9a%e7%a9%ba%e8%a3%82%e9%9a%99%e6%b5%81/) |
| **apexlol.info** | 海斗 Wiki（zh/zh-Hant/en/ko），增幅×英雄联动 | ✅（每英雄 "Best Augments"、每增幅联动英雄） | 部分 | ❌ | 简中/繁中/英/韩 | [弗拉迪米尔 Best Augments](https://apexlol.info/zh-Hant/champions/Vladimir)、[回归基本功 海克斯符文(zh)](https://apexlol.info/zh/hextech/1004)、[tier list](https://apexlol.info/en/tier-list) |

> 三个专用站里，**aramgg.com 与 arammayhem.com 同时提供中文 + 按英雄的增幅/装备推荐**，是最贴合「国服中文用户 + 三字段」需求的数据源。
> 其中「套路名」这一字段最稀缺：结构化统计站普遍只给「最佳出装/最佳增幅」，不给命名套路；命名套路（自爆流、心之钢流、
> AP 补丁流等）主要出现在 aramgg 博客、B 站/头条/贴吧攻略里。

### 3.3 中文攻略/内容站

| 站点 | 形态 | 是否「按英雄三字段」 | 代表 URL |
| --- | --- | --- | --- |
| **游民星空（gamersky）** | 有「海克斯大乱斗查询工具」（海斗 3.0，PC+APP） | ✅ 数据整理工具（英雄表现+海克斯强化） | [游民星空 海斗工具反馈贴](https://club.gamersky.com/activity/1587068)、[网易转载：海斗 3.0 查询工具上线](https://www.163.com/dy/article/L2FADJSB0526K1KN.html) |
| **17173** | 攻略文章（按英雄，如「封魔剑魂=永恩」） | ✅ 单篇攻略含增幅+出装 | [17173 海克斯大乱斗封魔剑魂怎么玩](https://news.17173.com/content/02142026/093246329.shtml) |
| **掌上英雄联盟（掌盟）** | 官方 App，已上线「海克斯大乱斗助手」 | ✅（官方数据，最贴近国服） | [腾讯新闻：锐评掌盟海克斯大乱斗助手](https://news.qq.com/rain/a/20260513A063AJ00) |
| **NGA** | 社区讨论/攻略帖 | 部分（人工、非结构化） | [NGA 海斗卡莎出装帖](https://bbs.nga.cn/read.php?tid=47355206&page=e&rand=973) |
| **B 站** | 视频攻略 | ❌ 非结构化数据 | [B 站海克斯大乱斗相关视频](https://www.bilibili.com/video/BV18y9vBmEAX/) |
| **百度贴吧** | 极地大乱斗吧等帖子 | 部分（人工） | [贴吧 极地大乱斗吧 出装帖](https://www.tieba.com/p/6997956075) |
| **今日头条/抖音/小红书** | 用户生成内容 | ❌ 非结构化、时效参差 | [头条 加里奥海斗出装](https://www.toutiao.com/article/7641584753669456410/)、[小红书 砍伤推荐出装](https://www.xiaohongshu.com/discovery/item/6987139e0000000028008936) |
| **WeGame 助手** | 未在本次检索中确认到海斗专属数据 | — | — |

---

## 4. 可编程数据来源明细（做助手程序的重点）

### 4.1 Riot 官方静态数据：Data Dragon

- Data Dragon 提供 champion / item / map / rune / spell 等静态数据，**不包含海克斯大乱斗的增幅（augment）定义**；
  增幅数据位于游戏客户端内部的 `modespecificdata`，由社区镜像 CommunityDragon 提供（见 4.3）。
- Data Dragon 文档与端点清单见 [riot-api-libraries: Data Dragon](https://riot-api-libraries.readthedocs.io/en/latest/ddragon.html)、
  [Hextechdocs: ddragon](https://hextechdocs.dev/tag/ddragon/)。
- 结论：**Data Dragon 不适合拿增幅定义**，只适合拿英雄/装备基础静态数据。

### 4.2 Riot Developer API（match-v5 等）

- **对局增幅字段**：`match-v5` 的 `ParticipantDto` 存在 `playerAugment1` ~ `playerAugment6` 字段，但文档缺失（undocumented），
  且 `playerAugment5/6` 恒为 0 的 bug ——
  [Issue #754（undocumented match-v5.ParticipantDto fields）](https://github.com/RiotGames/developer-relations/issues/754)、
  [Issue #1059（playerAugment5 & playerAugment6 always 0）](https://github.com/RiotGames/developer-relations/issues/1059)。
- **海克斯大乱斗对局 403**：`match-v5` 拉取 ARAM: Mayhem 对局当前返回 `403 Forbidden`（已知 bug，尚未修复）——
  [Issue #1109（ARAM: Mayhem matches return 403 Forbidden）](https://github.com/RiotGames/developer-relations/issues/1109)。
- **国服覆盖**：Riot Developer API 只覆盖 Riot 自营平台路由（NA1/EUW1/KR/JP1/TW2/VN2/SG2/PH2/TH2/TR1/BR1/LA1/LA2/OC1/RU 等），
  **不含腾讯国服**。路由平台清单见 [darkintaqt: Platforms, regions and how to route](https://darkintaqt.com/blog/routing)、
  [Hextechdocs: Getting Started With The Riot Games API](https://hextechdocs.dev/getting-started-with-the-riot-games-api/)。
- 结论：**外服**可用 match-v5 拿对局级增幅选择统计（需等 403 bug 修复）；**国服无 Riot API**，只能靠腾讯系/社区数据。

### 4.3 社区静态数据：CommunityDragon（★ 增幅定义首选）

- CommunityDragon 是游戏客户端文件的社区镜像，**已经包含海克斯大乱斗增幅静态数据**，位于：
  `https://raw.communitydragon.org/latest/game/maps/modespecificdata/` ——
  [raw.communitydragon.org /latest/game/maps/modespecificdata/](https://raw.communitydragon.org/latest/game/maps/modespecificdata/)。
- 具体增幅子目录（含版本化路径）：
  - `/latest/game/maps/modespecificdata/augments/fetch/` —— [augments/fetch](https://raw.communitydragon.org/15.23/game/maps/modespecificdata/augments/fetch/?C=N&O=D)
  - `/latest/game/maps/modespecificdata/augments/finalform/` —— [augments/finalform](https://raw.communitydragon.org/15.23/game/maps/modespecificdata/augments/finalform/?C=S&O=A)
- 文档与格式说明见 [CommunityDragon 文档](https://www.communitydragon.org/documentation)、[GitHub CommunityDragon/Docs](https://github.com/CommunityDragon/Docs)。
- 结论：**海克斯增幅的 ID/名称/图标/文本可直接从 CommunityDragon 取**，逐版本更新；文本为英文，中文名需自行映射
  （可对照 League Wiki 的中文站或 apexlol.info 的中文页面建立 ID↔中文名表）。

### 4.4 各数据站的可编程接口形态（浏览器视角推断）

> 以下站点均**未见公开 JSON API 文档**，需通过抓取 HTML 或从页面 XHR 逆向内部接口（注意 robots/ToS）。

| 站点 | 可推断的 URL 形态 | 是否易程序化 | 说明 |
| --- | --- | --- | --- |
| **aramgg.com** | `/en|zh-CN|zh-TW/champion-stats/{championId}`、`/en/augments`、`/zh-CN/blog/{slug}` | 中等（静态/SSR 页面，championId 为数字） | 每英雄页含 Tier + Augments + Items；有桌面客户端 [aramgg.com/zh-CN/client](https://aramgg.com/zh-CN/client) |
| **arammayhem.com** | `/zh-cn|zh-tw|en/build/{champ}/`、`/augments/{slug}/`、`/combo/{champ}-{augment}/`、`/tier-list/`、`/patch/{ver}/` | 中等 | 中文 build 页标题含「装备、强化符文与胜率」 |
| **apexlol.info** | `/zh|zh-Hant|en|ko/hextech/{id}`、`/champions/{Name}` | 中等 | 增幅页为「联动英雄与机制」，可作中文名映射源 |
| **METAsrc** | `/lol/mayhem/{region}/{patch}/champions/{champ}/build`、`/lol/mayhem/tier-list/augments?region=&patch=&ranks=` | 较高（URL 参数化完整） | 区域/段位/版本全覆盖 |
| **u.gg** | `/lol/champions/aram-mayhem/{champ}-aram-mayhem` | 低（SPA + Cloudflare，反爬强） | 内部 API 未公开 |
| **Blitz.gg** | `/lol/champions/{Champ}/aram-mayhem` | 低（SPA，反爬强） | — |
| **Mobalytics** | `/lol/champions/{champ}/mayhem-builds`、`/lol/guides/aram-mayhem-*` | 低-中 | — |

### 4.5 腾讯国服官方（101.qq.com / 掌上英雄联盟）

- 未检索到腾讯官方向第三方公开的、可用于程序化调用的海克斯大乱斗数据接口；掌盟的「海克斯大乱斗助手」为 App 内功能，
  无公开 API 文档 —— [腾讯新闻：锐评掌盟海克斯大乱斗助手](https://news.qq.com/rain/a/20260513A063AJ00)。
- 结论：**国服官方数据目前不可编程获取**，只能作为人工/产品参考（掌盟助手、游民星空查询工具）。

---

## 5. 推荐数据方案（排序）

按「优先保证中文 + 三字段 + 可程序化」综合排序：

| 优先级 | 用途 | 推荐来源 | 可提供的字段 | 语言 | 更新频率（估） | 程序化方式 |
| --- | --- | --- | --- | --- | --- | --- |
| **P0** | 增幅/英雄静态数据（ID、名称、图标、文本、数值） | **CommunityDragon `modespecificdata`** | 🔮（定义层） | 英（ID 需映射中文） | 每版本 | 直连 JSON（免费 CDN） |
| **P0** | 按英雄的增幅+装备推荐（中文） | **aramgg.com**（主）+ **arammayhem.com**（辅） | 🔮 + 🛡️ | 简中/繁中 | 每版本~每 1-2 周 | 抓 HTML（SSR 页面，较友好） |
| **P1** | 增幅↔英雄联动、中文名映射 | **apexlol.info**（`/hextech/{id}`、`/champions/{name}`） | 🔮（联动）+ 中文名 | 简中/繁中 | 每版本 | 抓 HTML |
| **P1** | 外服对局统计（增幅选择胜率、出装统计） | **Riot match-v5**（等 403 bug 修复）+ **METAsrc/u.gg** 页面 | 🔮 + 🛡️（统计） | 英 | 实时/每版本 | API（外服）；页面抓取（反爬注意） |
| **P2** | 命名「套路名」+ 国服特色攻略 | **aramgg 博客**、**B 站/17173/游民星空/贴吧/掌盟** 人工整理 | 🧭（套路名）+ 🔮 + 🛡️ | 简中 | 不定期 | 人工维护/定时抓取 |
| **P2** | 国服官方数据参考 | **掌盟海斗助手 / 游民星空查询工具** | 参考（不可编程） | 简中 | 每版本 | 无公开接口 |

**首选数据组合方案（一句话）**：静态增幅定义走 **CommunityDragon**，中文「每英雄增幅+装备推荐」抓
**aramgg.com（zh-CN）为主、arammayhem.com（zh-cn）与 apexlol.info（中文增幅联动）为辅**，外服统计用
**Riot match-v5 + METAsrc/u.gg** 补强，「套路名」与国服特色用 **B 站/17173/游民星空/掌盟** 人工整理。

---

## 6. 风险与注意事项

1. **Riot API 现状风险**：match-v5 拉 ARAM: Mayhem 对局当前 403（[Issue #1109](https://github.com/RiotGames/developer-relations/issues/1109)），
   增幅字段文档缺失且 5/6 恒 0（[Issue #754](https://github.com/RiotGames/developer-relations/issues/754)、
   [Issue #1059](https://github.com/RiotGames/developer-relations/issues/1059)）——外服对局统计方案需等修复，不应作为当前唯一依赖。
2. **国服无官方 API**：Riot Developer API 不含腾讯国服；腾讯 101.qq.com/掌盟无公开数据接口，国服数据只能靠抓社区站或人工整理。
3. **反爬/ToS**：u.gg、Blitz 有 Cloudflare 等反爬；抓取任何站点前应查阅其 robots.txt 与 ToS，控制频率、注明来源。
   aramgg/arammayhem/apexlol 为社区站，页面相对友好，但仍建议礼貌抓取并缓存。
4. **版权**：英雄联盟静态数据版权归 Riot Games（参见 Riot 官方 [Data Dragon / 法律条款](https://riot-api-libraries.readthedocs.io/en/latest/ddragon.html)）；
   CommunityDragon 为社区镜像，使用其数据同样受 Riot 条款约束。商业使用前需核对 Riot 的
   [数据使用政策](https://developer.riotgames.com/)。
5. **中文名映射**：CommunityDragon / Riot API 的增幅与英雄均为英文/ID，需建立 ID↔中文名映射表
   （可对齐 apexlol.info 中文页、League Wiki 中文站、国服客户端术语）。
6. **「套路名」字段稀缺**：结构化统计站普遍不给命名套路，需人工维护；命名套路时效短、主观性强，建议做成「标签 + 人工审核」。
7. **更新频率估计**：CommunityDragon 每版本；数据站每版本或每 1-2 周刷新；B 站/贴吧/头条类内容不定期、质量参差，
   需时效过滤（如按最近 1-2 个版本筛选）。
