# collect/ — 海克斯大乱斗攻略数据采集工作区

临时采集工作区：脚本与中间数据都在这里，**尚未并入** `data/` 正式管线（见根目录 README）。

## 目录

```
collect/
├── scripts/            采集与解析脚本（Node 22 原生 TS，直接运行）
│   ├── fetch-cdragon-hextech.mts    CDragon 官方静态数据探测/下载
│   ├── parse-aramgg.mts             ARAMGG 强化列表页解析（205 个强化）
│   ├── gen-checklist.mts            强化清单核对文档生成
│   ├── parse-home.mts               ARAMGG 首页英雄强度榜解析（173 英雄）
│   ├── fetch-champ-pages.mts        批量抓取英雄详情页
│   ├── parse-champ-pages.mts        详情页解析（强化top10/装备配置）
│   ├── gen-guides.mts               生成攻略数据骨架（最终 JSON 的机械部分）
│   ├── merge-tips.mts               合并 LLM 编写的 tips
│   └── debug-rows.mts / test-regex.mts   调试用，可删
└── output/             数据产物（按生成顺序）
    ├── raw/                          原始下载文件（HTML/JSON）
    ├── augments-aramgg.json          205 个强化：id/中文名/稀有度/描述/适配英雄
    ├── hextech-augments-checklist.md 强化清单核对文档
    ├── home-ranking.json             173 英雄排行：排名/T层级/首页推荐强化
    ├── champ-pages.json              20 热门英雄详情：强化top10/3套核心装备/出门装/情境装备/流派标签+胜率
    ├── champions-guides.json         攻略骨架（tips 待填）
    ├── tips-part1.json / tips-part2.json   LLM 编写的技巧（subagent 产物）
    └── guides-final.json             最终交付（严格符合采集 prompt 的 JSON 格式）
```

## 数据源

| 源 | 用途 | 许可/合规 |
| --- | --- | --- |
| aramgg.com（海斗专门数据站） | 英雄强度排行、海克斯强化推荐（按国服胜率排序）、装备三件套/出门装/情境装备 | 页面声明"腾讯国服公开统计"；爬取仅作参考数据，发布时需注明来源 |
| CommunityDragon（raw.communitydragon.org） | Riot 客户端原始静态数据：官方强化池 augment-lists.json（266 个路径） | Riot 素材版权归 Riot；本项目不随仓库分发素材 |
| ddragon / 官方公告 | 版本号核对 | 当前版本 26.16 |

## 常用命令

```powershell
# 全部脚本均用 Node 22 原生类型擦除运行
node --experimental-strip-types collect/scripts/fetch-champ-pages.mts 20   # 抓前20英雄详情页
node --experimental-strip-types collect/scripts/parse-champ-pages.mts      # 解析详情页
node --experimental-strip-types collect/scripts/gen-guides.mts             # 生成骨架
node --experimental-strip-types collect/scripts/merge-tips.mts             # 合并 tips
```

## 采集 prompt 落点说明

用户提供的采集 prompt 的字段落点：

- `champion`：ARAMGG 名称去称号（"暗夜猎手 薇恩"→"薇恩"）
- `buildName`：由详情页流派标签映射（AD/Crit→暴击流 等）
- `hextech`：每英雄胜率 top8 强化（prompt 要求 8~10，取 8）
- `items`：出门装 + 核心三件套 + 情境装备，按出装顺序去重取 6~8 件
- `tips`：LLM 编写（每条 ≤60 字，一条一句），不确定写"暂无"
- `patch`：26.16（2026-08-13 国服版本）

## 待办 / 注意

- 强化清单 205（ARAMGG） vs 266（CDragon 官方池）：差异项待人工核对
- 芸阿娜等新英雄的 tips 可能为"暂无"，待人工补充
- 正式并入 data/champions.tsv 前需人工校验 + 遵守 CC BY-SA 4.0 数据许可
