import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const dir = 'D:/Material/DevProjects/agent/lolscript';
const ver = existsSync(dir + '/ddragon_version.txt')
  ? readFileSync(dir + '/ddragon_version.txt', 'utf8').trim()
  : '16.16.1';

function adaptiveParse(raw) {
  try { return JSON.parse(raw); } catch { /* fall through */ }
  const m = raw.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
}

function extractList(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.data)) return parsed.data;
  if (parsed && Array.isArray(parsed.items)) return parsed.items;
  if (parsed && Array.isArray(parsed.item)) return parsed.item;
  return null;
}

let tencentItems = null;
const itemsJsPath = dir + '/items.js';
if (existsSync(itemsJsPath)) {
  const raw = readFileSync(itemsJsPath, 'utf8').trim();
  if (raw.length > 2) {
    const parsed = adaptiveParse(raw);
    tencentItems = extractList(parsed);
  }
}

let dd = {};
const ddPath = dir + '/item_zhcn.json';
if (existsSync(ddPath)) {
  const dj = JSON.parse(readFileSync(ddPath, 'utf8'));
  if (dj && dj.data) dd = dj.data;
}

const rows = new Map(); // itemId -> { id, name, ddFull }

if (tencentItems) {
  for (const it of tencentItems) {
    const id = String(it.itemId ?? it.id ?? '').trim();
    if (!id || !/^\d+$/.test(id)) continue;
    const name = String(it.name ?? '').trim();
    rows.set(id, { id, name, ddFull: null });
  }
} else {
  // ddragon-only fallback: exclude known non-shop legacy ids
  const skip = new Set([
    '0', '3599', '3600', '3671', '3672', '3673', '3674', '3675',
    '1101', '1102', '1103', '1104',
    '7050', '7051', '7052', '7053', '7054', '7055', '7056', '7057',
    '7058', '7059', '7060', '7061', '7062', '7063', '7064',
  ]);
  for (const [id, v] of Object.entries(dd)) {
    if (skip.has(id)) continue;
    rows.set(id, { id, name: v && v.name ? String(v.name).trim() : '', ddFull: null });
  }
}

for (const [id, row] of rows) {
  const v = dd[id];
  if (v) {
    if (!row.name && v.name) row.name = String(v.name).trim();
    row.ddFull = v.image && v.image.full ? String(v.image.full) : id + '.png';
  }
}

const nameDiffs = [];
for (const [id, row] of rows) {
  const v = dd[id];
  if (v && row.name && v.name && row.name !== v.name) {
    nameDiffs.push(`${id}:${row.name} vs ${v.name}`);
  }
}

const lines = ['ItemId,Name,Gt,Oss,Dd'];
for (const [id, row] of rows) {
  const name = (row.name || '未知装备' + id).replace(/[\r\n,]+/g, ' ');
  const ddFull = row.ddFull || id + '.png';
  lines.push([
    id,
    name,
    `https://game.gtimg.cn/images/lol/act/img/item/${id}.png`,
    `https://ossweb-img.qq.com/images/lol/img/item/${id}.png`,
    `https://ddragon.leagueoflegends.com/cdn/${ver}/img/item/${ddFull}`,
  ].join(','));
}
writeFileSync(dir + '/items_rows.csv', lines.join('\n') + '\n', 'utf8');

console.log('tencent items:', tencentItems ? tencentItems.length : 'N/A (fallback to ddragon)');
console.log('ddragon items:', Object.keys(dd).length);
console.log('rows:', rows.size);
if (nameDiffs.length) console.log('NAME-DIFFS:', nameDiffs.slice(0, 40).join(' | '));
console.log('items_rows.csv written');
