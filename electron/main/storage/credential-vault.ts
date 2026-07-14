export interface CredentialValue {
  account: string;
  password: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface CredentialCodec {
  isAvailable(): boolean;
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
}

export interface SecretBackend {
  read(key: string): string | undefined;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export class CredentialVault {
  constructor(
    private readonly codec: CredentialCodec,
    private readonly backend: SecretBackend,
  ) {}

  write(siteId: string, value: CredentialValue): void {
    if (!this.codec.isAvailable()) throw new Error('SECURE_STORAGE_UNAVAILABLE');
    const encrypted = this.codec.encrypt(JSON.stringify(value)).toString('base64');
    this.backend.write(`sub2api:${siteId}`, encrypted);
  }

  read(siteId: string): CredentialValue | undefined {
    const encoded = this.backend.read(`sub2api:${siteId}`);
    if (!encoded) return undefined;
    return JSON.parse(this.codec.decrypt(Buffer.from(encoded, 'base64'))) as CredentialValue;
  }

  remove(siteId: string): void {
    this.backend.remove(`sub2api:${siteId}`);
  }
}
