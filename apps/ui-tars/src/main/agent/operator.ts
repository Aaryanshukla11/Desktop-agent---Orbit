import path from 'path';
import fs from 'fs';
import os from 'os';
import { Button, Key, keyboard, mouse, Point } from '@computer-use/nut-js';
import {
  type ScreenshotOutput,
  type ExecuteParams,
  type ExecuteOutput,
} from '@UI-TARs/sdk/core';
import { NutJSOperator } from '@UI-TARs/operator-nut-js';
import { clipboard } from 'electron';
import { desktopCapturer } from 'electron';

import { StatusEnum } from '@UI-TARs/shared/types';
import * as env from '@main/env';
import { logger } from '@main/logger';
import { sleep } from '@UI-TARs/shared/utils';
import { getScreenSize } from '@main/utils/screen';
import { store } from '@main/store/create';
import { fastInput } from '@main/utils/fastInput';
import { overlayCoordinateGrid } from '@main/utils/image';

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
 * Evaluates safe basic arithmetic expressions without eval or Function constructors
 */
export function evaluateSafeArithmetic(expr: string): number | null {
  const clean = expr.replace(/\s+/g, '');
  if (!clean || !/^[0-9+\-*/%()]+$/.test(clean)) return null;

  let pos = 0;

  function parsePrimary(): number {
    if (clean[pos] === '(') {
      pos++; // skip '('
      const val = parseExpression();
      if (clean[pos] === ')') pos++; // skip ')'
      return val;
    }
    if (clean[pos] === '+' || clean[pos] === '-') {
      const sign = clean[pos] === '-' ? -1 : 1;
      pos++;
      return sign * parsePrimary();
    }
    const numStart = pos;
    while (
      pos < clean.length &&
      ((clean[pos] >= '0' && clean[pos] <= '9') || clean[pos] === '.')
    ) {
      pos++;
    }
    if (numStart === pos) return 0;
    return parseFloat(clean.slice(numStart, pos));
  }

  function parseTerm(): number {
    let left = parsePrimary();
    while (pos < clean.length) {
      const op = clean[pos];
      if (op === '*' || op === '/' || op === '%') {
        pos++;
        const right = parsePrimary();
        if (op === '*') left = left * right;
        else if (op === '/') left = right !== 0 ? left / right : 0;
        else if (op === '%') left = right !== 0 ? left % right : 0;
      } else {
        break;
      }
    }
    return left;
  }

  function parseExpression(): number {
    let left = parseTerm();
    while (pos < clean.length) {
      const op = clean[pos];
      if (op === '+' || op === '-') {
        pos++;
        const right = parseTerm();
        left = op === '+' ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  try {
    const res = parseExpression();
    return isFinite(res) ? res : null;
  } catch {
    return null;
  }
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
    let rawHeader = multMatch[1].trim();
    if (rawHeader.startsWith("'") || rawHeader.startsWith('"')) {
      rawHeader = rawHeader.slice(1);
    }
    if (rawHeader.endsWith("'") || rawHeader.endsWith('"')) {
      rawHeader = rawHeader.slice(0, -1);
    }
    // Unescape literal \n in header if needed
    let header = rawHeader.replace(/\\n$/, '\n');
    if (header && !header.endsWith('\n')) {
      header += '\n';
    }
    const repeatBlock = multMatch[2].replace(/\\n/g, '\n').replace(/\\t/g, '\t');
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
  // e.g. 'Header\n' + '\n'.join([f'Item{i}\t{i*10}' for i in range(1, 201)])
  const listCompMatch = str.match(/\[\s*(?:f['"](.*?)['"]|['"](.*?)['"])\s+for\s+([a-zA-Z_]\w*)\s+in\s+range\(\s*(\d+)\s*(?:,\s*(\d+))?\s*\)/);
  if (listCompMatch) {
    try {
      const rawTpl = listCompMatch[1] || listCompMatch[2];
      const varName = listCompMatch[3];
      const start = listCompMatch[5] !== undefined ? parseInt(listCompMatch[4], 10) : 0;
      const end = listCompMatch[5] !== undefined ? parseInt(listCompMatch[5], 10) : parseInt(listCompMatch[4], 10);

      // Extract header before join if present
      let header = '';
      if (str.includes('.join')) {
        const beforeJoin = str.split(/\.join/)[0];
        const headerPart = beforeJoin.split(/\+/)[0].trim();
        let clean = headerPart;
        if (clean.startsWith("'") || clean.startsWith('"')) clean = clean.slice(1);
        if (clean.endsWith("'") || clean.endsWith('"')) clean = clean.slice(0, -1);
        clean = clean.replace(/\\n$/, '\n');
        if (clean && !clean.endsWith('\n')) clean += '\n';
        header = clean;
      }

      if (!isNaN(start) && !isNaN(end) && end - start <= 5000) {
        const lines: string[] = [];
        for (let i = start; i < end; i++) {
          const line = rawTpl.replace(new RegExp(`\\{([^}]+)\\}`, 'g'), (_, expr) => {
            try {
              const substituted = expr.replace(new RegExp(`\\b${varName}\\b`, 'g'), i.toString());
              const calc = evaluateSafeArithmetic(substituted);
              if (calc !== null) {
                return String(calc);
              }
              return substituted;
            } catch {
              return i.toString();
            }
          });
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

  // 1. Excel cell patterns: e.g. "cell A1", "cell B2", "cell AA12", "click A1", "select cell B5"
  const cellMatch = t.match(/\b(?:cell\s+)?([a-zA-Z]{1,3}\d{1,5})\b/i);
  if (cellMatch && cellMatch[1]) {
    const rawCell = cellMatch[1].toLowerCase();
    if (/^[a-z]{1,3}\d{1,5}$/.test(rawCell)) {
      return rawCell;
    }
  }

  // 2. Quoted targets have highest priority (e.g. click on "Presentation", click 'Blank presentation', click "Insert")
  const quotedMatch = t.match(
    /(?:click|select|press|choose|tap|focus|open)\s+(?:on\s+)?(?:the\s+)?["']([a-zA-Z0-9_\s-]{2,35}?)["']/i,
  );
  if (quotedMatch && quotedMatch[1]) {
    const clean = quotedMatch[1].trim().toLowerCase();
    const firstWord = clean.split(/\s+/)[0];
    if (firstWord.length >= 2) {
      return firstWord;
    }
  }

  // 3. Search bar, address bar, formula bar, blank workbook/presentation
  const compoundMatch = t.match(
    /\b(search|address|formula|blank|template|presentation|workbook|sheet)\s+(?:bar|box|field|input|button|tab|cell)?\b/i,
  );
  if (compoundMatch && compoundMatch[1]) {
    return compoundMatch[1].toLowerCase();
  }

  // 4. Unquoted action verb followed by target element name
  const actionMatch = t.match(
    /(?:click|select|press|choose|tap|focus)\s+(?:on\s+)?(?:the\s+)?([a-zA-Z0-9_-]{2,25})/i,
  );
  if (actionMatch && actionMatch[1]) {
    const clean = actionMatch[1].trim().toLowerCase();
    const stopWords = ['to', 'on', 'the', 'a', 'an', 'button', 'icon', 'menu', 'item', 'at', 'it', 'here', 'this', 'that', 'start', 'in', 'cell'];
    if (!stopWords.includes(clean) && clean.length >= 2) {
      return clean;
    }
  }

  // 5. Specific UI keywords in active verb context (e.g. "click presentation", "press insert", "select column")
  const verbUiMatch = t.match(
    /(?:click|select|press|choose|tap|hit)\s+.*?\b(presentation|template|search|insert|blank|home|file|save|chart|column|draw|formulas|data|review|view|help|new|create|cancel|close|ok|apply)\b/i,
  );
  if (verbUiMatch && verbUiMatch[1]) {
    return verbUiMatch[1].toLowerCase();
  }

  // 6. Focused UI action keywords anywhere in thought
  const focusedUiKeywords = ['presentation', 'template', 'search', 'insert', 'blank', 'column', 'chart', 'create', 'cancel', 'close', 'ok', 'add', 'page', 'slide'];
  for (const kw of focusedUiKeywords) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(t)) {
      return kw;
    }
  }

  // 7. Save keyword in active context
  if (/\b(?:click|press)\s+.*?save\b/i.test(t) || /^(?:save|saving)\b/i.test(t)) {
    return 'save';
  }

  return '';
}

export class NutJSElectronOperator extends NutJSOperator {
  static lastClickRecord: { physX: number; physY: number; count: number; lastThought?: string } = {
    physX: -1,
    physY: -1,
    count: 0,
    lastThought: '',
  };
  static recentClicks: Array<{ physX: number; physY: number; timestamp: number }> = [];
  static lastTypeRecord = { content: '', count: 0 };
  static lastHotkeyRecord = { key: '', count: 0 };
  static lastTableColCount = 0;

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
            const gridded = await overlayCoordinateGrid(fileBuf.toString('base64'), physicalSize.width, physicalSize.height);
            return {
              base64: gridded,
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

      if (primarySource && (typeof primarySource.thumbnail.isEmpty === 'function' ? !primarySource.thumbnail.isEmpty() : true)) {
        const imageBuf = typeof primarySource.thumbnail.toJPEG === 'function'
          ? primarySource.thumbnail.toJPEG(75)
          : primarySource.thumbnail.toPNG();
        if (imageBuf.length > 0) {
          logger.info(`[screenshot] desktopCapturer succeeded in ${Date.now() - startCap}ms, length: ${imageBuf.length}`);
          const gridded = await overlayCoordinateGrid(imageBuf.toString('base64'), physicalSize.width, physicalSize.height);
          return {
            base64: gridded,
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
        const { execFileSync } = require('child_process');
        const path = require('path');
        const fs = require('fs');
        const candidateScripts = [
          path.resolve(__dirname, '../../resources/interactive_capture.ps1'),
          path.resolve(process.cwd(), 'scripts/interactive_capture.ps1'),
          path.resolve(
            process.cwd(),
            'apps/ui-tars/resources/interactive_capture.ps1',
          ),
          path.resolve(__dirname, '../resources/interactive_capture.ps1'),
        ];
        const finalScript = candidateScripts.find((p) => fs.existsSync(p));
        if (!finalScript) {
          logger.warn('[screenshot] interactive_capture.ps1 script not found');
        } else {
          const captureWidth = Math.round(physicalSize.width);
          const captureHeight = Math.round(physicalSize.height);
          const base64 = execFileSync(
            'powershell.exe',
            [
              '-NoProfile',
              '-ExecutionPolicy',
              'Bypass',
              '-File',
              finalScript,
              String(captureWidth),
              String(captureHeight),
            ],
            {
              maxBuffer: 50 * 1024 * 1024,
              windowsHide: true,
            },
          )
            .toString()
            .trim();
          if (base64.length > 100) {
            logger.info(
              '[screenshot] Successfully captured via interactive desktop capture, length:',
              base64.length,
            );
            const gridded = await overlayCoordinateGrid(
              base64,
              captureWidth,
              captureHeight,
            );
            return {
              base64: gridded,
              scaleFactor,
            };
          }
        }
      } catch (err) {
        logger.error('[screenshot] Interactive capture failed:', err);
      }
    }

    // fallback to default screenshot
    const fallbackSnap = await super.screenshot();
    const gridded = await overlayCoordinateGrid(fallbackSnap.base64, physicalSize.width, physicalSize.height);
    return {
      base64: gridded,
      scaleFactor: fallbackSnap.scaleFactor,
    };
  }

  static lastCoords: [number, number] | null = null;
  static lastWasWinKey: boolean = false;

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

    const thought = params.parsedPrediction?.thought || '';
    const isTaskbarIntent = /\b(?:taskbar|start\s*(?:menu|button)|system\s*tray|tray|clock|notification\s*center)\b/i.test(thought);
    if (!isTaskbarIntent && startPhysY !== null && params.screenHeight > 0) {
      const taskbarThreshold = Math.round(params.screenHeight * 0.94);
      if (startPhysY >= taskbarThreshold) {
        // Model overshot into Windows Taskbar when aiming for bottom-docked application UI (e.g. Instagram Messages pill, web footers)
        const clampedPhysY = Math.round(params.screenHeight * 0.88);
        logger.warn(
          `[NutJSElectronOperator] Taskbar overshoot guard: Clamped physical Y from ${startPhysY} to ${clampedPhysY} to protect OS tray/clock`,
        );
        startPhysY = clampedPhysY;
        startY = Math.round(startPhysY / effectiveScale);
      }
    }

    NutJSElectronOperator.lastCoords =
      startPhysX !== null && startPhysY !== null
        ? [startPhysX, startPhysY]
        : (startX !== null && startY !== null ? [startX, startY] : null);

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
        if (startPhysX !== null && startPhysY !== null) {
          logger.info(`[NutJSElectronOperator] humanGlide physical (${startPhysX}, ${startPhysY})`);
          if (env.isWindows) {
            await fastInput.humanGlide(startPhysX, startPhysY);
          } else {
            await mouse.setPosition(new Point(Math.round(startX!), Math.round(startY!)));
          }
        }
        return { status: StatusEnum.RUNNING };
      }

      // Step 4: Keyboard-First Strategy for Dense Grids & Browser Toolbar Guard
      if (
        action_type === 'click' ||
        action_type === 'left_click' ||
        action_type === 'left_single' ||
        action_type === 'left_double' ||
        action_type === 'double_click'
      ) {
        // 1. Excel Cell A1 shortcut auto-conversion
        if (semanticHint === 'a1' || /\b(?:cell\s+a1|select\s+a1|click\s+a1)\b/i.test(thought)) {
          logger.info('[NutJSElectronOperator] Keyboard-First Cell A1 navigation: executing esc -> ctrl home');
          if (env.isWindows) {
            await fastInput.hotkey('esc');
            await sleep(50);
            await fastInput.hotkey('ctrl home');
          } else {
            await keyboard.pressKey(Key.Escape);
            await keyboard.releaseKey(Key.Escape);
            await sleep(50);
            await keyboard.pressKey(Key.LeftControl, Key.Home);
            await keyboard.releaseKey(Key.LeftControl, Key.Home);
          }
          await sleep(150);
          return { status: StatusEnum.RUNNING };
        }

        // 2. Excel Go-to-cell (Ctrl+G) for specific cell references (e.g. B2, C5)
        if (/^[a-z]{1,3}\d{1,5}$/i.test(semanticHint) && /\b(?:cell|select|goto|go\s+to)\b/i.test(thought)) {
          logger.info(`[NutJSElectronOperator] Keyboard-First Go To Cell navigation: ctrl+g -> ${semanticHint.toUpperCase()}`);
          if (env.isWindows) {
            await fastInput.hotkey('ctrl g');
            await sleep(100);
            await fastInput.type(semanticHint.toUpperCase() + '\n');
          } else {
            await keyboard.pressKey(Key.LeftControl, Key.G);
            await keyboard.releaseKey(Key.LeftControl, Key.G);
            await sleep(100);
            await keyboard.type(semanticHint.toUpperCase() + '\n');
          }
          await sleep(150);
          return { status: StatusEnum.RUNNING };
        }

        // 3. Browser Address Bar & System Toolbar Protection
        const isAddressBarTarget = /\b(?:address\s*bar|url\s*bar|omnibox|enter\s+.*?\burl|type\s+.*?\burl|canva\s+website\s+url)\b/i.test(thought);
        if (isAddressBarTarget) {
          logger.info('[NutJSElectronOperator] Browser Address Bar targeted: executing 100% deterministic Ctrl+L shortcut');
          if (env.isWindows) {
            await fastInput.hotkey('ctrl l');
          } else {
            await keyboard.pressKey(Key.LeftControl, Key.L);
            await keyboard.releaseKey(Key.LeftControl, Key.L);
          }
          await sleep(150);
          return { status: StatusEnum.RUNNING };
        }

        // 4. Windows File Replace / Overwrite Confirmation Dialog
        const isReplaceConfirm =
          /\b(?:confirm\s+replacing|replace\s+(?:the\s+)?existing|click(?:ing)?\s+["']?yes["']?|overwrite)\b/i.test(thought);
        if (isReplaceConfirm) {
          logger.info('[NutJSElectronOperator] File replace confirmation dialog detected: executing deterministic "y" / Enter');
          if (env.isWindows) {
            await fastInput.hotkey('y');
            await sleep(80);
            await fastInput.hotkey('enter');
          } else {
            await keyboard.pressKey(Key.Y);
            await keyboard.releaseKey(Key.Y);
            await sleep(80);
            await keyboard.pressKey(Key.Enter);
            await keyboard.releaseKey(Key.Enter);
          }
          await sleep(150);
          return { status: StatusEnum.RUNNING };
        }
      }

      if (
        action_type === 'click' ||
        action_type === 'left_click' ||
        action_type === 'left_single'
      ) {
        // Intercept fragile Start Menu / Taskbar app clicks and launch 100% deterministically via Win+R
        const isStartMenuAppLaunch =
          /\b(?:start menu|pinned|taskbar|search)\b/i.test(thought) &&
          /\b(?:click|open|launch|select)\s+(?:on\s+)?(excel|word|powerpoint|notepad|calc|brave|chrome|paint|mspaint)\b/i.test(thought);

        if (isStartMenuAppLaunch) {
          const match = thought.match(/\b(?:click|open|launch|select)\s+(?:on\s+)?(excel|word|powerpoint|notepad|calc|brave|chrome|paint|mspaint)\b/i);
          const app = match ? match[1].toLowerCase() : '';
          const cmdMap: Record<string, string> = {
            excel: 'excel',
            word: 'winword',
            powerpoint: 'powerpnt',
            notepad: 'notepad',
            calc: 'calc',
            brave: 'brave',
            chrome: 'chrome',
            paint: 'mspaint',
            mspaint: 'mspaint',
          };
          const execCmd = cmdMap[app] || app;
          logger.info(`[NutJSElectronOperator] Intercepted Start Menu click for "${app}", launching deterministically via Win+R -> ${execCmd}`);
          if (env.isWindows) {
            await fastInput.hotkey('esc'); // Dismiss start menu
            await sleep(150);
            await fastInput.hotkey('win r');
            await sleep(250);
            await fastInput.type(execCmd + '\n');
            await sleep(800);
            await fastInput.maximize();
            return { status: StatusEnum.RUNNING };
          }
        }

        if (startPhysX !== null && startPhysY !== null) {
          // Tier-1 Native Element Snapping: If thought or prediction specifies a target element, snap directly to its native physical center
          if (env.isWindows && semanticHint) {
            try {
              const nativeEl = await fastInput.findElement(semanticHint, { timeoutMs: 120 });
              if (nativeEl && nativeEl.centerX > 0 && nativeEl.centerY > 0) {
                logger.info(
                  `[NutJSElectronOperator] 🎯 Tier-1 UIA Snapping: Replaced drifted coords (${startPhysX}, ${startPhysY}) with exact native center (${nativeEl.centerX}, ${nativeEl.centerY}) for "${nativeEl.name}"`,
                );
                startPhysX = nativeEl.centerX;
                startPhysY = nativeEl.centerY;
                startX = Math.round(startPhysX / effectiveScale);
                startY = Math.round(startPhysY / effectiveScale);
              }
            } catch {}
          }

          const pWidth = params.screenWidth || logicalWidth;
          const pHeight = params.screenHeight || logicalHeight;
          const normX = startPhysX / pWidth;
          const normY = startPhysY / pHeight;

          // MS Paint Eyedropper Trap Interceptor:
          // In Windows 11 MS Paint, [200, 150] is the Color Picker / Eyedropper tool.
          // If the model intends to select brush/pencil or draw, clicking [200, 150] stops drawing by sampling colors.
          const isPaintEyedropperTrap =
            /\b(?:brush|pencil|pen|draw|stickman)\b/i.test(thought) &&
            normX >= 0.17 && normX <= 0.23 && normY >= 0.12 && normY <= 0.18;
          if (isPaintEyedropperTrap) {
            logger.warn(
              `[NutJSElectronOperator] MS Paint Eyedropper Trap Intercepted: model clicked [${(normX * 1000).toFixed(0)}, ${(normY * 1000).toFixed(0)}] intending to select brush/draw. Redirecting to Brushes dropdown [280, 115]!`,
            );
            startPhysX = Math.round(0.28 * pWidth);
            startPhysY = Math.round(0.115 * pHeight);
            startX = Math.round(startPhysX / effectiveScale);
            startY = Math.round(startPhysY / effectiveScale);
          }

          // Oscillating click loop detector (tracks recent clicks to catch A -> B -> A -> B cycling)
          NutJSElectronOperator.recentClicks.push({ physX: startPhysX, physY: startPhysY, timestamp: Date.now() });
          if (NutJSElectronOperator.recentClicks.length > 6) {
            NutJSElectronOperator.recentClicks.shift();
          }
          if (NutJSElectronOperator.recentClicks.length >= 4) {
            const rc = NutJSElectronOperator.recentClicks;
            const c0 = rc[rc.length - 4];
            const c1 = rc[rc.length - 3];
            const c2 = rc[rc.length - 2];
            const c3 = rc[rc.length - 1];
            const isOscillating =
              Math.hypot(c0.physX - c2.physX, c0.physY - c2.physY) < 40 &&
              Math.hypot(c1.physX - c3.physX, c1.physY - c3.physY) < 40;
            if (isOscillating) {
              logger.warn(
                `[NutJSElectronOperator] Oscillating click loop detected (A-B-A-B cycle in toolbar). Breaking loop with Esc key recovery!`,
              );
              if (env.isWindows) {
                await fastInput.hotkey('esc');
                await sleep(250);
              }
              NutJSElectronOperator.recentClicks = [];
              NutJSElectronOperator.lastClickRecord = { physX: -1, physY: -1, count: 0, lastThought: '' };
              return { status: StatusEnum.RUNNING };
            }
          }

          // Repetitive click loop detector
          const dist = Math.hypot(
            startPhysX - NutJSElectronOperator.lastClickRecord.physX,
            startPhysY - NutJSElectronOperator.lastClickRecord.physY,
          );
          if (dist < 60) {
            NutJSElectronOperator.lastClickRecord.count++;
          } else {
            NutJSElectronOperator.lastClickRecord = { physX: startPhysX, physY: startPhysY, count: 1, lastThought: thought };
          }

          // Thought-Action Desynchronization Interceptor:
          // If thought mentions typing/searching for a query (e.g. "Swarna/Aurum"), but model emitted a repetitive click
          const typeMatch =
            thought.match(/\b(?:type|search\s+for|enter|input)\s+["']([^"']{1,50}?)["']/i) ||
            thought.match(/\b(?:type|search\s+for|enter)\s+([a-zA-Z0-9_-]{2,30})\s+(?:in|into|on)\s+(?:the\s+)?(?:search|input|box|bar|field|chat|message)/i);

          if (typeMatch && typeMatch[1] && NutJSElectronOperator.lastClickRecord.count >= 2) {
            let targetText = typeMatch[1].trim();
            if (targetText.includes('/')) {
              targetText = targetText.split('/')[0].trim();
            }
            logger.warn(
              `[NutJSElectronOperator] Thought-Action Mismatch Interceptor: detected typing intent "${targetText}" during repetitive click (${NutJSElectronOperator.lastClickRecord.count}x). Auto-typing query to break cognitive loop!`,
            );
            if (env.isWindows) {
              await fastInput.type(targetText + '\n');
              await sleep(350);
            } else {
              await keyboard.type(targetText + '\n');
              await sleep(350);
            }
            NutJSElectronOperator.lastClickRecord = { physX: -1, physY: -1, count: 0, lastThought: '' };
            return { status: StatusEnum.RUNNING };
          }

          if (NutJSElectronOperator.lastClickRecord.count >= 3) {
            logger.warn(
              `[NutJSElectronOperator] Repetitive click loop detected (${NutJSElectronOperator.lastClickRecord.count} clicks near ${startPhysX},${startPhysY}). Breaking loop with Esc key recovery.`,
            );
            if (env.isWindows) {
              await fastInput.hotkey('esc');
              await sleep(250);
            }
            NutJSElectronOperator.lastClickRecord.count = 0;
            return { status: StatusEnum.RUNNING };
          }

          logger.info(`[NutJSElectronOperator] Exact coordinate click: physical (${startPhysX}, ${startPhysY}), logical (${startX}, ${startY}), hint: ${semanticHint || 'none'}`);
          if (env.isWindows) {
            const ok = await fastInput.smoothClick(startX!, startY!, semanticHint, startPhysX, startPhysY);
            if (!ok) {
              await mouse.setPosition(new Point(Math.round(startX!), Math.round(startY!)));
              await sleep(50);
              await mouse.click(Button.LEFT);
            }
          } else {
            await mouse.setPosition(new Point(Math.round(startX!), Math.round(startY!)));
            await sleep(50);
            await mouse.click(Button.LEFT);
          }
        }
        return { status: StatusEnum.RUNNING };
      } else {
        // Reset repeated click counter for non-click actions
        NutJSElectronOperator.lastClickRecord = { physX: -1, physY: -1, count: 0 };
      }

      if (action_type === 'left_double' || action_type === 'double_click') {
        if (startPhysX !== null && startPhysY !== null) {
          logger.info(`[NutJSElectronOperator] smoothDoubleClick physical (${startPhysX}, ${startPhysY}), hint: ${semanticHint || 'none'}`);
          if (env.isWindows) {
            const ok = await fastInput.smoothDoubleClick(startX!, startY!, semanticHint, startPhysX, startPhysY);
            if (!ok) {
              await mouse.setPosition(new Point(Math.round(startX!), Math.round(startY!)));
              await sleep(50);
              await mouse.doubleClick(Button.LEFT);
            }
          } else {
            await mouse.setPosition(new Point(Math.round(startX!), Math.round(startY!)));
            await sleep(50);
            await mouse.doubleClick(Button.LEFT);
          }
        }
        return { status: StatusEnum.RUNNING };
      }

      if (action_type === 'right_click' || action_type === 'right_single') {
        if (startPhysX !== null && startPhysY !== null) {
          logger.info(`[NutJSElectronOperator] smoothRightClick physical (${startPhysX}, ${startPhysY}), hint: ${semanticHint || 'none'}`);
          if (env.isWindows) {
            const ok = await fastInput.smoothRightClick(startX!, startY!, semanticHint, startPhysX, startPhysY);
            if (!ok) {
              await mouse.setPosition(new Point(Math.round(startX!), Math.round(startY!)));
              await sleep(50);
              await mouse.click(Button.RIGHT);
            }
          } else {
            await mouse.setPosition(new Point(Math.round(startX!), Math.round(startY!)));
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
          // Drawing micro-drag expander: scale up tiny <30px drags if user is drawing shapes/figures
          const pWidth = params.screenWidth || logicalWidth;
          const curPhysX1 = startPhysX ?? Math.round(startX * (pWidth / logicalWidth));
          const curPhysY1 = startPhysY ?? Math.round(startY * ((params.screenHeight || logicalHeight) / logicalHeight));
          const curPhysX2 = endPhysX ?? Math.round(endX * (pWidth / logicalWidth));
          const curPhysY2 = endPhysY ?? Math.round(endY * ((params.screenHeight || logicalHeight) / logicalHeight));
          const dragDistPhys = Math.hypot(curPhysX2 - curPhysX1, curPhysY2 - curPhysY1);
          const minDrawingDist = Math.round(pWidth * 0.045); // ~4.5% screen width (approx 45 units in 1000-space)

          if (dragDistPhys < minDrawingDist && /\b(?:draw|stickman|body|leg|arm|head|gun|line|stroke)\b/i.test(thought)) {
            const mult = minDrawingDist / Math.max(dragDistPhys, 1);
            endPhysX = Math.round(curPhysX1 + (curPhysX2 - curPhysX1) * mult);
            endPhysY = Math.round(curPhysY1 + (curPhysY2 - curPhysY1) * mult);
            endX = Math.round(endPhysX / effectiveScale);
            endY = Math.round(endPhysY / effectiveScale);
            logger.info(
              `[NutJSElectronOperator] Scaled micro-drag (${dragDistPhys.toFixed(0)}px) to visible drawing stroke (${minDrawingDist}px)`,
            );
          }

          logger.info(`[NutJSElectronOperator] smoothDrag physical (${startPhysX}, ${startPhysY}) -> (${endPhysX}, ${endPhysY})`);
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
            await fastInput.move(startX, startY, startPhysX || undefined, startPhysY || undefined);
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

        // Clean leading slash artifact if model used hotkey('/') previously or prefixed search query with '/'
        if (content.startsWith('/') && !content.startsWith('//') && !/^\/(?:etc|home|usr|var|tmp|bin|opt)\b/i.test(content)) {
          const isSearchOrPresentation = !content.includes('\\') && (/\b(search|query|presentation|canva|find|template)\b/i.test(thought) || !content.slice(1).includes('/'));
          if (isSearchOrPresentation) {
            logger.info(`[NutJSElectronOperator] Stripped accidental leading '/' prefix from query: "${content}" -> "${content.replace(/^\/+/, '')}"`);
            content = content.replace(/^\/+/, '');
          }
        }

        const pressEnterAtEnd = content.endsWith('\n');
        if (pressEnterAtEnd) {
          content = content.replace(/\n+$/, '');
        }

        if (content.length > 0) {
          // Track repeated type calls for loop detection
          if (NutJSElectronOperator.lastTypeRecord.content === content) {
            NutJSElectronOperator.lastTypeRecord.count++;
          } else {
            NutJSElectronOperator.lastTypeRecord = { content, count: 1 };
          }

          // Suppress redundant duplicate typing of identical multiline document or table blocks (only multiline blocks > 50 chars)
          if (
            NutJSElectronOperator.lastTypeRecord.count >= 5 &&
            content.includes('\n') &&
            content.length > 50
          ) {
            logger.warn(
              `[NutJSElectronOperator] Redundant duplicate multiline typing suppressed (${NutJSElectronOperator.lastTypeRecord.count}x). Content already present.`,
            );
            return { status: StatusEnum.RUNNING };
          }

          // Desktop Save As Auto-Resolution & Sanitization:
          const isSaveIntent = /\b(?:save|saving|export)\b/i.test(thought);
          const isFilenameOrPath =
            /\.(?:xlsx|docx|pptx|csv|txt|md|json|png|pdf)\b/i.test(content) ||
            /^[a-zA-Z0-9_\s-]+\.[a-zA-Z0-9]{2,4}$/i.test(content.trim());

          if (isSaveIntent && isFilenameOrPath) {
            // Expand environment variables if model attempted %USERPROFILE% etc.
            content = content.replace(
              /%([^%]+)%/g,
              (_, name) => process.env[name] || '',
            );
            // Normalize double backslashes
            content = content.replace(/\\\\+/g, '\\');

            const currentInstructions =
              (store.getState() as any)?.instructions || '';
            if (/\b(?:desktop|desk)\b/i.test(currentInstructions)) {
              const cleanFilename = path.basename(
                content.trim().replace(/^["']|["']$/g, ''),
              );
              const realDesktop = fs.existsSync(
                path.join(os.homedir(), 'OneDrive', 'Desktop'),
              )
                ? path.join(os.homedir(), 'OneDrive', 'Desktop')
                : path.join(os.homedir(), 'Desktop');
              const fullSavePath = path.join(realDesktop, cleanFilename);
              logger.info(
                `[NutJSElectronOperator] Auto-resolving desktop save path: "${content}" -> "${fullSavePath}"`,
              );
              content = fullSavePath;
            }

            // In Save As dialogs, always select all to replace any existing or default text
            if (env.isWindows) {
              await fastInput.hotkey('ctrl a');
              await sleep(40);
            }
          }

          const trimmed = content.trim().toLowerCase();
          const isExcelOrDesktopIntent =
            /\b(?:excel|sheet|cell|row|column|calc|worksheet|spreadsheet|table|notepad|word|powerpoint)\b/i.test(thought) ||
            content.includes('\t') ||
            (content.includes('\n') && !content.startsWith('http'));

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
          } else {
            // No coordinates provided with type action!

            const isWebUrlOrDomain =
              !isExcelOrDesktopIntent &&
              (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|org|net|io|edu|gov|co|in|ai|app|dev|xyz|me)\b/i.test(trimmed) ||
              /^https?:\/\//i.test(trimmed));

            const isBrowserNavIntent =
              !isExcelOrDesktopIntent &&
              (/\b(address bar|url|omnibox|navigate|browse|go to)\b/i.test(thought) ||
              /\b(canva|google|youtube|github|wikipedia)\b/i.test(trimmed));

            const isStuckBrowserTypeLoop =
              !isExcelOrDesktopIntent &&
              (isWebUrlOrDomain || isBrowserNavIntent) &&
              NutJSElectronOperator.lastTypeRecord.count >= 2;

            if (isWebUrlOrDomain || isBrowserNavIntent || isStuckBrowserTypeLoop) {
              logger.info(`[NutJSElectronOperator] Browser navigation/recovery auto-focusing address bar with ctrl+l (repeat count: ${NutJSElectronOperator.lastTypeRecord.count})`);
              if (env.isWindows) {
                await fastInput.hotkey('ctrl l');
              } else {
                await keyboard.pressKey(Key.LeftControl, Key.L);
                await keyboard.releaseKey(Key.LeftControl, Key.L);
              }
              await sleep(150);
            } else if (isExcelOrDesktopIntent && NutJSElectronOperator.lastTypeRecord.count >= 2) {
              logger.info(`[NutJSElectronOperator] Excel/Desktop stuck type loop recovery: sending esc to exit stuck edit/point mode`);
              if (env.isWindows) {
                await fastInput.hotkey('esc');
              } else {
                await keyboard.pressKey(Key.Escape);
                await keyboard.releaseKey(Key.Escape);
              }
              await sleep(100);
            }
          }

          // Sanitize any LLM placeholder ellipsis lines (e.g. "... (continue pattern up to 200 employees)")
          content = content.replace(/^\s*\.\.\.\s*\(.*?\)\s*$/gm, '').trimEnd();

          logger.info('[NutJSElectronOperator] type length:', content.length, 'pressEnter:', pressEnterAtEnd);
          if (env.isWindows) {
            let ok = false;
            if (content.includes('\n') || content.includes('\t') || content.length > 50) {
              if (content.includes('\t')) {
                const firstLine = content.split('\n')[0] || '';
                const tabCount = (firstLine.match(/\t/g) || []).length;
                if (tabCount > 0) {
                  NutJSElectronOperator.lastTableColCount = tabCount + 1;
                }
                // In spreadsheets, pressing Esc before pasting ensures the cell is NOT in active text edit mode
                // so TSV data populates cells cleanly across rows and columns without cursor jumping
                if (isExcelOrDesktopIntent) {
                  await fastInput.hotkey('esc');
                  await sleep(50);
                }
              }
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
            const isLikelyAppLaunch = NutJSElectronOperator.lastWasWinKey || 
                                      /^(brave|chrome|excel|powerpoint|notepad|winword|word|calc|msedge|firefox)\b/i.test(content.trim());
            if (pressEnterAtEnd) {
              const settleBeforeEnter = isLikelyAppLaunch ? 650 : 80;
              await sleep(settleBeforeEnter);
              await fastInput.hotkey('enter');
              if (env.isWindows && isLikelyAppLaunch) {
                logger.info(`[NutJSElectronOperator] App launch detected ("${content}"), settling for window initialization & auto-maximize`);
                await sleep(900);
                await fastInput.maximize();
                await sleep(400);
              } else {
                await sleep(200);
              }
              NutJSElectronOperator.lastWasWinKey = false;
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
            if (NutJSElectronOperator.lastWasWinKey) {
              logger.info(`[NutJSElectronOperator] Enter pressed after Win key, executing deterministic auto-maximize`);
              await sleep(500);
              await fastInput.maximize();
              await sleep(300);
            }
            NutJSElectronOperator.lastWasWinKey = false;
          } else {
            await keyboard.pressKey(Key.Enter);
            await keyboard.releaseKey(Key.Enter);
          }
        }
        return { status: StatusEnum.RUNNING };
      }

      if (action_type === 'hotkey' || action_type === 'press' || action_type === 'key_press') {
        const rawKeyStr = (action_inputs?.key || action_inputs?.hotkey || action_inputs?.content || '').toString().trim();
        logger.info('[NutJSElectronOperator] hotkey/press raw:', rawKeyStr);

        // Immediate bulletproof intercept for Win+Up maximize (bypasses ALL regexes and NEVER touches Win key)
        const rawLower = rawKeyStr.toLowerCase();
        if (
          (/\b(?:win|windows|super)\b/i.test(rawLower) && /\bup\b/i.test(rawLower)) ||
          rawLower.replace(/[\s\-_+]/g, '') === 'winup'
        ) {
          logger.info('[NutJSElectronOperator] Intercepted win+up hotkey, executing direct native maximize');
          if (env.isWindows) {
            await fastInput.maximize();
            await sleep(250);
          }
          return { status: StatusEnum.RUNNING };
        }

        let keyStr = rawKeyStr;
        if (keyStr) {
          // Extract valid key sequence if model hallucinated trailing garbage (e.g. "(\n) (ctrl a')\n2. type)" -> "ctrl a")
          const clean = keyStr.replace(/['"\\()]/g, ' ').trim();
          const match = clean.match(
            /\b(ctrl|alt|shift|win|windows|enter|return|esc|escape|tab|space|backspace|delete|del|up|down|left|right|home|end|pageup|pagedown|f\d+|[a-z0-9])(?:\s*[\s\-_+]\s*(?:[a-z0-9]+|f\d+|enter|esc|tab|space|delete|del|backspace|up|down|left|right|home|end|pageup|pagedown))*\b/i,
          );
          if (match) {
            keyStr = match[0];
          }
        }
        logger.info('[NutJSElectronOperator] hotkey/press sanitized:', keyStr);
        const normKey = (keyStr || '').toLowerCase().replace(/[\s\-_+]/g, '');
        if (normKey === 'win' || normKey === 'super' || normKey === 'windows') {
          NutJSElectronOperator.lastWasWinKey = true;
        } else {
          NutJSElectronOperator.lastWasWinKey = false;
        }
        if (normKey === 'altf4') {
          logger.warn('[NutJSElectronOperator] blocked alt+f4 to preserve user session and IDE');
          return { status: StatusEnum.RUNNING };
        }

        // Repetitive hotkey loop detector & cognitive unfreeze circuit breaker
        if (normKey && normKey === NutJSElectronOperator.lastHotkeyRecord.key) {
          NutJSElectronOperator.lastHotkeyRecord.count++;
        } else {
          NutJSElectronOperator.lastHotkeyRecord = { key: normKey, count: 1 };
        }

        if (NutJSElectronOperator.lastHotkeyRecord.count >= 3) {
          logger.warn(
            `[NutJSElectronOperator] Repetitive hotkey loop detected (${NutJSElectronOperator.lastHotkeyRecord.count}x for '${normKey}'). Intervening to break cognitive freeze.`,
          );
          NutJSElectronOperator.lastHotkeyRecord.count = 0;
          if (normKey === 'ctrlhome') {
            // Excel/Document freeze: model stuck at A1 repeatedly. Send Esc then Down to select data row!
            if (env.isWindows) {
              await fastInput.hotkey('esc');
              await sleep(60);
              await fastInput.hotkey('down');
            }
            return { status: StatusEnum.RUNNING };
          } else {
            if (env.isWindows) {
              await fastInput.hotkey('esc');
              await sleep(100);
            }
            return { status: StatusEnum.RUNNING };
          }
        }
        if (normKey === 'ctrlhome') {
          logger.info('[NutJSElectronOperator] ctrl+home detected: sending esc first to exit any active in-cell/formula edit mode');
          if (env.isWindows) {
            await fastInput.hotkey('esc');
            await sleep(50);
          } else {
            await keyboard.pressKey(Key.Escape);
            await keyboard.releaseKey(Key.Escape);
            await sleep(50);
          }
        }
        if (normKey === 'ctrls') {
          // In Microsoft Excel / Office 365, Ctrl+S summons an in-app cloud flyout modal that traps Desktop agents.
          // F12 deterministically summons the classic Windows Common File Dialog "Save As" directly to Desktop/local disk!
          const isExcelIntent = /\b(?:excel|sheet|workbook|sales|\.xlsx)\b/i.test(thought);
          if (isExcelIntent) {
            logger.info('[NutJSElectronOperator] Excel save detected: remapping ctrl+s to f12 for direct local Save As dialog');
            keyStr = 'f12';
          }
        }
        if (env.isWindows && keyStr) {
          const ok = await fastInput.hotkey(keyStr);
          if (ok) {
            await sleep(100);
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
