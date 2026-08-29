export function formatChannelFetchedAt(fetchedAt: number | undefined): string {
  if (fetchedAt === undefined || !Number.isFinite(fetchedAt) || fetchedAt < 0) return '尚未更新';
  return new Date(fetchedAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
