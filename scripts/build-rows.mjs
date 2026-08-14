import { readFileSync, writeFileSync } from 'node:fs';

const dir = 'D:/Material/DevProjects/agent/lolscript';
const ver = readFileSync(dir + '/ddragon_version.txt', 'utf8').trim();

let heroRaw = readFileSync(dir + '/hero_list.js', 'utf8').trim();
let tj;
try {
  tj = JSON.parse(heroRaw);
} catch {
  tj = JSON.parse(heroRaw.match(/\{[\s\S]*\}/)[0]);
}

const dj = JSON.parse(readFileSync(dir + '/champion_zhcn.json', 'utf8'));
const ddData = dj.data;

const ddByKey = new Map();
for (const ch of Object.values(ddData)) ddByKey.set(String(ch.key), ch);

const rows = [];
const seen = new Set();
const nameDiffs = [];
for (const h of tj.hero) {
  const key = String(h.heroId);
  seen.add(key);
  const dd = ddByKey.get(key);
  const ddId = dd ? dd.id : h.alias;
  const ddName = dd ? dd.name : '';
  const name = h.title || ddName || h.alias;
  if (ddName && name !== ddName) nameDiffs.push(`${name} vs ddragon:${ddName}`);
  rows.push({
    num: Number(key),
    name,
    gt: `https://game.gtimg.cn/images/lol/act/img/champion/${h.alias}.png`,
    oss: `https://ossweb-img.qq.com/images/lol/img/champion/${h.alias}.png`,
    dd: `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${ddId}.png`,
  });
}
for (const ch of Object.values(ddData)) {
  const key = String(ch.key);
  if (seen.has(key)) continue;
  rows.push({
    num: Number(key),
    name: ch.name,
    gt: `https://game.gtimg.cn/images/lol/act/img/champion/${ch.id}.png`,
    oss: `https://ossweb-img.qq.com/images/lol/img/champion/${ch.id}.png`,
    dd: `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${ch.id}.png`,
  });
}
rows.sort((a, b) => a.num - b.num);

const lines = ['NumericId,Name,Gt,Oss,Dd'];
for (const r of rows) lines.push([r.num, r.name, r.gt, r.oss, r.dd].join(','));
writeFileSync(dir + '/rows.csv', lines.join('\n') + '\n', 'utf8');

console.log('Tencent heroes:', tj.hero.length, '| ddragon champions:', Object.keys(ddData).length);
console.log('rows:', rows.length);
if (nameDiffs.length) console.log('NAME-DIFFS:', nameDiffs.join(' | '));
console.log('rows.csv written');
