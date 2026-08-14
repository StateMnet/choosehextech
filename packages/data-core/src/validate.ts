import { MAX_TIP_LENGTH, PATCH_PATTERN } from './constants.ts';
import type { RawBuildRow } from './types.ts';

export interface ValidationIssue {
  line: number;
  field: string;
  message: string;
}

export interface ValidationOptions {
  aliases: Map<string, string>;
  /** 可选：官方装备表；提供时未知装备将告警或报错（取决于 strictNames） */
  itemNames?: Set<string>;
  /** 可选：海克斯强化表 */
  augmentNames?: Set<string>;
  /** true=未知名称算错误（CI）；false=仅警告 */
  strictNames?: boolean;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  warnings: string[];
}

/** 按 DESIGN.md 4.5 的规则校验全部数据行 */
export function validateRows(rows: RawBuildRow[], opts: ValidationOptions): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const strict = opts.strictNames ?? false;

  for (const row of rows) {
    const at = (field: string, message: string) =>
      issues.push({ line: row.line ?? 0, field, message });

    if (!row.champion) at('英雄', '不能为空');
    else if (!opts.aliases.has(row.champion)) at('英雄', '「' + row.champion + '」不在英雄别名表中');

    if (!row.buildName) at('套路名', '不能为空');
    if (row.hextech.length === 0) at('海克斯推荐', '至少需要一条海克斯强化');
    if (row.items.length === 0) at('装备推荐', '至少需要一件装备');
    if (row.tips.length === 0) at('对局技巧', '至少需要一条技巧');
    for (const tip of row.tips) {
      if (tip.length > MAX_TIP_LENGTH) {
        at('对局技巧', '技巧超过 ' + MAX_TIP_LENGTH + ' 字：「' + tip.slice(0, 20) + '…」');
      }
    }
    if (!PATCH_PATTERN.test(row.patch)) {
      at('适用版本', '版本格式应为「xx.yy」，实际为「' + row.patch + '」');
    }

    if (row.champion && row.buildName) {
      const key = row.champion + '|' + row.buildName;
      if (seen.has(key)) at('套路名', '英雄「' + row.champion + '」下套路名「' + row.buildName + '」重复');
      seen.add(key);
    }

    if (opts.itemNames) {
      for (const item of row.items) {
        if (!opts.itemNames.has(item)) {
          const msg = '装备「' + item + '」不在装备表中';
          if (strict) at('装备推荐', msg);
          else warnings.push('第 ' + (row.line ?? '?') + ' 行：' + msg);
        }
      }
    }
    if (opts.augmentNames) {
      for (const augment of row.hextech) {
        if (!opts.augmentNames.has(augment)) {
          const msg = '海克斯强化「' + augment + '」不在强化表中';
          if (strict) at('海克斯推荐', msg);
          else warnings.push('第 ' + (row.line ?? '?') + ' 行：' + msg);
        }
      }
    }
  }

  return { ok: issues.length === 0, issues, warnings };
}
