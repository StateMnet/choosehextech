export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

/** 极简 CSV 解析：支持 # 注释行、空行；不做引号转义（meta 表不包含逗号与引号） */
export function parseSimpleCsv(text: string): CsvTable {
  const lines = text.split(/\r?\n/);
  const headers: string[] = [];
  const rows: Record<string, string>[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const cells = line.split(',').map((cell) => cell.trim());
    if (headers.length === 0) {
      headers.push(...cells.map((cell, idx) => (idx === 0 ? cell.replace(/^\uFEFF/, '') : cell)));
    } else {
      const row: Record<string, string> = {};
      cells.forEach((cell, idx) => {
        row[headers[idx]] = cell;
      });
      rows.push(row);
    }
  }
  return { headers, rows };
}

/** 加载「国服译名 → championId」映射表 */
export function loadAliasMap(text: string): Map<string, string> {
  const { headers, rows } = parseSimpleCsv(text);
  if (!headers.includes('国服译名') || !headers.includes('championId')) {
    throw new Error('aliases 表必须包含「国服译名」和「championId」两列');
  }
  const map = new Map<string, string>();
  for (const row of rows) {
    const zh = row['国服译名'];
    const id = row['championId'];
    if (!zh || !id) throw new Error('aliases 表存在空单元格');
    const existing = map.get(zh);
    if (existing !== undefined && existing !== id) {
      throw new Error('aliases 表「' + zh + '」重复且映射不一致');
    }
    map.set(zh, id);
  }
  return map;
}

/** 加载两列键值映射表（如 championId → 数字 ID，或英雄名 → 头像 URL） */
export function loadPairMap(
  text: string,
  keyColumn: string,
  valueColumn: string,
  options: { numericValues?: boolean } = {},
): Map<string, string> {
  const { headers, rows } = parseSimpleCsv(text);
  if (!headers.includes(keyColumn) || !headers.includes(valueColumn)) {
    throw new Error('映射表必须包含「' + keyColumn + '」和「' + valueColumn + '」两列');
  }
  const map = new Map<string, string>();
  for (const row of rows) {
    const key = row[keyColumn];
    const value = row[valueColumn];
    if (!key || !value) throw new Error('映射表存在空单元格');
    if (options.numericValues === true && !/^\d+$/.test(value)) {
      throw new Error('映射值应为数字：「' + value + '」');
    }
    map.set(key, value);
  }
  return map;
}

/** 加载单列名称表（如装备表、海克斯强化表） */
export function loadNameSet(text: string): Set<string> {
  const { headers, rows } = parseSimpleCsv(text);
  if (headers.length !== 1) throw new Error('名称表应恰好只有一列');
  const column = headers[0];
  return new Set(rows.map((row) => row[column]).filter((value) => value !== undefined && value.length > 0));
}
