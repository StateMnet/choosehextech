import { z } from 'zod';
import type { DataBundle } from './types.ts';

export const buildSchema = z.object({
  name: z.string().min(1),
  hextech: z.array(z.string().min(1)).min(1),
  items: z.array(z.string().min(1)).min(1),
  tips: z.array(z.string().min(1)).min(1),
  author: z.string().optional(),
  updatedPatch: z.string().regex(/^\d{2}\.\d{1,2}$/),
});

export const championEntrySchema = z.object({
  championId: z.string().min(1),
  nameZh: z.string().min(1),
  numericId: z.number().int().positive().optional(),
  builds: z.array(buildSchema).min(1),
});

export const dataBundleSchema = z.object({
  schemaVersion: z.literal(1),
  dataVersion: z.string().min(1),
  gamePatch: z.string().regex(/^\d{2}\.\d{1,2}$/),
  mode: z.literal('hextech-aram'),
  augmentIcons: z.record(z.string(), z.string()).optional(),
  championIcons: z.record(z.string(), z.string()).optional(),
  itemIcons: z.record(z.string(), z.string()).optional(),
  champions: z.array(championEntrySchema).min(1),
});

/** 解析并校验数据包，不合法时抛 ZodError */
export function parseBundle(input: unknown): DataBundle {
  return dataBundleSchema.parse(input) as DataBundle;
}
