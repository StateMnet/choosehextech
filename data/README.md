# data/ 目录说明

| 路径 | 维护方式 | 说明 |
|---|---|---|
| `champions.tsv` | **社区手工编辑** | 主数据表，一行一个套路（英雄 / 套路名 / 海克斯推荐 / 装备推荐 / 对局技巧 / 作者 / 适用版本） |
| `meta/items.tsv` | 手工维护 | 装备名称表（正式版由 Data Dragon 生成完整列表） |
| `meta/hextech.tsv` | 手工维护 | 海克斯强化名称表（由社区数据补充） |
| `meta/hextech-icons.csv` | 手工维护 | 海克斯强化名 → 图标文件名（同名共用一张图；图标文件放 CDN 包） |
| `meta/champion-icons.csv` | 手工维护 | 英雄名 → 头像 URL（爬取结果直接粘贴；缺失的英雄回退 Data Dragon 头像） |
| `meta/release.json` | 手工维护 | 数据版本号（dataVersion）与适用游戏版本（gamePatch） |
| `generated/aliases.csv` | **生成物，勿手改** | 国服译名 → 官方 championId，由 LCU 英雄目录生成 |
| `generated/champion-ids.csv` | **生成物，勿手改** | championId → LCU 数字 ID，由 LCU 英雄目录生成 |

生成物重建（需要英雄联盟客户端正在运行）：

    node --experimental-strip-types scripts/gen-all-champions.ts

数据校验与打包：

    node --experimental-strip-types scripts/validate.ts
    node --experimental-strip-types scripts/build-data.ts
