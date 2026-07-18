export interface ChannelLoadRequest {
  siteId: string;
  requestId: number;
}

export class ChannelLoadCoordinator {
  private requestId = 0;
  private readonly latestBySite = new Map<string, number>();

  begin(siteId: string): ChannelLoadRequest {
    const request = { siteId, requestId: ++this.requestId };
    this.latestBySite.set(siteId, request.requestId);
    return request;
  }

  isCurrent(request: ChannelLoadRequest, currentSiteId?: string): boolean {
    return (
      request.siteId === currentSiteId &&
      this.latestBySite.get(request.siteId) === request.requestId
    );
  }
}
