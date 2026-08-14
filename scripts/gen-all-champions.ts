import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { request as httpsRequest } from 'node:https';
import { discoverLcu } from '../packages/lcu-client/src/index.ts';
import { parseSimpleCsv, parseTsv } from '../packages/data-core/src/index.ts';

// 数据生成器（一次性引导）：从 LCU 英雄目录（/lol-game-data/assets/v1/champion-summary.json）
// 生成全英雄 aliases/champion-ids 映射与占位套路（保留现有手工样例行）。
// LCU 不可用时回退 Data Dragon（注意：ddragon 的 zh_CN name 是称号而非玩家名）。
// 正式数据接入后，占位行由社区逐个替换。
function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, { signal: AbortSignal.timeout(30000) }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

interface ChampionEntry {
  championId: string;
  nameZh: string;
  numericId: string;
}

const root = join(import.meta.dirname, '..');
const dataDir = join(root, 'data');
const release = JSON.parse(readFileSync(join(dataDir, 'meta', 'release.json'), 'utf8')) as { gamePatch: string };

// 现有行按 championId 归位（宽松反查：同名时优先真实英雄 ID，Jade_ 皮肤条目让位）
const currentAliases = new Map<string, string>();
for (const row of parseSimpleCsv(readFileSync(join(dataDir, 'generated', 'aliases.csv'), 'utf8')).rows) {
  const zh = row['国服译名'];
  const id = row['championId'];
  if (!zh || !id) continue;
  const existingId = currentAliases.get(zh);
  if (!existingId || (existingId.startsWith('Jade_') && !id.startsWith('Jade_'))) currentAliases.set(zh, id);
}
const existingRows = parseTsv(readFileSync(join(dataDir, 'champions.tsv'), 'utf8')).rows;
const curatedByChampionId = new Map<string, (typeof existingRows)[number][]>();
for (const row of existingRows) {
  const championId = currentAliases.get(row.champion);
  if (!championId || championId.startsWith('Jade_')) continue;
  const list = curatedByChampionId.get(championId);
  if (!list) curatedByChampionId.set(championId, [row]);
  else if (!list.some((r) => r.buildName === row.buildName)) list.push(row); // 同名套路去重
}

let champions: ChampionEntry[] | null = null;

// 首选：LCU 目录（description = 玩家名，alias = 英文 ID，id = 数字 ID）
try {
  const client = await discoverLcu();
  if (client) {
    const summary = await client.request<{ id: number; name: string; description: string; alias: string }[]>(
      'GET',
      '/lol-game-data/assets/v1/champion-summary.json',
    );
    client.close();
    champions = summary
      // 过滤特殊条目：Jade_* 皮肤（id 60001+）与 FiddleSticks 遗留别名
      .filter((entry) => entry.id > 0 && entry.id < 60000 && entry.alias !== 'FiddleSticks')
      .map((entry) => ({
        championId: entry.alias,
        nameZh: entry.description || entry.name,
        numericId: String(entry.id),
      }))
      .sort((a, b) => Number(a.numericId) - Number(b.numericId));
    console.log('使用 LCU 目录（玩家名称）：' + champions.length + ' 个英雄');
  }
} catch {
  champions = null;
}

// 回退：Data Dragon（名称字段为称号）
if (!champions) {
  const versions = (await fetchJson('https://ddragon.leagueoflegends.com/api/versions.json')) as string[];
  const version = versions[0];
  const championData = (await fetchJson(
    'https://ddragon.leagueoflegends.com/cdn/' + version + '/data/zh_CN/champion.json',
  )) as { data: Record<string, { id: string; key: string; name: string }> };
  champions = Object.values(championData.data)
    .map((entry) => ({ championId: entry.id, nameZh: entry.name, numericId: String(entry.key) }))
    .sort((a, b) => Number(a.numericId) - Number(b.numericId));
  console.log('回退 Data Dragon（称号名，' + version + '）：' + champions.length + ' 个英雄');
}

const aliasLines = ['# 国服译名 → 官方 championId 映射（LCU 目录生成）', '国服译名,championId'];
const idLines = ['# championId → LCU 数字 ID 映射（LCU 目录生成）', 'championId,数字ID'];
const tsvLines = [
  '# ChooseHextech 占位样例数据（全英雄，由 scripts/gen-all-champions.ts 生成）',
  '# 格式：英雄  套路名  海克斯推荐  装备推荐  对局技巧  作者  适用版本',
  '# 「示例-」「占位」字样 = 占位数据，仅用于跑通流程，请勿作为真实攻略使用',
  '英雄	套路名	海克斯推荐	装备推荐	对局技巧	作者	适用版本',
];

let curated = 0;
let generic = 0;
for (const champion of champions) {
  aliasLines.push(champion.nameZh + ',' + champion.championId);
  idLines.push(champion.championId + ',' + champion.numericId);
  const curatedRows = curatedByChampionId.get(champion.championId);
  if (curatedRows && curatedRows.length > 0) {
    for (const curatedRow of curatedRows) {
      tsvLines.push(
        [
          champion.nameZh,
          curatedRow.buildName,
          curatedRow.hextech.join('、'),
          curatedRow.items.join('、'),
          curatedRow.tips.join('；'),
          curatedRow.author ?? '占位样例',
          curatedRow.patch,
        ].join('\t'),
      );
      curated += 1;
    }
  } else {
    tsvLines.push(
      [champion.nameZh, '示例-通用流', '示例强化A、示例强化B', '示例装备A、示例装备B', '占位技巧一；占位技巧二', '占位样例', release.gamePatch].join('\t'),
    );
    generic += 1;
  }
}

writeFileSync(join(dataDir, 'generated', 'aliases.csv'), aliasLines.join('\n') + '\n', 'utf8');
writeFileSync(join(dataDir, 'generated', 'champion-ids.csv'), idLines.join('\n') + '\n', 'utf8');
writeFileSync(join(dataDir, 'champions.tsv'), tsvLines.join('\n') + '\n', 'utf8');
console.log('已生成：aliases/champion-ids 全量（' + champions.length + '），套路行 ' + (tsvLines.length - 4) + '（保留样例 ' + curated + '，通用占位 ' + generic + '）');
