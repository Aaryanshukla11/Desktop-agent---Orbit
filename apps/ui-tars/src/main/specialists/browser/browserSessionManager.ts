import { logger } from '../../logger';

export interface ActiveBrowserSession {
  url: string;
  title: string;
  isCdp: boolean;
  startTime: number;
  lastActionTime: number;
}

export class BrowserSessionManager {
  private static activeSession: ActiveBrowserSession | null = null;

  public static setActiveSession(session: ActiveBrowserSession): void {
    BrowserSessionManager.activeSession = session;
    logger.info(`[BrowserSessionManager] Active session registered for: ${session.url}`);
  }

  public static getActiveSession(): ActiveBrowserSession | null {
    return BrowserSessionManager.activeSession;
  }

  public static hasActiveSession(): boolean {
    return BrowserSessionManager.activeSession !== null;
  }

  public static updateUrl(url: string, title: string): void {
    if (BrowserSessionManager.activeSession) {
      BrowserSessionManager.activeSession.url = url;
      BrowserSessionManager.activeSession.title = title;
      BrowserSessionManager.activeSession.lastActionTime = Date.now();
    }
  }

  public static clearSession(): void {
    BrowserSessionManager.activeSession = null;
    logger.info(`[BrowserSessionManager] Active browser session cleared.`);
  }
}
