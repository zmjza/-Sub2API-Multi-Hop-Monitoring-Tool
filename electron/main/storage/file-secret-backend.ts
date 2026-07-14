import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

export class FileSecretBackend {
  private readonly values: Record<string, string>;
  constructor(private readonly filePath: string) {
    this.values = existsSync(filePath) ? parseSafe(readFileSync(filePath, 'utf8')) : {};
  }
  read(key: string): string | undefined {
    return this.values[key];
  }
  write(key: string, value: string): void {
    this.values[key] = value;
    this.flush();
  }
  remove(key: string): void {
    delete this.values[key];
    this.flush();
  }
  private flush(): void {
    writeFileSync(this.filePath, JSON.stringify(this.values), { mode: 0o600 });
  }
  destroy(): void {
    if (existsSync(this.filePath)) unlinkSync(this.filePath);
  }
}

function parseSafe(value: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}
