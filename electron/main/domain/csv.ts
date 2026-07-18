export interface CsvUsageRecord {
  time: string;
  keyLabel: string;
  model: string;
  tokens?: number;
  firstTokenMs?: number;
  durationMs?: number;
  actualCost?: number;
}

function safeCell(value: string | number | undefined): string {
  if (value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `\t${text}`;
  if (/[",\n]/.test(text)) text = `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function buildCsv(records: CsvUsageRecord[]): string {
  const rows = records.map((record) =>
    [
      record.time,
      record.keyLabel,
      record.model,
      record.tokens,
      record.firstTokenMs,
      record.durationMs,
      record.actualCost,
    ]
      .map(safeCell)
      .join(','),
  );
  return ['时间,API Key,模型,Token,首字,耗时,实际消费', ...rows].join('\n');
}
