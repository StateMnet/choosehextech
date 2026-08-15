import { readFile } from 'node:fs/promises';

const itemsTsv = await readFile(new URL('../../data/meta/items.tsv', import.meta.url), 'utf8');
const user = JSON.parse(await readFile(new URL('../../data/userjson/para4.json', import.meta.url), 'utf8'));

const tsvNames = itemsTsv.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
console.log('items.tsv 含阔剑:', tsvNames.filter((n) => n.includes('阔')));

for (const e of user) {
  if (e.champion === '薇恩') {
    console.log('薇恩套路:', e.buildName, 'items:', JSON.stringify(e.items));
  }
}
const target = user.flatMap((e) => e.items).find((i) => i.includes('阔'));
if (target) {
  console.log('userjson 目标:', JSON.stringify(target));
  console.log('码点:', [...target].map((c) => c.codePointAt(0)!.toString(16)).join(' '));
  const tsv = tsvNames.find((n) => n.includes('阔'));
  if (tsv) console.log('tsv 目标:', JSON.stringify(tsv), '码点:', [...tsv].map((c) => c.codePointAt(0)!.toString(16)).join(' '));
}
