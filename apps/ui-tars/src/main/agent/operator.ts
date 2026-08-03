import path from 'path';
import fs from 'fs';
import os from 'os';
import { Button, Key, keyboard, mouse, Point } from '@computer-use/nut-js';
import {
  type ScreenshotOutput,
  type ExecuteParams,
  type ExecuteOutput,
} from '@ui-tars/sdk/core';
import { NutJSOperator } from '@ui-tars/operator-nut-js';
import { clipboard } from 'electron';
import { desktopCapturer } from 'electron';

import { StatusEnum } from '@ui-tars/shared/types';
import * as env from '@main/env';
import { logger } from '@main/logger';
import { sleep } from '@ui-tars/shared/utils';
import { getScreenSize } from '@main/utils/screen';
import { fastInput } from '@main/utils/fastInput';

/**
 * Mathematically sound coordinate resolver for high-DPI displays.
 * Resolves bounding box strings across UI-TARS 0-1000 normalized space,
 * 0.0-1.0 float space, and physical/logical pixel space without boundary clipping jumps.
 * Computes exact physical screen coordinates directly from screenshot dimensions to eliminate double-rounding drift.
 */
export function resolveScreenCoords(
  boxStr: string,
  logicalWidth: number,
  logicalHeight: number,
  physicalWidth?: number,
  physicalHeight?: number,
): { x: number; y: number; physX: number; physY: number } | null {
  if (!boxStr) return null;
  const nums = boxStr.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!nums || nums.length < 2) return null;

  const [x1, y1, x2 = x1, y2 = y1] = nums;
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  const maxVal = Math.max(Math.abs(x1), Math.abs(y1), Math.abs(x2), Math.abs(y2));

  const pWidth = physicalWidth && physicalWidth > 0 ? physicalWidth : (logicalWidth > 0 ? logicalWidth : 1920);
  const pHeight = physicalHeight && physicalHeight > 0 ? physicalHeight : (logicalHeight > 0 ? logicalHeight : 1080);
  const lWidth = logicalWidth && logicalWidth > 0 ? logicalWidth : (physicalWidth ? Math.round(physicalWidth / 2) : 960);
  const lHeight = logicalHeight && logicalHeight > 0 ? logicalHeight : (physicalHeight ? Math.round(physicalHeight / 2) : 540);

  let rawPhysX: number;
  let rawPhysY: number;

  if (maxVal <= 1.0) {
    // 0.0 - 1.0 normalized float: compute physical coordinate directly
    rawPhysX = centerX * pWidth;
    rawPhysY = centerY * pHeight;
  } else if (maxVal <= 1000) {
    // 0 - 1000 UI-TARS standard coordinate grid: compute physical coordinate directly
    rawPhysX = (centerX / 1000) * pWidth;
    rawPhysY = (centerY / 1000) * pHeight;
  } else if (physicalWidth && physicalHeight && maxVal <= physicalWidth) {
    // Already in physical screenshot pixels
    rawPhysX = centerX;
    rawPhysY = centerY;
  } else {
    // Logical screen pixels -> scale to physical
    const scale = pWidth / lWidth;
    rawPhysX = centerX * scale;
    rawPhysY = centerY * scale;
  }

  // Safe clamping to screen boundaries
  const physX = Math.max(0, Math.min(rawPhysX, pWidth - 1));
  const physY = Math.max(0, Math.min(rawPhysY, pHeight - 1));

  // Compute sub-pixel logical coordinates
  const logicalX = Math.max(0, Math.min((physX / pWidth) * lWidth, lWidth - 1));
  const logicalY = Math.max(0, Math.min((physY / pHeight) * lHeight, lHeight - 1));

  return {
    x: logicalX,
    y: logicalY,
    physX: Math.round(physX),
    physY: Math.round(physY),
  };
}

/**
 * Detects and evaluates synthetic string repetitions or list comprehensions
 * outputted by VLMs (e.g. "Product\tSales\n' + 'Item1\t100\n' * 200" or "'Row\n' * 50")
 */
