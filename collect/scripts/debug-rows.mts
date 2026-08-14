import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../output/raw/aramgg-home.html', import.meta.url), 'utf8');

const rowRe = /<tr[^>]*data-ranking-row[^>]*>[\s\S]*?<\/tr>/g;
const blocks = [...html.matchAll(rowRe)].map((m) => m[0]);
console.log('blocks:', blocks.length);

for (let i = 0; i < 8; i++) {
  const b = blocks[i];
  const rankM = b.match(/font-bold rank-\w+">(\d+)</);
  const tierM = b.match(/T([1-5])</);
  const champM = b.match(/href="\/zh-CN\/champion-stats\/(\d+)"[^>]*>[\s\S]*?alt="([^"]+)"/);
  console.log(
    `#${i} rank=${rankM?.[1] ?? 'MISS'} tier=${tierM?.[1] ?? 'MISS'} champ=${champM?.[2] ?? 'MISS'} len=${b.length}`,
  );
}
// 打印第4块开头 200 字符
console.log('--- block 3 (rank 4) head ---');
console.log(blocks[3].slice(0, 500));
