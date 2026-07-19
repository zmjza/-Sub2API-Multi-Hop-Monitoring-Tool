/* global process, fetch, console */
import { Sub2ApiClient } from '../dist-electron/main/adapters/http-client.js';
import { Sub2ApiAdapter } from '../dist-electron/main/adapters/sub2api-adapter.js';
import { normalizeSiteUrl } from '../dist-electron/main/adapters/url.js';

const sites = [
  {
    name: 'walkai',
    url: 'https://walkai.top',
    email: process.env.WALKAI_EMAIL,
    password: process.env.WALKAI_PASSWORD,
  },
  {
    name: 'maok',
    url: 'https://ai.maok.shop',
    email: process.env.MAOK_EMAIL,
    password: process.env.MAOK_PASSWORD,
  },
  {
    name: 'hanhegufei',
    url: 'https://panel.hanhegufei.online',
    email: process.env.HANHE_EMAIL,
    password: process.env.HANHE_PASSWORD,
  },
];

for (const site of sites) {
  if (!site.email || !site.password) throw new Error(`${site.name}: missing runtime credentials`);
  const normalized = normalizeSiteUrl(site.url);
  const client = new Sub2ApiClient(normalized.apiBaseUrl, fetch, 20_000);
  const result = {
    name: site.name,
    baseUrl: normalized.baseUrl,
    login: 'failed',
    core: 'not-run',
    usageList: 'not-run',
    usageFilters: 'not-run',
    availableRates: 'not-run',
    channels: 'not-run',
    channelDetail: 'not-run',
    channelDetailFields: [],
  };
  try {
    const session = await client.login(site.email, site.password);
    result.login = 'success';
    const adapter = new Sub2ApiAdapter(client);
    const core = await adapter.readCore(session.accessToken, 'Asia/Shanghai');
    result.core = JSON.stringify({
      profile: 'supported',
      keyCount: core.keys.length,
      usageStats: 'supported',
      rateAvailable: core.keys.some(
        (key) => key.groupId && core.rates.get(key.groupId) !== undefined,
      ),
    });
    try {
      const filters = await adapter.readUsageFilters(session.accessToken, 'Asia/Shanghai');
      result.usageFilters = JSON.stringify({
        supported: true,
        modelCount: filters.models.length,
        groupCount: filters.groups.length,
      });
    } catch (error) {
      result.usageFilters = `error:${error?.code ?? 'unknown'}`;
    }
    try {
      const groups = await adapter.readAvailableRateGroups(session.accessToken, 'Asia/Shanghai');
      result.availableRates = JSON.stringify({
        supported: true,
        groupCount: groups.length,
        platforms: [...new Set(groups.map((group) => group.platform))].sort(),
      });
    } catch (error) {
      result.availableRates = `error:${error?.code ?? 'unknown'}`;
    }
    try {
      await adapter.readUsage(session.accessToken, {
        period: 'today',
        page: 1,
        page_size: 1,
        timezone: 'Asia/Shanghai',
      });
      result.usageList = 'supported';
    } catch (error) {
      result.usageList = `error:${error?.code ?? 'unknown'}`;
    }
    try {
      const channels = await adapter.readOptionalChannels(session.accessToken);
      result.channels = channels.state;
      const first = channels.channels[0];
      const channelId =
        first && typeof first === 'object' ? String(first.id ?? first.monitor_id ?? '') : '';
      if (channels.state === 'supported' && channelId) {
        const detail = await adapter.readChannelStatus(session.accessToken, channelId);
        result.channelDetail = detail.state;
        if (detail.detail && typeof detail.detail === 'object')
          result.channelDetailFields = Object.keys(detail.detail).sort();
      } else result.channelDetail = channels.state;
    } catch (error) {
      result.channels = `error:${error?.code ?? 'unknown'}`;
    }
  } catch (error) {
    result.core = `error:${error?.code ?? 'unknown'}`;
  }
  console.log(JSON.stringify(result));
}
