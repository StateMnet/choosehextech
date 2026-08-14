/**
 * 生成「强化名 → 图标直链」映射并验证每个 URL 可访问。
 * 数据源：collect/output/augments-aramgg.json（ARAMGG 205 个强化，含图标文件名）
 * 图标 URL：ARAMGG 页面直接使用的社区 CDN（https://cdn.dtodo.cn/hextech/augment-icons/*.png，
 *          无签名、无防盗链，浏览器可直接加载）
 * 用法：node --experimental-strip-types collect/scripts/gen-icon-csv.mts
 * 输出：data/meta/hextech-icons.csv（有效行）+ 控制台打印完整 CSV 与未找到名单
 */

import { readFile, writeFile } from 'node:fs/promises';

const AUGMENTS_PATH = new URL('../output/augments-aramgg.json', import.meta.url);
const OUT_PATH = new URL('../../data/meta/hextech-icons.csv', import.meta.url);

interface Augment {
  id: string;
  icon: string;
  name: string;
  rarity: string;
}

const augments: Augment[] = JSON.parse(await readFile(AUGMENTS_PATH, 'utf8'));
const BASE = 'https://cdn.dtodo.cn/hextech/augment-icons/';

async function checkUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
      headers: { 'User-Agent': 'choosehextech-collector/0.1' },
    });
    if (res.ok) return true;
  } catch {
    /* fallthrough */
  }
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
      headers: { 'User-Agent': 'choosehextech-collector/0.1' },
    });
    if (res.ok) {
      // 丢弃 body，只验证状态码
      await res.body?.cancel().catch(() => undefined);
      return true;
    }
  } catch {
    /* fallthrough */
  }
  return false;
}

const results: { name: string; url: string; ok: boolean }[] = [];
// 并发 12 逐个验证
const queue = [...augments];
const workers = Array.from({ length: 12 }, async () => {
  while (queue.length) {
    const a = queue.shift()!;
    const url = `${BASE}${a.icon}.png`;
    const ok = await checkUrl(url);
    results.push({ name: a.name, url, ok });
    if (!ok) console.log(`  [MISS] ${a.name} -> ${url}`);
  }
});
await Promise.all(workers);

results.sort((x, y) => x.name.localeCompare(y.name, 'zh-CN'));
const okRows = results.filter((r) => r.ok);
const missRows = results.filter((r) => !r.ok);

// 写入 data/meta/hextech-icons.csv
const lines = [
  '# 海克斯强化名 → 图标 URL（爬取结果直接粘贴；同名强化共用一张图；缺失回退占位图）',
  '# 来源：ARAMGG 社区 CDN（cdn.dtodo.cn），采集时间 ' + new Date().toISOString().slice(0, 10),
  '# 一行一个：强化名,https://...png',
  '海克斯强化,图标URL',
  ...okRows.map((r) => `${r.name},${r.url}`),
];
await writeFile(OUT_PATH, lines.join('\n') + '\n', 'utf8');

console.log(`\nok=${okRows.length} miss=${missRows.length}`);
console.log(`saved ${OUT_PATH.pathname}`);
