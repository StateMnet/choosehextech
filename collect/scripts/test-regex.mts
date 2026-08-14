const s =
  '<span class="rounded border px-2 py-0.5 text-xs rarity-prismatic">棱彩</span>';
const r = /rarity-(\w+)">([^<]+)</;
const m = s.match(r);
console.log(JSON.stringify(m && m.slice(1)));
