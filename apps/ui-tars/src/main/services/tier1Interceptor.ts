import { logger } from '../logger';
import { FastInputManager, ElementInfo } from '../utils/fastInput';
import { classifyAction } from './actionClassifier';

export interface Tier1Result {
  handled: boolean;
  actionTaken?: string;
  element?: ElementInfo | null;
  targetName?: string;
  windowTitle?: string;
  intent?: string;
  elapsedMs: number;
  tokensSaved: number;
  reason?: string;
}

export class Tier1Interceptor {
  private static instance: Tier1Interceptor;
  private fastInput = FastInputManager.getInstance();

  public static getInstance(): Tier1Interceptor {
    if (!Tier1Interceptor.instance) {
      Tier1Interceptor.instance = new Tier1Interceptor();
    }
    return Tier1Interceptor.instance;
  }

  /**
   * Tests whether an instruction can be satisfied directly by the local
   * Windows Native Accessibility Engine (UIA) without taking a screenshot
   * or consuming VLM vision tokens.
   */
  public async intercept(instruction: string): Promise<Tier1Result> {
    const startTime = Date.now();
    const classified = classifyAction(instruction);

    if (!classified.isNativeCandidate) {
      return {
        handled: false,
        intent: classified.intent,
        targetName: classified.targetName,
        windowTitle: classified.windowTitle,
        elapsedMs: Date.now() - startTime,
        tokensSaved: 0,
        reason: 'Instruction is not an atomic native candidate',
      };
    }

    logger.info('[Tier1Interceptor] Candidate classified for UIA inspection:', classified);

    try {
      // 1. Focus Window Intent
      if (classified.intent === 'focus_window' && classified.windowTitle) {
        const win = await this.fastInput.focusWindowByTitle(classified.windowTitle);
        if (win) {
          logger.info(`[Tier1Interceptor] 🎯 Focused window "${classified.windowTitle}" natively in ${Date.now() - startTime}ms`);
          return {
            handled: true,
            actionTaken: `focus_window "${classified.windowTitle}"`,
            elapsedMs: Date.now() - startTime,
            tokensSaved: 2000,
          };
        }
      }

      // 2. Click Element Intent
      if (classified.intent === 'click_element' && classified.targetName) {
        // Query UIA tree bounded by strict 200ms timeout
        const found = await this.fastInput.findElement(classified.targetName, {
          controlType: classified.targetType,
          windowFilter: classified.windowTitle,
          timeoutMs: 200,
        });

        if (found) {
          logger.info(
            `[Tier1Interceptor] 🎯 Element "${classified.targetName}" (${found.type}) found at [${found.centerX}, ${found.centerY}]. Firing instant native click.`,
          );
          const clicked = await this.fastInput.clickElement(classified.targetName, {
            controlType: classified.targetType,
            windowFilter: classified.windowTitle,
            timeoutMs: 250,
          });

          if (clicked) {
            return {
              handled: true,
              actionTaken: `click_element "${classified.targetName}" at (${found.centerX}, ${found.centerY})`,
              element: found,
              elapsedMs: Date.now() - startTime,
              tokensSaved: 2000,
            };
          }
        } else {
          logger.info(
            `[Tier1Interceptor] Element "${classified.targetName}" not found in current UIA tree (${Date.now() - startTime}ms). Routing to Tier-2 VLM.`,
          );
        }
      }

      // 3. Double Click Element Intent
      if (classified.intent === 'double_click_element' && classified.targetName) {
        const found = await this.fastInput.findElement(classified.targetName, {
          controlType: classified.targetType,
          windowFilter: classified.windowTitle,
          timeoutMs: 200,
        });

        if (found) {
          logger.info(`[Tier1Interceptor] 🎯 Element "${classified.targetName}" found. Firing native double click.`);
          const clicked = await this.fastInput.doubleClickElement(classified.targetName, {
            controlType: classified.targetType,
            windowFilter: classified.windowTitle,
            timeoutMs: 250,
          });

          if (clicked) {
            return {
              handled: true,
              actionTaken: `double_click_element "${classified.targetName}"`,
              element: found,
              elapsedMs: Date.now() - startTime,
              tokensSaved: 2000,
            };
          }
        }
      }

      // 4. Set Text / Direct Text Injection Intent
      if (classified.intent === 'set_text' && classified.textToInject) {
        const target = classified.targetName || 'Edit';
        const ok = await this.fastInput.setElementText(target, classified.textToInject, {
          controlType: classified.targetType || 'Edit',
          windowFilter: classified.windowTitle,
          timeoutMs: 250,
        });

        if (ok) {
          logger.info(
            `[Tier1Interceptor] 🎯 Direct text injection succeeded for "${classified.textToInject}" into "${target}" in ${Date.now() - startTime}ms`,
          );
          return {
            handled: true,
            actionTaken: `set_element_text "${classified.textToInject}"`,
            elapsedMs: Date.now() - startTime,
            tokensSaved: 2000,
          };
        }
      }
    } catch (err) {
      logger.warn('[Tier1Interceptor] Error during native UIA interception:', err);
    }

    return {
      handled: false,
      intent: classified.intent,
      targetName: classified.targetName,
      windowTitle: classified.windowTitle,
      elapsedMs: Date.now() - startTime,
      tokensSaved: 0,
      reason: `Element "${classified.targetName || 'target'}" not found in UIA tree, proceeding to Tier-2 VLM`,
    };
  }
}
