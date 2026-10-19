import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { logger } from '../../logger';
import type { InteractiveElement, PageSnapshot } from './types';

export class PlaywrightBrowserBridge {
  private static instance: PlaywrightBrowserBridge | null = null;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private activePage: Page | null = null;
  private isCdpAttached = false;

  private constructor() {}

  public static getInstance(): PlaywrightBrowserBridge {
    if (!PlaywrightBrowserBridge.instance) {
      PlaywrightBrowserBridge.instance = new PlaywrightBrowserBridge();
    }
    return PlaywrightBrowserBridge.instance;
  }

  /**
   * Locate installed Google Chrome or Microsoft Edge executable on Windows/Mac
   */
  public findBrowserExecutable(): string | null {
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      const candidates = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) return p;
      }
    } else {
      const macCandidates = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      ];
      for (const p of macCandidates) {
        if (fs.existsSync(p)) return p;
      }
    }
    return null;
  }

  /**
   * Connect to an existing browser via CDP or launch a persistent browser session
   */
  public async ensureBrowser(cdpPort = 9222): Promise<Page> {
    if (this.activePage && !this.activePage.isClosed()) {
      return this.activePage;
    }

    // Attempt 1: Connect to user's running Chrome/Edge via CDP
    try {
      logger.info(`[PlaywrightBridge] Probing CDP connection at http://127.0.0.1:${cdpPort}...`);
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`, { timeout: 1500 });
      this.browser = browser;
      this.isCdpAttached = true;
      const contexts = browser.contexts();
      const ctx = contexts[0] || (await browser.newContext());
      this.context = ctx;
      const pages = ctx.pages();
      this.activePage = pages[0] || (await ctx.newPage());
      logger.info(`[PlaywrightBridge] Successfully attached to live browser via CDP!`);
      return this.activePage;
    } catch {
      logger.info(`[PlaywrightBridge] CDP not active on port ${cdpPort}. Launching dedicated persistent browser...`);
    }

    // Attempt 2: Launch persistent browser session
    const executablePath = this.findBrowserExecutable();
    const userDataDir = path.resolve(os.homedir(), '.orbit-browser-profile');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    const launchArgs = [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--start-maximized',
      '--no-default-browser-check',
      `--remote-debugging-port=${cdpPort}`,
    ];

    try {
      const context = await chromium.launchPersistentContext(userDataDir, {
        executablePath: executablePath || undefined,
        channel: !executablePath ? 'chrome' : undefined,
        headless: false,
        args: launchArgs,
        viewport: null, // Let browser use full maximized window
      });

      this.context = context;
      this.isCdpAttached = false;
      const pages = context.pages();
      this.activePage = pages[0] || (await context.newPage());
      logger.info(`[PlaywrightBridge] Dedicated persistent browser launched successfully.`);
      return this.activePage;
    } catch (err: any) {
      logger.error(`[PlaywrightBridge] Failed to launch persistent browser:`, err);
      throw new Error(`Could not launch browser: ${err?.message || err}`);
    }
  }

  public async getPage(): Promise<Page> {
    if (this.activePage && !this.activePage.isClosed()) {
      return this.activePage;
    }
    return this.ensureBrowser();
  }

  public async navigate(url: string): Promise<string> {
    const page = await this.getPage();
    const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    logger.info(`[PlaywrightBridge] Navigating to: ${fullUrl}`);
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return page.url();
  }

  public async click(selectorOrText: string): Promise<void> {
    const page = await this.getPage();
    logger.info(`[PlaywrightBridge] Clicking target: "${selectorOrText}"`);
    const cleanTarget = selectorOrText.trim();
    const pureText = cleanTarget
      .replace(/^[a-z]+:has-text\("?/i, '')
      .replace(/"?\)$/, '')
      .replace(/^(\[aria-label="?|\[placeholder="?)/i, '')
      .replace(/"?\]$/, '')
      .replace(/^[#.]/, '');

    // Strategy 1: Iterate all matching elements and click the FIRST VISIBLE one
    try {
      const candidates = page.locator(cleanTarget);
      const count = await candidates.count().catch(() => 0);
      for (let i = 0; i < count; i++) {
        const item = candidates.nth(i);
        if (await item.isVisible().catch(() => false)) {
          await item.scrollIntoViewIfNeeded().catch(() => {});
          try {
            await item.click({ timeout: 2500 });
            logger.info(`[PlaywrightBridge] Clicked visible candidate #${i + 1} for "${cleanTarget}".`);
            return;
          } catch {
            await item.click({ force: true, timeout: 2000 });
            return;
          }
        }
      }
    } catch {}

    // Strategy 2: Try with :visible pseudo-selector
    try {
      const visLoc = page.locator(`${cleanTarget}:visible`).first();
      if (await visLoc.isVisible({ timeout: 1500 }).catch(() => false)) {
        await visLoc.click({ timeout: 2500, force: true });
        logger.info(`[PlaywrightBridge] Clicked via :visible selector.`);
        return;
      }
    } catch {}

    // Strategy 3: Try semantic role matching (tab, link, button)
    try {
      for (const role of ['tab', 'button', 'link', 'menuitem'] as const) {
        const roleLoc = page.getByRole(role, { name: pureText }).first();
        if (await roleLoc.isVisible({ timeout: 1000 }).catch(() => false)) {
          await roleLoc.scrollIntoViewIfNeeded().catch(() => {});
          await roleLoc.click({ timeout: 2500, force: true });
          logger.info(`[PlaywrightBridge] Clicked via role "${role}" for "${pureText}".`);
          return;
        }
      }
    } catch {}

    // Strategy 4: Try getByText matching only visible candidates
    try {
      const textLocs = page.getByText(pureText, { exact: false });
      const tCount = await textLocs.count().catch(() => 0);
      for (let i = 0; i < tCount; i++) {
        const item = textLocs.nth(i);
        if (await item.isVisible().catch(() => false)) {
          await item.click({ timeout: 2000, force: true });
          logger.info(`[PlaywrightBridge] Clicked visible text candidate #${i + 1}.`);
          return;
        }
      }
    } catch {}

    // Strategy 5: JavaScript DOM click fallback (bypasses any occlusion or hidden overlay)
    try {
      const clicked = await page.evaluate((target) => {
        const lower = target.toLowerCase();
        const all = Array.from(document.querySelectorAll('a, button, [role="button"], [role="tab"], li, span'));
        // Find visible element with matching text
        const match = all.find((node) => {
          const el = node as HTMLElement;
          const rect = el.getBoundingClientRect();
          const isVis = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
          const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
          return isVis && txt.includes(lower);
        }) as HTMLElement | null;

        if (match) {
          match.scrollIntoView({ behavior: 'instant', block: 'center' });
          match.click();
          return true;
        }
        return false;
      }, pureText);

      if (clicked) {
        logger.info(`[PlaywrightBridge] Clicked successfully via JavaScript DOM fallback.`);
        return;
      }
    } catch {}

    // Strategy 6: Fallback force click
    await page.click(cleanTarget, { timeout: 4000, force: true });
  }

  public async type(selectorOrText: string, text: string, pressEnter = false): Promise<void> {
    const page = await this.getPage();
    logger.info(`[PlaywrightBridge] Typing "${text}" into: "${selectorOrText}"`);

    // Find visible matching input
    let targetLoc = page.locator(selectorOrText).first();
    const candidates = page.locator(selectorOrText);
    const count = await candidates.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const c = candidates.nth(i);
      if (await c.isVisible().catch(() => false)) {
        targetLoc = c;
        break;
      }
    }

    const isVisible = await targetLoc.isVisible({ timeout: 1500 }).catch(() => false);
    if (!isVisible) {
      const pure = selectorOrText.replace(/^[a-z]+\[placeholder="?/i, '').replace(/"?\]$/, '');
      const placeholderLoc = page.getByPlaceholder(pure).first();
      if (await placeholderLoc.isVisible({ timeout: 1500 }).catch(() => false)) {
        targetLoc = placeholderLoc;
      }
    }

    await targetLoc.scrollIntoViewIfNeeded().catch(() => {});
    await targetLoc.fill(text, { timeout: 6000 }).catch(async () => {
      // Fallback: click and keyboard type
      await targetLoc.click({ force: true }).catch(() => {});
      await page.keyboard.type(text, { delay: 30 });
    });

    if (pressEnter) {
      await page.keyboard.press('Enter');
    }
  }

  public async scroll(direction: 'up' | 'down', amount = 500): Promise<void> {
    const page = await this.getPage();
    const scrollY = direction === 'down' ? amount : -amount;
    await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), scrollY);
    await page.waitForTimeout(500);
  }

  /**
   * Snapshot page: extracts URL, Title, clean text snippet, and strictly visible interactive elements
   */
  public async getPageSnapshot(): Promise<PageSnapshot> {
    const page = await this.getPage();
    const url = page.url();
    const title = await page.title();

    // Extract interactive elements from DOM (Filtering out hidden mobile drawers)
    const interactiveElements: InteractiveElement[] = await page.evaluate(() => {
      const elements: InteractiveElement[] = [];
      const query = 'button, a, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="searchbox"]';
      const nodes = document.querySelectorAll(query);

      let counter = 1;
      nodes.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const rect = htmlEl.getBoundingClientRect();
        const style = window.getComputedStyle(htmlEl);

        // Strict visibility filter: skip collapsed or zero-size elements
        if (
          rect.width === 0 ||
          rect.height === 0 ||
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0' ||
          htmlEl.offsetParent === null
        ) {
          return;
        }

        const tag = htmlEl.tagName.toLowerCase();
        const type = htmlEl.getAttribute('type') || undefined;
        const text = (htmlEl.innerText || htmlEl.textContent || (htmlEl as HTMLInputElement).value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
        const placeholder = (htmlEl as HTMLInputElement).placeholder || undefined;
        const ariaLabel = htmlEl.getAttribute('aria-label') || undefined;
        const dataStid = htmlEl.getAttribute('data-stid') || htmlEl.getAttribute('data-testid') || undefined;
        const id = htmlEl.id ? `#${htmlEl.id}` : `el_${counter++}`;

        let selector = '';
        if (htmlEl.id) {
          selector = `#${htmlEl.id}`;
        } else if (dataStid) {
          selector = `${tag}[data-stid="${dataStid}"]`;
        } else if (ariaLabel) {
          selector = `${tag}[aria-label="${ariaLabel}"]`;
        } else if (htmlEl.getAttribute('name')) {
          selector = `${tag}[name="${htmlEl.getAttribute('name')}"]`;
        } else if (placeholder) {
          selector = `${tag}[placeholder="${placeholder}"]`;
        } else if (text) {
          selector = `${tag}:has-text("${text.slice(0, 30)}")`;
        } else {
          selector = tag;
        }

        elements.push({
          id,
          tag,
          type,
          text,
          placeholder,
          ariaLabel,
          selector,
        });
      });

      return elements.slice(0, 45); // Top 45 visible interactive controls
    });

    // Extract clean visible text summary
    const textContentSample = await page.evaluate(() => {
      return (document.body.innerText || '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .slice(0, 30)
        .join('\n')
        .slice(0, 1500);
    });

    return {
      url,
      title,
      interactiveElements,
      textContentSample,
    };
  }

  public async close(): Promise<void> {
    if (this.isCdpAttached) {
      // Don't close user's personal browser, just disconnect
      await this.browser?.close().catch(() => {});
    } else {
      await this.context?.close().catch(() => {});
    }
    this.activePage = null;
    this.context = null;
    this.browser = null;
  }
}