export function expandSyntheticStringExpr(raw: string): string {
  if (!raw) return raw;
  const str = raw.trim();

  // Pattern 1: Concatenation + string multiplication:
  // e.g. "Product\tSales\n' + 'Item1\t100\n' * 200"
  const multMatch = str.match(/^(.*?)['"]?\s*\+\s*['"](.*?)['"]\s*\*\s*(\d+)$/s);
  if (multMatch) {
    let header = multMatch[1].trim();
    if (header.endsWith("'") || header.endsWith('"')) {
      header = header.slice(0, -1);
    }
    if (header.startsWith("'") || header.startsWith('"')) {
      header = header.slice(1);
    }
    const repeatBlock = multMatch[2];
    const count = parseInt(multMatch[3], 10);
    if (!isNaN(count) && count > 0 && count <= 5000) {
      logger.info(`[NutJSElectronOperator] Expanded synthetic string repeat (count: ${count})`);
      return header + repeatBlock.repeat(count);
    }
  }

  // Pattern 2: Pure multiplication: 'Row\n' * 200
  const pureMultMatch = str.match(/^['"]?(.*?)['"]\s*\*\s*(\d+)$/s);
  if (pureMultMatch) {
    const repeatBlock = pureMultMatch[1];
    const count = parseInt(pureMultMatch[2], 10);
    if (!isNaN(count) && count > 0 && count <= 5000) {
      logger.info(`[NutJSElectronOperator] Expanded pure string repeat (count: ${count})`);
      return repeatBlock.repeat(count);
    }
  }

  // Pattern 3: Python list comprehension join:
  // e.g. 'Header\n' + '\n'.join([f'Item{i}\t100' for i in range(1, 201)])
  const rangeMatch = str.match(/(?:for\s+([a-zA-Z_]\w*)\s+in\s+range\(\s*(\d+)\s*(?:,\s*(\d+))?\s*\))/);
  if (rangeMatch) {
    try {
      const templateMatch = str.match(/(?:f['"](.*?)['"]|['"](.*?)['"])\s+for\s+[a-zA-Z_]\w*\s+in\s+range/);
      const varName = rangeMatch[1];
      const start = rangeMatch[3] !== undefined ? parseInt(rangeMatch[2], 10) : 0;
      const end = rangeMatch[3] !== undefined ? parseInt(rangeMatch[3], 10) : parseInt(rangeMatch[2], 10);

      let header = '';
      const headerPart = str.split(/\+\s*['"]?['"]?\.join/)[0];
      if (headerPart && headerPart !== str) {
        header = headerPart.replace(/^['"]|['"]$/g, '');
      }

      if (templateMatch && !isNaN(start) && !isNaN(end) && end - start <= 5000) {
        const rawTpl = templateMatch[1] || templateMatch[2];
        const lines: string[] = [];
        for (let i = start; i < end; i++) {
          const line = rawTpl.replace(new RegExp(`\\{${varName}\\}`, 'g'), i.toString());
          lines.push(line);
        }
        logger.info(`[NutJSElectronOperator] Expanded Python list comprehension (${lines.length} lines)`);
        return header + lines.join('\n') + '\n';
      }
    } catch {}
  }

  return str;
}

/**
 * Extracts a robust semantic keyword hint from the agent's thought or prediction
 * for high-precision UI Automation element snapping.
 */
export function extractSemanticHint(thought: string, prediction?: string): string {
  if (!thought && !prediction) return '';
  const t = (thought || '').trim();

  // 1. Highest priority: Action verb directly followed by target element name
  // e.g. "click 'Insert'", "click on the Insert tab", "click on save", "click 'Blank presentation'"
  const actionMatch = t.match(
    /(?:click|select|press|choose|tap|focus)\s+(?:on\s+)?(?:the\s+)?["']?([a-zA-Z0-9_-]{2,25}?)["']?(?:\s+(?:button|icon|menu|item|tab|window|option|cell|checkbox|radio)|\.|\,|$|\n)/i,
  );
  if (actionMatch && actionMatch[1]) {
    const clean = actionMatch[1].trim().toLowerCase();
    const stopWords = ['to', 'on', 'the', 'a', 'an', 'button', 'icon', 'menu', 'item', 'at', 'it', 'here', 'this', 'that', 'start'];
    const firstWord = clean.split(/\s+/)[0];
    const genericApps = ['excel', 'word', 'powerpoint', 'notepad', 'calculator', 'chrome', 'edge'];
    if (!stopWords.includes(firstWord) && !genericApps.includes(firstWord) && firstWord.length >= 2) {
      return firstWord;
    }
  }

  // 2. Specific UI keywords in active verb context (e.g. "click save", "press insert", "select column")
  const verbUiMatch = t.match(
    /(?:click|select|press|choose|tap|hit)\s+.*?\\b(insert|blank|home|file|save|chart|column|draw|formulas|data|review|view|help|new|create|cancel|close|ok|apply)\\b/i,
  );
  if (verbUiMatch && verbUiMatch[1]) {
    return verbUiMatch[1].toLowerCase();
  }

  // 3. Focused UI action keywords if present in the thought
  const focusedUiKeywords = ['insert', 'blank', 'column', 'chart', 'create', 'cancel', 'close', 'ok'];
  for (const kw of focusedUiKeywords) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(t)) {
      return kw;
    }
  }

  // 4. Save keyword ONLY if in an active save context (not a passive secondary clause)
  if (/\b(?:click|press)\s+.*?save\b/i.test(t) || /^(?:save|saving)\b/i.test(t)) {
    return 'save';
  }

  return '';
}

export class NutJSElectronOperator extends NutJSOperator {
  static MANUAL = {
    ACTION_SPACES: [
      `click(start_box='[x1, y1, x2, y2]')`,
      `left_double(start_box='[x1, y1, x2, y2]')`,
      `right_single(start_box='[x1, y1, x2, y2]')`,
      `drag(start_box='[x1, y1, x2, y2]', end_box='[x3, y3, x4, y4]')`,
      `hotkey(key='')`,
      `type(content='') #If you want to submit your input, use "\\n" at the end of \`content\`.`,
      `scroll(start_box='[x1, y1, x2, y2]', direction='down or up or right or left')`,
      `wait() #Sleep for 5s and take a screenshot to check for any changes.`,
      `finished()`,
      `call_user() # Submit the task and call the user when the task is unsolvable, or when you need the user's help.`,
    ],
  };

  public async screenshot(): Promise<ScreenshotOutput> {
    const {
      physicalSize,
      logicalSize,
      scaleFactor,
      id: primaryDisplayId,
    } = getScreenSize(); // Logical = Physical / scaleX

    logger.info(
      '[screenshot] [primaryDisplay]',
      'logicalSize:',
      logicalSize,
      'physicalSize:',
      physicalSize,
      'scaleFactor:',
      scaleFactor,
    );

    // 1. Try ultra-fast FastInputServer native GDI capture (~150ms vs 3500ms powershell)
    if (env.isWindows) {
      try {
        const startCap = Date.now();
        const tmpCapturePath = path.resolve(os.tmpdir(), `uitars_cap_${Date.now()}.jpg`);
        const capOk = await fastInput.captureScreenshot(tmpCapturePath);
        if (capOk && fs.existsSync(tmpCapturePath)) {
          const fileBuf = await fs.promises.readFile(tmpCapturePath);
          fs.unlink(tmpCapturePath, () => {});
          if (fileBuf.length > 1000) {
            logger.info(`[screenshot] FastInputServer native capture succeeded in ${Date.now() - startCap}ms, size: ${fileBuf.length}`);
            return {
              base64: fileBuf.toString('base64'),
              scaleFactor,
            };
          }
        }
      } catch (e) {
        logger.warn('[screenshot] FastInputServer capture failed, falling back:', e);
      }
    }

    // 2. Try native desktopCapturer next
    try {
      const startCap = Date.now();
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: physicalSize.width,
          height: physicalSize.height,
        },
      });
      const primarySource =
        sources.find(
          (source) => source.display_id === primaryDisplayId.toString(),
        ) || sources[0];

      if (primarySource && !primarySource.thumbnail.isEmpty()) {
        const jpegBuf = primarySource.thumbnail.toJPEG(75);
        if (jpegBuf.length > 100) {
          logger.info(`[screenshot] desktopCapturer succeeded in ${Date.now() - startCap}ms, length: ${jpegBuf.length}`);
          return {
            base64: jpegBuf.toString('base64'),
            scaleFactor,
          };
        }
      }
    } catch (e) {
      logger.warn('[screenshot] desktopCapturer failed, falling back to interactive capture:', e);
    }

    // 2. Fallback to interactive powershell capture
    if (env.isWindows) {
      try {
        const { execSync } = require('child_process');
        const path = require('path');
        const scriptPath = path.resolve(__dirname, '../../resources/interactive_capture.ps1');
        const fallbackScript = 'c:/Users/Aaryan shukla/OneDrive/Desktop/UI-TARS-desktop-main/scripts/interactive_capture.ps1';
        const finalScript = require('fs').existsSync(scriptPath) ? scriptPath : fallbackScript;
        const captureWidth = Math.round(physicalSize.width);
        const captureHeight = Math.round(physicalSize.height);
        const base64 = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${finalScript}" ${captureWidth} ${captureHeight}`, {
          maxBuffer: 50 * 1024 * 1024,
        }).toString().trim();
        if (base64.length > 100) {
          logger.info('[screenshot] Successfully captured via interactive desktop capture, length:', base64.length);
          return {
            base64,
            scaleFactor,
          };
        }
      } catch (err) {
        logger.error('[screenshot] Interactive capture failed:', err);
      }
    }

    // fallback to default screenshot
    return await super.screenshot();
  }

  static lastCoords: [number, number] | null = null;

  async execute(params: ExecuteParams): Promise<ExecuteOutput> {
    const { action_type, action_inputs } = params.parsedPrediction;

    logger.info('[NutJSElectronOperator] executing action:', action_type, action_inputs);

    const { scaleFactor: primaryScaleFactor } = getScreenSize();
    const effectiveScale = params.scaleFactor || primaryScaleFactor || 1;

    // Convert screenshot dimensions to logical dimensions for mouse actions
    const logicalWidth = Math.round(params.screenWidth / effectiveScale);
    const logicalHeight = Math.round(params.screenHeight / effectiveScale);

    const startBoxStr = action_inputs?.start_box || '';
    let startX: number | null = null;
    let startY: number | null = null;
    let startPhysX: number | null = null;
    let startPhysY: number | null = null;
    if (startBoxStr) {
      const parsed = resolveScreenCoords(
        startBoxStr,
        logicalWidth,
        logicalHeight,
        params.screenWidth,
        params.screenHeight,
      );
      if (parsed) {
        startX = parsed.x;
        startY = parsed.y;
        startPhysX = parsed.physX;
        startPhysY = parsed.physY;
      }
    }

    NutJSElectronOperator.lastCoords =
      startX !== null && startY !== null ? [startX, startY] : null;

    const thought = params.parsedPrediction?.thought || '';
    const semanticHint = extractSemanticHint(thought, params.prediction);
    if (semanticHint) {
      logger.info(`[NutJSElectronOperator] Extracted semantic snapping hint: "${semanticHint}"`);
    }

    if (env.isWindows) {
      if (action_type === 'wait') {
        let waitDuration = 1500;
        if (action_inputs) {
          const rawInputs = action_inputs as Record<string, any>;
          const raw = (rawInputs.duration || rawInputs.time || rawInputs.seconds || '').toString();
          const parsedSec = parseFloat(raw);
          if (!isNaN(parsedSec) && parsedSec > 0) {
            waitDuration = Math.min(Math.round(parsedSec > 50 ? parsedSec : parsedSec * 1000), 10000);
          }
        }
        logger.info(`[NutJSElectronOperator] Smart Settle wait ${waitDuration}ms`);
        await sleep(waitDuration);
        return { status: StatusEnum.RUNNING };
      }

      if (action_type === 'mouse_move' || action_type === 'hover') {
        if (startX !== null && startY !== null) {
          logger.info(`[NutJSElectronOperator] humanGlide(${startX}, ${startY})`);
          if (env.isWindows) {
            await fastInput.humanGlide(startX, startY);
          } else {
            await mouse.setPosition(new Point(Math.round(startX), Math.round(startY)));
          }
        }
        return { status: StatusEnum.RUNNING };
      }

      if (
        action_type === 'click' ||
        action_type === 'left_click' ||
        action_type === 'left_single'
      ) {
        if (startX !== null && startY !== null) {
          logger.info(`[NutJSElectronOperator] smoothClick at (${startX}, ${startY}), hint: ${semanticHint || 'none'}, phys: (${startPhysX}, ${startPhysY})`);
          if (env.isWindows) {
            const ok = await fastInput.smoothClick(startX, startY, semanticHint, startPhysX || undefined, startPhysY || undefined);
            if (!ok) {
              await mouse.setPosition(new Point(Math.round(startX), Math.round(startY)));
              await sleep(50);
              await mouse.click(Button.LEFT);
            }
          } else {
            await mouse.setPosition(new Point(Math.round(startX), Math.round(startY)));
            await sleep(50);
            await mouse.click(Button.LEFT);
          }
        }
        return { status: StatusEnum.RUNNING };
      }

      if (action_type === 'left_double' || action_type === 'double_click') {
        if (startX !== null && startY !== null) {
          logger.info(`[NutJSElectronOperator] smoothDoubleClick at (${startX}, ${startY}), hint: ${semanticHint || 'none'}, phys: (${startPhysX}, ${startPhysY})`);
          if (env.isWindows) {
            const ok = await fastInput.smoothDoubleClick(startX, startY, semanticHint, startPhysX || undefined, startPhysY || undefined);
            if (!ok) {
              await mouse.setPosition(new Point(Math.round(startX), Math.round(startY)));
              await sleep(50);
              await mouse.doubleClick(Button.LEFT);
            }
          } else {
            await mouse.setPosition(new Point(Math.round(startX), Math.round(startY)));
            await sleep(50);
            await mouse.doubleClick(Button.LEFT);
          }
        }
        return { status: StatusEnum.RUNNING };
      }

      if (action_type === 'right_click' || action_type === 'right_single') {
        if (startX !== null && startY !== null) {
          logger.info(`[NutJSElectronOperator] smoothRightClick at (${startX}, ${startY}), hint: ${semanticHint || 'none'}, phys: (${startPhysX}, ${startPhysY})`);
          if (env.isWindows) {
            const ok = await fastInput.smoothRightClick(startX, startY, semanticHint, startPhysX || undefined, startPhysY || undefined);
            if (!ok) {
              await mouse.setPosition(new Point(Math.round(startX), Math.round(startY)));
              await sleep(50);
              await mouse.click(Button.RIGHT);
            }
          } else {
            await mouse.setPosition(new Point(Math.round(startX), Math.round(startY)));
            await sleep(50);
            await mouse.click(Button.RIGHT);
          }
        }
        return { status: StatusEnum.RUNNING };
      }

      if (action_type === 'drag') {
        const endBoxStr = action_inputs?.end_box || '';
        let endX: number | null = null;
        let endY: number | null = null;
        let endPhysX: number | null = null;
        let endPhysY: number | null = null;
        if (endBoxStr) {
          const parsedEnd = resolveScreenCoords(
            endBoxStr,
            logicalWidth,
            logicalHeight,
            params.screenWidth,
            params.screenHeight,
          );
          if (parsedEnd) {
            endX = parsedEnd.x;
            endY = parsedEnd.y;
            endPhysX = parsedEnd.physX;
            endPhysY = parsedEnd.physY;
          }
        }
        if (startX !== null && startY !== null && endX !== null && endY !== null) {
          logger.info(`[NutJSElectronOperator] smoothDrag (${startX}, ${startY}) -> (${endX}, ${endY})`);
          if (env.isWindows) {
            const ok = await fastInput.smoothDrag(
              startX,
              startY,
              endX,
              endY,
              startPhysX || undefined,
              startPhysY || undefined,
              endPhysX || undefined,
              endPhysY || undefined,
            );
            if (!ok) {
              await mouse.setPosition(new Point(startX, startY));
              await mouse.pressButton(Button.LEFT);
              await sleep(50);
              await mouse.setPosition(new Point(endX, endY));
              await sleep(50);
              await mouse.releaseButton(Button.LEFT);
            }
          }
        }
        return { status: StatusEnum.RUNNING };
      }

      if (action_type === 'scroll') {
        if (startX !== null && startY !== null) {
          if (env.isWindows) {
            await fastInput.move(startX, startY);
          } else {
            await mouse.setPosition(new Point(startX, startY));
          }
        }
        const direction = action_inputs?.direction?.toLowerCase() || 'down';
        const amount = 300;
        if (direction === 'down') {
          await mouse.scrollDown(amount);
        } else if (direction === 'up') {
          await mouse.scrollUp(amount);
        } else if (direction === 'left') {
          await mouse.scrollLeft(amount);
        } else if (direction === 'right') {
          await mouse.scrollRight(amount);
        }
        return { status: StatusEnum.RUNNING };
      }

      if (action_type === 'type' && action_inputs?.content !== undefined && action_inputs?.content !== null) {
        let content = typeof action_inputs.content === 'string' ? action_inputs.content : String(action_inputs.content);

        // 1. Check for pure Enter / Newline
        if (content === '\n' || content === '\\n' || content === '\r\n') {
          logger.info('[NutJSElectronOperator] type pure newline detected, pressing Enter');
          if (env.isWindows) {
            await fastInput.hotkey('enter');
          } else {
            await keyboard.pressKey(Key.Enter);
            await keyboard.releaseKey(Key.Enter);
          }
          return { status: StatusEnum.RUNNING };
        }

        // 2. Check for pure Tab
        if (content === '\t' || content === '\\t') {
          logger.info('[NutJSElectronOperator] type pure tab detected, pressing Tab');
          if (env.isWindows) {
            await fastInput.hotkey('tab');
          } else {
            await keyboard.pressKey(Key.Tab);
            await keyboard.releaseKey(Key.Tab);
          }
          return { status: StatusEnum.RUNNING };
        }

        // Defensive check: if runaway backspaces exist, clear with Ctrl+A instead
        if (content.includes('\b'.repeat(10)) || content.includes('\\b'.repeat(10))) {
          logger.warn('[NutJSElectronOperator] runaway backspaces detected in type content, selecting all and clearing');
          if (env.isWindows) {
            await fastInput.hotkey('ctrl+a');
          } else {
            await keyboard.pressKey(Key.LeftControl);
            await keyboard.pressKey(Key.A);
            await sleep(50);
            await keyboard.releaseKey(Key.A);
            await keyboard.releaseKey(Key.LeftControl);
          }
          await sleep(50);
          content = content.replace(/[\x08]/g, '').replace(/(\\b)+/g, '');
        }

        // Expand Python/JS synthetic string expressions (e.g. 'Header\n' + 'Row\n' * 200)
        content = expandSyntheticStringExpr(content);

        // Unescape escaped sequences from LLM predictions: \\n -> \n, \\t -> \t
        content = content
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\r/g, '\r');

        // Normalize Windows file path backslashes if double-escaped
        if (/^[a-zA-Z]:\\\\/.test(content)) {
          content = content.replace(/\\\\/g, '\\');
        }

        const pressEnterAtEnd = content.endsWith('\n');
        if (pressEnterAtEnd) {
          content = content.replace(/\n+$/, '');
        }

        if (content.length > 0) {
          // Focus target element if coordinates provided
          if (startX !== null && startY !== null) {
            logger.info(`[NutJSElectronOperator] Focusing input target at (${startX}, ${startY}) before typing`);
            if (env.isWindows) {
              await fastInput.smoothClick(startX, startY);
            } else {
              await mouse.setPosition(new Point(startX, startY));
              await mouse.click(Button.LEFT);
            }
            await sleep(80);
          }

          logger.info('[NutJSElectronOperator] type length:', content.length, 'pressEnter:', pressEnterAtEnd);
          if (env.isWindows) {
            let ok = false;
            if (content.includes('\n') || content.includes('\t') || content.length > 50) {
              ok = await fastInput.paste(content);
            } else {
              ok = await fastInput.type(content);
              if (!ok) {
                ok = await fastInput.paste(content);
              }
            }
            if (!ok) {
              clipboard.writeText(content);
              await sleep(50);
              await keyboard.pressKey(Key.LeftControl);
              await keyboard.pressKey(Key.V);
              await sleep(100);
              await keyboard.releaseKey(Key.V);
              await keyboard.releaseKey(Key.LeftControl);
            }
            if (pressEnterAtEnd) {
              await sleep(60);
              await fastInput.hotkey('enter');
              await sleep(200);
            }
          } else {
            clipboard.writeText(content);
            await keyboard.pressKey(Key.LeftControl);
            await keyboard.pressKey(Key.V);
            await keyboard.releaseKey(Key.V);
            await keyboard.releaseKey(Key.LeftControl);
            if (pressEnterAtEnd) {
              await sleep(60);
              await keyboard.pressKey(Key.Enter);
              await keyboard.releaseKey(Key.Enter);
            }
          }
        } else if (pressEnterAtEnd) {
          if (env.isWindows) {
            await fastInput.hotkey('enter');
          } else {
            await keyboard.pressKey(Key.Enter);
            await keyboard.releaseKey(Key.Enter);
          }
        }
        return { status: StatusEnum.RUNNING };
      }

      if (action_type === 'hotkey' || action_type === 'press' || action_type === 'key_press') {
        let keyStr = action_inputs?.key || action_inputs?.hotkey || action_inputs?.content;
        logger.info('[NutJSElectronOperator] hotkey/press raw:', keyStr);
        if (keyStr) {
          // Extract valid key sequence if model hallucinated trailing garbage (e.g. "(\n) (ctrl a')\n2. type)" -> "ctrl a")
          const clean = keyStr.replace(/['"\\()]/g, ' ').trim();
          const match = clean.match(/\b(ctrl|alt|shift|win|windows|enter|return|esc|escape|tab|space|backspace|delete|del|f\d+|[a-z0-9])(?:\s*[\s\-_+]\s*(?:[a-z0-9]|f\d+|enter|esc|tab|space|delete|del|backspace))*\b/i);
          if (match) {
            keyStr = match[0];
          }
        }
        logger.info('[NutJSElectronOperator] hotkey/press sanitized:', keyStr);
        const normKey = (keyStr || '').toLowerCase().replace(/[\s\-_+]/g, '');
        if (normKey === 'altf4') {
          logger.warn('[NutJSElectronOperator] blocked alt+f4 to preserve user session and IDE');
          return { status: StatusEnum.RUNNING };
        }
        if (env.isWindows && keyStr) {
          const ok = await fastInput.hotkey(keyStr);
          if (ok) {
            return { status: StatusEnum.RUNNING };
          }
        }
        const keys = getHotkeys(keyStr);
        if (keys.length > 0) {
          for (const k of keys) {
            await keyboard.pressKey(k);
            await sleep(25);
          }
          await sleep(50);
          for (const k of [...keys].reverse()) {
            await keyboard.releaseKey(k);
            await sleep(25);
          }
          await sleep(100);
        }
        return { status: StatusEnum.RUNNING };
      }
    }

    return await super.execute({
      ...params,
      screenWidth: logicalWidth,
      screenHeight: logicalHeight,
    });
  }
}

function getHotkeys(keyStr: string | undefined): Key[] {
  if (!keyStr) return [];
  const keyMap: Record<string, Key> = {
    return: Key.Enter,
    enter: Key.Enter,
    ctrl: Key.LeftControl,
    control: Key.LeftControl,
    shift: Key.LeftShift,
    alt: Key.LeftAlt,
    win: Key.LeftWin,
    windows: Key.LeftWin,
    meta: Key.LeftWin,
    cmd: Key.LeftWin,
    command: Key.LeftWin,
    space: Key.Space,
    tab: Key.Tab,
    esc: Key.Escape,
    escape: Key.Escape,
    backspace: Key.Backspace,
    up: Key.Up,
    arrowup: Key.Up,
    down: Key.Down,
    arrowdown: Key.Down,
    left: Key.Left,
    arrowleft: Key.Left,
    right: Key.Right,
    arrowright: Key.Right,
  };

  const lowercaseKeyMap = Object.fromEntries(
    Object.entries(Key).map(([k, v]) => [k.toLowerCase(), v as Key]),
  );

  return keyStr
    .split(/[\s+]/)
    .map((k) => k.toLowerCase())
    .map((k) => keyMap[k] ?? lowercaseKeyMap[k])
    .filter((k): k is Key => k !== undefined);
}
