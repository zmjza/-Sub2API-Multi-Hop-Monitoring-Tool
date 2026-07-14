/* global process, console, Buffer */
import { DatabaseSync } from 'node:sqlite';
import { AppDatabase } from '../dist-electron/main/storage/database.js';
import { CredentialVault } from '../dist-electron/main/storage/credential-vault.js';
import { SiteService } from '../dist-electron/main/services/site-service.js';

const credentials = {
  maok: {
    name: '猫K真实集成',
    url: 'https://ai.maok.shop',
    account: process.env.MAOK_EMAIL,
    password: process.env.MAOK_PASSWORD,
  },
  hanhegufei: {
    name: '汉河谷飞真实集成',
    url: 'https://panel.hanhegufei.online',
    account: process.env.HANHE_EMAIL,
    password: process.env.HANHE_PASSWORD,
  },
};
const values = new Map();
const vault = new CredentialVault(
  {
    isAvailable: () => true,
    encrypt: (value) => Buffer.from(`sealed:${value}`),
    decrypt: (value) => value.toString().replace(/^sealed:/, ''),
  },
  {
    read: (key) => values.get(key),
    write: (key, value) => values.set(key, value),
    remove: (key) => values.delete(key),
  },
);
const db = new AppDatabase(new DatabaseSync(':memory:'));
db.migrate();
const service = new SiteService(db, vault);

for (const [name, input] of Object.entries(credentials)) {
  if (!input.account || !input.password) throw new Error(`${name}: missing runtime credentials`);
  try {
    const summary = await service.addAndVerify(input);
    console.log(
      JSON.stringify({
        name,
        status: summary.status,
        source: summary.source,
        hasBalance: summary.balance !== undefined,
        hasUsageStats: summary.todayTokens !== undefined && summary.todayActualCost !== undefined,
        hasRate: summary.rate !== undefined,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        name,
        status: 'error',
        code: error?.code ?? 'unknown',
        message: error?.message ?? 'request failed',
      }),
    );
  }
}
console.log(JSON.stringify({ sites: service.listSites().sites.length, aggregate: 'computed' }));
