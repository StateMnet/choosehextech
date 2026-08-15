import { readFile, readdir } from 'node:fs/promises';

const files = (await readdir(new URL('../../data/userjson/', import.meta.url))).filter((f) => f.endsWith('.json'));
let emptyTips = 0, emptyHex = 0, emptyItems = 0;
for (const f of files) {
  const entries = JSON.parse(await readFile(new URL(`../../data/userjson/${f}`, import.meta.url), 'utf8'));
  for (const e of entries) {
    const t = Array.isArray(e.tips) ? e.tips : [];
    const h = Array.isArray(e.hextech) ? e.hextech : [];
    const it = Array.isArray(e.items) ? e.items : [];
    if (t.length === 0 || t.every((x: string) => !x.trim())) {
      emptyTips++;
      if (emptyTips <= 8) console.log(`[空tips] ${e.champion}|${e.buildName} tips=${JSON.stringify(e.tips)}`);
    }
    if (h.length === 0) { emptyHex++; if (emptyHex <= 8) console.log(`[空hex] ${e.champion}|${e.buildName}`); }
    if (it.length === 0) { emptyItems++; if (emptyItems <= 8) console.log(`[空items] ${e.champion}|${e.buildName}`); }
  }
}
console.log(`空tips=${emptyTips} 空hex=${emptyHex} 空items=${emptyItems}`);
