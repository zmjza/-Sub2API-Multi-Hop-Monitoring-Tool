import { describe, expect, it } from 'vitest';
import { notificationReducer, safeRendererError, type AppNotification } from './notifications';

const notice = (id: string, kind: AppNotification['kind'] = 'info'): AppNotification => ({
  id,
  kind,
  message: id,
});

describe('application notifications', () => {
  it('updates a stable task in place and keeps at most three visible notices', () => {
    let state: AppNotification[] = [];
    state = notificationReducer(state, { type: 'upsert', notice: notice('a', 'loading') });
    state = notificationReducer(state, { type: 'upsert', notice: notice('b') });
    state = notificationReducer(state, { type: 'upsert', notice: notice('c') });
    state = notificationReducer(state, { type: 'upsert', notice: notice('a', 'success') });
    expect(state).toEqual([notice('a', 'success'), notice('b'), notice('c')]);
    state = notificationReducer(state, { type: 'upsert', notice: notice('d') });
    expect(state.map((item) => item.id)).toEqual(['b', 'c', 'd']);
  });

  it('removes Electron IPC prefixes and maps interactive authentication outcomes', () => {
    expect(
      safeRendererError(
        new Error(
          "Error invoking remote method 'sites:add-and-verify': Error: 站点地址无效、网络不可用或服务异常",
        ),
        '站点添加失败',
      ),
    ).toBe('站点地址无效、网络不可用或服务异常');
    expect(safeRendererError(new Error('INTERACTIVE_AUTH_TIMEOUT'), '站点添加失败')).toBe(
      '安全验证已超时，请重新开始',
    );
    expect(safeRendererError(new Error('INTERACTIVE_AUTH_CANCELLED'), '站点添加失败')).toBe(
      '已取消安全验证，站点未添加',
    );
  });
});
