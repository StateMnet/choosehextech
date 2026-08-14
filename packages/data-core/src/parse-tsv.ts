import { LIST_SEPARATOR, REQUIRED_COLUMNS, TIP_SEPARATOR, TSV_COLUMNS } from './constants.ts';
import type { RawBuildRow } from './types.ts';

export class ParseError extends Error {
  line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.name = 'ParseError';
    this.line = line;
  }
}

export interface ParseResult {
  rows: RawBuildRow[];
  warnings: string[];
}

function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function splitList(text: string, separator: string): string[] {
  return text
    .split(separator)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * 解析 TSV 源数据。
 * 支持 # 开头的注释行与空行；第一行非注释行为表头。
 * 缺列或空文件抛 ParseError。
 */
export function parseTsv(text: string): ParseResult {
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/);
  let header: string[] | null = null;
  const rows: RawBuildRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].trim();
    if (line === '' || line.startsWith('#')) continue;
    const cells = line.split('\t').map((cell) => cell.trim());

    if (header === null) {
      header = cells.map((cell, idx) => (idx === 0 ? stripBom(cell) : cell));
      for (const column of REQUIRED_COLUMNS) {
        if (!header.includes(column)) {
          throw new ParseError('缺少必需列「' + column + '」，实际列：' + header.join('、'), lineNo);
        }
      }
      for (const cell of header) {
        if (!(TSV_COLUMNS as readonly string[]).includes(cell)) {
          warnings.push('第 ' + lineNo + ' 行：未知列「' + cell + '」将被忽略');
        }
      }
      continue;
    }

    // 捕获为局部常量，解决闭包内 let 类型收窄失效的问题
    const cols = header;
    const get = (column: string): string => {
      const idx = cols.indexOf(column);
      return idx >= 0 && idx < cells.length ? cells[idx] : '';
    };

    const author = get('作者');
    rows.push({
      champion: get('英雄'),
      buildName: get('套路名'),
      hextech: splitList(get('海克斯推荐'), LIST_SEPARATOR),
      items: splitList(get('装备推荐'), LIST_SEPARATOR),
      tips: splitList(get('对局技巧'), TIP_SEPARATOR),
      author: author === '' ? undefined : author,
      patch: get('适用版本'),
      line: lineNo,
    });
  }

  if (header === null) throw new ParseError('文件为空或缺少表头');
  return { rows, warnings };
}
