import { z } from 'zod';

export const RADAR_ENTRIES_KEY = 'radar:entries';
export const RADAR_ENTRY_LIMIT = 50;

export const DEFAULT_RADAR_ENTRIES = [
  { id: 'radar-codex', label: 'Codex 雷达', url: 'https://codexradar.com/' },
  { id: 'radar-distributed', label: '分布式雷达 Codex 站', url: 'https://deng.codexradar.com/' },
] as const;

export function normalizeRadarUrl(value: string): string {
  return new URL(value.trim()).toString();
}

export function isSafeRadarUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

export const radarEntryInputSchema = z
  .object({
    label: z.string().trim().min(1, '请输入名称').max(80, '名称不能超过 80 个字符'),
    url: z
      .string()
      .trim()
      .min(1, '请输入网址')
      .max(500, '网址不能超过 500 个字符')
      .refine(isSafeRadarUrl, '网址必须是完整的 HTTPS 地址'),
  })
  .strict();

export const radarEntrySchema = radarEntryInputSchema.extend({
  id: z.string().min(1).max(128),
});

export const radarEntriesSchema = z
  .array(radarEntrySchema)
  .max(RADAR_ENTRY_LIMIT)
  .superRefine((entries, context) => {
    const labels = new Set<string>();
    const urls = new Set<string>();
    entries.forEach((entry, index) => {
      const label = entry.label.trim();
      const url = normalizeRadarUrl(entry.url.trim());
      if (labels.has(label))
        context.addIssue({
          code: 'custom',
          path: [index, 'label'],
          message: '雷达站点名称不能重复',
        });
      if (urls.has(url))
        context.addIssue({
          code: 'custom',
          path: [index, 'url'],
          message: '雷达站点网址不能重复',
        });
      labels.add(label);
      urls.add(url);
    });
  });

export const radarEntryIdSchema = z.string().min(1).max(128);

export type RadarEntry = z.infer<typeof radarEntrySchema>;
export type RadarEntryInput = z.infer<typeof radarEntryInputSchema>;

export type RadarTarget = { id: string; label: string };

export type RadarEmbedState =
  | { status: 'idle' }
  | { status: 'opening'; target: RadarTarget }
  | { status: 'open'; target: RadarTarget }
  | { status: 'error'; target: RadarTarget; message: string };

export function isAllowedRadarNavigation(value: unknown, allowedOrigin: string): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.origin === allowedOrigin
    );
  } catch {
    return false;
  }
}

export type RadarContentSize = { width: number; height: number };

export const RADAR_VIEW_LEFT = 284;
export const RADAR_VIEW_TOP = 80;

export function radarViewBounds(size: RadarContentSize) {
  return {
    x: RADAR_VIEW_LEFT,
    y: RADAR_VIEW_TOP,
    width: Math.max(0, Math.round(size.width) - RADAR_VIEW_LEFT),
    height: Math.max(0, Math.round(size.height) - RADAR_VIEW_TOP),
  };
}
