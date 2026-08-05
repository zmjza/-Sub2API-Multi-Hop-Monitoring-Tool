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
    expect(safeRendererError(new Error('INTERACTIVE_AUTH_CHALLENGE_NETWORK'), '站点添加失败')).toBe(
      '人机验证服务暂时无法连接，请检查网络或系统代理后重试',
    );
    expect(safeRendererError(new Error('SITE_DUPLICATE_ACCOUNT'), '站点添加失败')).toBe(
      '该站点已添加此用户名',
    );
    expect(safeRendererError(new Error('SITE_ACCOUNT_IDENTITY_UNAVAILABLE'), '站点添加失败')).toBe(
      '无法确认已有站点的用户名，请先检查凭据',
    );
    expect(safeRendererError(new Error('SITE_ACCOUNT_IDENTITY_MISMATCH'), '站点添加失败')).toBe(
      '登录账号与添加站点用户名不一致',
    );
    expect(safeRendererError(new Error('CHROME_NOT_INSTALLED'), '站点添加失败')).toBe(
      '未找到 Google Chrome，请先安装后重试',
    );
    expect(safeRendererError(new Error('CHROME_AUTH_TOKEN_NOT_FOUND'), '站点添加失败')).toBe(
      '登录已完成，但站点未提供受支持的登录令牌，暂不支持仅 Cookie 会话',
    );
  });
});
