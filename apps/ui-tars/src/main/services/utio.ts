/**
 * Orbit Beta: Telemetry Neutralized
 * Zero external data transmission. User prompts and desktop screenshots remain 100% private.
 */
import { logger } from '../logger';

export class UTIOService {
  private static instance: UTIOService;

  static getInstance(): UTIOService {
    if (!UTIOService.instance) {
      UTIOService.instance = new UTIOService();
    }
    return UTIOService.instance;
  }

  async appLaunched(): Promise<void> {
    logger.debug('[Orbit Security] Telemetry disabled: appLaunched ping skipped.');
  }

  async sendInstruction(_instruction: string): Promise<void> {
    logger.debug('[Orbit Security] Telemetry disabled: instruction logging skipped.');
  }

  async shareReport(_params: {
    instruction: string;
    lastScreenshot?: string;
    report?: string;
  }): Promise<void> {
    logger.debug('[Orbit Security] Telemetry disabled: report sharing skipped.');
  }
}

