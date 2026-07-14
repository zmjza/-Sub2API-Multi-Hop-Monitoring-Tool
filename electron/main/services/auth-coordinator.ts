export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class AuthCoordinator {
  private readonly inflight = new Map<string, Promise<SessionTokens>>();

  constructor(
    private readonly refreshAction: (
      siteId: string,
      refreshToken: string,
    ) => Promise<SessionTokens>,
  ) {}

  refresh(siteId: string, refreshToken: string): Promise<SessionTokens> {
    const existing = this.inflight.get(siteId);
    if (existing) return existing;
    const request = this.refreshAction(siteId, refreshToken).finally(() => {
      if (this.inflight.get(siteId) === request) this.inflight.delete(siteId);
    });
    this.inflight.set(siteId, request);
    return request;
  }
}
