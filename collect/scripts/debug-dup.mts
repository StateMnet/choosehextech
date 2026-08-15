import { readFile, readdir } from 'node:fs/promises';

const files = (await readdir(new URL('../../data/userjson/', import.meta.url))).filter((f) => f.endsWith('.json'));
const entries: any[] = [];
for (const f of files) {
  entries.push(...JSON.parse(await readFile(new URL(`../../data/userjson/${f}`, import.meta.url), 'utf8')));
}
const seen = new Map<string, number>();
for (const e of entries) {
  const k = `${e.champion}|${e.buildName}`;
  seen.set(k, (seen.get(k) ?? 0) + 1);
}
let dup = 0;
for (const [k, v] of seen) {
  if (v > 1) {
    dup++;
    console.log(`${k} x${v}`);
  }
}
console.log(`重复组: ${dup}`);
