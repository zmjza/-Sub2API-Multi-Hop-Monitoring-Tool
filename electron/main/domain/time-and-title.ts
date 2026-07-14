export function dynamicTitle(balance?: number): string {
  if (balance === undefined) return '正在查余额，先让 Codex 蹬一会儿… ⏳';
  return balance >= 2
    ? '这么有钱，就使劲蹬 Codex，别浪费！💸'
    : '快没钱了，赶紧充钱，别让天才程序员陨落！🥲';
}

export function nextLocalMidnight(now = new Date()): Date {
  const result = new Date(now);
  result.setHours(24, 0, 0, 0);
  return result;
}
