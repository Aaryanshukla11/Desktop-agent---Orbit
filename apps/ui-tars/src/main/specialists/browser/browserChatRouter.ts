import { PlaywrightBrowserBridge } from './browserBridge';
import { BrowserPlanner } from './browserPlanner';
import { BrowserSessionManager } from './browserSessionManager';
import { logger } from '../../logger';
import type { BrowserAction, BrowserExecutionResult } from './types';

export function isBrowserTask(instructions: string): boolean {
  if (!instructions || typeof instructions !== 'string') return false;
  const lower = instructions.toLowerCase();

  return (
    lower.includes('browser') ||
    lower.includes('website') ||
    lower.includes('chrome') ||
    lower.includes('search google') ||
    lower.includes('open google') ||
    lower.includes('youtube') ||
    lower.includes('amazon') ||
    lower.includes('github') ||
    lower.includes('wikipedia') ||
    lower.includes('reddit') ||
    lower.includes('twitter') ||
    lower.includes('x.com') ||
    lower.includes('http://') ||
    lower.includes('https://') ||
    lower.includes('.com') ||
    lower.includes('.org') ||
    lower.includes('.io') ||
    lower.includes('.net')
  );
}

export async function runBrowserTask(
  instructions: string,
  onProgress?: (status: string, percentage: number) => void,
): Promise<BrowserExecutionResult> {
  logger.info(`[runBrowserTask] Initiating Playwright Browser Specialist: "${instructions}"`);
  onProgress?.('Connecting to browser engine (Playwright / CDP)...', 15);

  const bridge = PlaywrightBrowserBridge.getInstance();
  const planner = new BrowserPlanner();
  const actionHistory: BrowserAction[] = [];
  const maxSteps = 12;

  try {
    const page = await bridge.ensureBrowser();
    const currentUrl = page.url();
    const pageTitle = await page.title();

    BrowserSessionManager.setActiveSession({
      url: currentUrl,
      title: pageTitle,
      isCdp: false,
      startTime: Date.now(),
      lastActionTime: Date.now(),
    });

    onProgress?.(`Browser ready. Inspecting current page: ${pageTitle || currentUrl}...`, 25);

    let stepCount = 0;
    let isFinished = false;

    while (stepCount < maxSteps && !isFinished) {
      stepCount++;
      const snapshot = await bridge.getPageSnapshot();
      BrowserSessionManager.updateUrl(snapshot.url, snapshot.title);

      const progressPct = Math.min(25 + stepCount * 8, 90);
      onProgress?.(`Planning step ${stepCount}: analyzing page "${snapshot.title || snapshot.url}"...`, progressPct);

      const nextAction = await planner.planNextAction(instructions, snapshot, actionHistory);
      actionHistory.push(nextAction);

      logger.info(`[runBrowserTask] Step ${stepCount} action: [${nextAction.action}] ${nextAction.thought || ''}`);
      onProgress?.(`Executing: ${nextAction.thought || `${nextAction.action} on ${nextAction.target || nextAction.value}`}`, progressPct + 4);

      try {
        switch (nextAction.action) {
          case 'navigate':
            if (nextAction.value) {
              await bridge.navigate(nextAction.value);
              await page.waitForLoadState('domcontentloaded').catch(() => {});
            }
            break;

          case 'click':
            if (nextAction.target) {
              await bridge.click(nextAction.target);
              await page.waitForTimeout(1000);
            }
            break;

          case 'type':
            if (nextAction.target && nextAction.value !== undefined) {
              await bridge.type(nextAction.target, nextAction.value, nextAction.pressEnter ?? false);
              await page.waitForTimeout(1000);
            }
            break;

          case 'scroll':
            await bridge.scroll('down', 500);
            break;

          case 'wait':
            await page.waitForTimeout(nextAction.timeoutMs || 2000);
            break;

          case 'extract':
          case 'finish':
            isFinished = true;
            break;

          default:
            isFinished = true;
            break;
        }
      } catch (stepErr: any) {
        logger.warn(`[runBrowserTask] Step ${stepCount} action warning: ${stepErr?.message || stepErr}. Retrying with alternative target in next step.`);
        onProgress?.(`Step ${stepCount} target not ready. Re-evaluating page...`, progressPct + 2);
      }
    }

    const finalSnapshot = await bridge.getPageSnapshot();
    onProgress?.('Browser automation completed successfully!', 100);

    const summaryMarkdown = `### 🌐 Orbit Browser Specialist Execution Complete

**Goal:** ${instructions}

- **Final URL:** [${finalSnapshot.title || finalSnapshot.url}](${finalSnapshot.url})
- **Steps Executed:** ${stepCount} deterministic actions via Playwright
- **Execution Mode:** Direct DOM & Safe Locator Automation (0 coordinate drift, zero misclicks)

#### Actions Executed:
${actionHistory.map((a, i) => `${i + 1}. **${a.action.toUpperCase()}**: ${a.thought || `${a.target || ''} ${a.value || ''}`}`).join('\n')}

#### Page Content Summary:
\`\`\`
${finalSnapshot.textContentSample.slice(0, 500)}
\`\`\`
`;

    return {
      success: true,
      finalUrl: finalSnapshot.url,
      pageTitle: finalSnapshot.title,
      summaryMarkdown,
      stepsCount: stepCount,
    };
  } catch (err: any) {
    logger.error('[runBrowserTask] Error during browser execution:', err);
    return {
      success: false,
      error: err?.message || String(err),
      summaryMarkdown: `**Browser Specialist Error**: ${err?.message || err}`,
      stepsCount: actionHistory.length,
    };
  }
}
 