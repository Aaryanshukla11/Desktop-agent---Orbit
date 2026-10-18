import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { screen } from 'electron';
import { logger } from '../logger';

export class FastInputManager {
  private static instance: FastInputManager | null = null;
  private process: ChildProcess | null = null;
  private isReady = false;
  private responseWaiters: Array<(res: string) => void> = [];

  static getInstance(): FastInputManager {
    if (!FastInputManager.instance) {
      FastInputManager.instance = new FastInputManager();
    }
    return FastInputManager.instance;
  }

  private constructor() {
    this.initProcess();
  }

  private initProcess() {
    if (process.platform !== 'win32') return;

    try {
      const candidatePaths = [
        path.resolve(process.cwd(), 'apps/ui-tars/resources/FastInputServer.exe'),
        path.resolve(process.cwd(), 'resources/FastInputServer.exe'),
        path.resolve(process.cwd(), 'scripts/FastInputServer.exe'),
        path.resolve(process.cwd(), 'FastInputServer.exe'),
        path.resolve(__dirname, '../../resources/FastInputServer.exe'),
        path.resolve(__dirname, '../../../resources/FastInputServer.exe'),
        path.resolve(__dirname, '../resources/FastInputServer.exe'),
      ];

      const exePath = candidatePaths.find((p) => fs.existsSync(p));
      if (!exePath) {
        logger.warn('[FastInputManager] FastInputServer.exe not found');
        return;
      }

      logger.info('[FastInputManager] Spawning FastInputServer:', exePath);
      this.process = spawn(exePath, [], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf8');
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        for (const line of lines) {
          if (line.trim() === 'READY') {
            this.isReady = true;
            logger.info('[FastInputManager] FastInputServer is READY (1ms latency)');
          } else {
            const waiter = this.responseWaiters.shift();
            if (waiter) waiter(line.trim());
          }
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        logger.warn('[FastInputManager] stderr:', data.toString('utf8'));
      });

      this.process.on('exit', (code) => {
        logger.warn('[FastInputManager] Server exited with code', code);
        this.process = null;
        this.isReady = false;
      });
    } catch (e) {
      logger.error('[FastInputManager] Failed to init FastInputServer:', e);
    }
  }

  public async queryCommand(cmd: string, timeoutMs = 250): Promise<string> {
    if (!this.process || !this.process.stdin || this.process.killed) {
      this.initProcess();
      // Wait up to 250ms for ready
      let waited = 0;
      while (!this.isReady && waited < 250) {
        await new Promise((r) => setTimeout(r, 25));
        waited += 25;
      }
    }

    if (!this.process || !this.process.stdin) {
      logger.warn('[FastInputManager] FastInputServer not available, returning empty');
      return '';
    }

    return new Promise((resolve) => {
      let waiter: (res: string) => void;
      const timeout = setTimeout(() => {
        const idx = this.responseWaiters.indexOf(waiter);
        if (idx !== -1) this.responseWaiters.splice(idx, 1);
        resolve('');
      }, timeoutMs);

      waiter = (res: string) => {
        clearTimeout(timeout);
        resolve(res);
      };

      this.responseWaiters.push(waiter);
      try {
        this.process!.stdin!.write(cmd.trim() + '\n');
      } catch (err) {
        clearTimeout(timeout);
        const idx = this.responseWaiters.indexOf(waiter);
        if (idx !== -1) this.responseWaiters.splice(idx, 1);
        resolve('');
      }
    });
  }

  public async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs = 250,
    fallback: T,
  ): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), timeoutMs);
    });
    return Promise.race([
      promise.then((res) => {
        clearTimeout(timer);
        return res;
      }),
      timeoutPromise,
    ]);
  }

  public async sendCommand(cmd: string, timeoutMs = 1000): Promise<boolean> {
    const res = await this.queryCommand(cmd, timeoutMs);
    return res.startsWith('OK');
  }

  public async getCursorPos(): Promise<{ physX: number; physY: number } | null> {
    const res = await this.queryCommand('getpos');
    const match = res.match(/POS\s+(-?\d+)\s+(-?\d+)/);
    if (match) {
      return {
        physX: parseInt(match[1], 10),
        physY: parseInt(match[2], 10),
      };
    }
    return null;
  }

  private getScaleFactor(): number {
    try {
      return screen.getPrimaryDisplay()?.scaleFactor || 1;
    } catch {
      return 1;
    }
  }

  public async humanGlide(targetPhysX: number, targetPhysY: number): Promise<void> {
    try {
      const curPos = await this.getCursorPos();
      let startPhysX = targetPhysX;
      let startPhysY = targetPhysY;
      if (curPos) {
        startPhysX = curPos.physX;
        startPhysY = curPos.physY;
      } else {
        const scale = this.getScaleFactor();
        const start = screen.getCursorScreenPoint();
        startPhysX = Math.round(start.x * scale);
        startPhysY = Math.round(start.y * scale);
      }
      const dx = targetPhysX - startPhysX;
      const dy = targetPhysY - startPhysY;
      const distance = Math.hypot(dx, dy);

      if (distance < 20) {
        await this.move(targetPhysX, targetPhysY, targetPhysX, targetPhysY);
        return;
      }

      // Smooth micro-glide: 3 rapid awaited steps (~25ms total) in exact physical pixels
      const steps = 3;
      for (let i = 1; i < steps; i++) {
        const progress = i / steps;
        const t = 1 - Math.pow(1 - progress, 2.0);
        const curX = Math.round(startPhysX + dx * t);
        const curY = Math.round(startPhysY + dy * t);
        await this.move(curX, curY, curX, curY);
      }
      await this.move(targetPhysX, targetPhysY, targetPhysX, targetPhysY);
    } catch (e) {
      await this.move(targetPhysX, targetPhysY, targetPhysX, targetPhysY);
    }
  }

  public async smoothClick(
    x: number,
    y: number,
    hint?: string,
    physX?: number,
    physY?: number,
  ): Promise<boolean> {
    const targetPhysX = physX !== undefined ? Math.round(physX) : Math.round(x * this.getScaleFactor());
    const targetPhysY = physY !== undefined ? Math.round(physY) : Math.round(y * this.getScaleFactor());
    await this.humanGlide(targetPhysX, targetPhysY);
    return this.click(targetPhysX, targetPhysY, hint, targetPhysX, targetPhysY);
  }

  public async smoothDoubleClick(
    x: number,
    y: number,
    hint?: string,
    physX?: number,
    physY?: number,
  ): Promise<boolean> {
    const targetPhysX = physX !== undefined ? Math.round(physX) : Math.round(x * this.getScaleFactor());
    const targetPhysY = physY !== undefined ? Math.round(physY) : Math.round(y * this.getScaleFactor());
    await this.humanGlide(targetPhysX, targetPhysY);
    return this.doubleClick(targetPhysX, targetPhysY, hint, targetPhysX, targetPhysY);
  }

  public async smoothRightClick(
    x: number,
    y: number,
    hint?: string,
    physX?: number,
    physY?: number,
  ): Promise<boolean> {
    const targetPhysX = physX !== undefined ? Math.round(physX) : Math.round(x * this.getScaleFactor());
    const targetPhysY = physY !== undefined ? Math.round(physY) : Math.round(y * this.getScaleFactor());
    await this.humanGlide(targetPhysX, targetPhysY);
    return this.rightClick(targetPhysX, targetPhysY, hint, targetPhysX, targetPhysY);
  }

  public async smoothDrag(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    physX1?: number,
    physY1?: number,
    physX2?: number,
    physY2?: number,
  ): Promise<boolean> {
    const scale = this.getScaleFactor();
    const targetPhysX1 = physX1 !== undefined ? Math.round(physX1) : Math.round(x1 * scale);
    const targetPhysY1 = physY1 !== undefined ? Math.round(physY1) : Math.round(y1 * scale);
    const targetPhysX2 = physX2 !== undefined ? Math.round(physX2) : Math.round(x2 * scale);
    const targetPhysY2 = physY2 !== undefined ? Math.round(physY2) : Math.round(y2 * scale);
    await this.humanGlide(targetPhysX1, targetPhysY1);
    return this.drag(targetPhysX1, targetPhysY1, targetPhysX2, targetPhysY2, targetPhysX1, targetPhysY1, targetPhysX2, targetPhysY2);
  }

  public async click(
    x: number,
    y: number,
    hint?: string,
    physX?: number,
    physY?: number,
  ): Promise<boolean> {
    const scale = this.getScaleFactor();
    const targetPhysX = physX !== undefined ? Math.round(physX) : Math.round(x * scale);
    const targetPhysY = physY !== undefined ? Math.round(physY) : Math.round(y * scale);
    const cleanHint = hint ? hint.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '') : '';
    return this.sendCommand(`click ${targetPhysX} ${targetPhysY}${cleanHint ? ' ' + cleanHint : ''}`);
  }

  public async doubleClick(
    x: number,
    y: number,
    hint?: string,
    physX?: number,
    physY?: number,
  ): Promise<boolean> {
    const scale = this.getScaleFactor();
    const targetPhysX = physX !== undefined ? Math.round(physX) : Math.round(x * scale);
    const targetPhysY = physY !== undefined ? Math.round(physY) : Math.round(y * scale);
    const cleanHint = hint ? hint.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '') : '';
    return this.sendCommand(`doubleclick ${targetPhysX} ${targetPhysY}${cleanHint ? ' ' + cleanHint : ''}`);
  }

  public async rightClick(
    x: number,
    y: number,
    hint?: string,
    physX?: number,
    physY?: number,
  ): Promise<boolean> {
    const scale = this.getScaleFactor();
    const targetPhysX = physX !== undefined ? Math.round(physX) : Math.round(x * scale);
    const targetPhysY = physY !== undefined ? Math.round(physY) : Math.round(y * scale);
    const cleanHint = hint ? hint.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '') : '';
    return this.sendCommand(`rightclick ${targetPhysX} ${targetPhysY}${cleanHint ? ' ' + cleanHint : ''}`);
  }

  public async move(x: number, y: number, physX?: number, physY?: number): Promise<boolean> {
    const scale = this.getScaleFactor();
    const targetPhysX = physX !== undefined ? Math.round(physX) : Math.round(x * scale);
    const targetPhysY = physY !== undefined ? Math.round(physY) : Math.round(y * scale);
    return this.sendCommand(`move ${targetPhysX} ${targetPhysY}`);
  }

  public async drag(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    physX1?: number,
    physY1?: number,
    physX2?: number,
    physY2?: number,
  ): Promise<boolean> {
    const scale = this.getScaleFactor();
    const targetPhysX1 = physX1 !== undefined ? Math.round(physX1) : Math.round(x1 * scale);
    const targetPhysY1 = physY1 !== undefined ? Math.round(physY1) : Math.round(y1 * scale);
    const targetPhysX2 = physX2 !== undefined ? Math.round(physX2) : Math.round(x2 * scale);
    const targetPhysY2 = physY2 !== undefined ? Math.round(physY2) : Math.round(y2 * scale);
    return this.sendCommand(`drag ${targetPhysX1} ${targetPhysY1} ${targetPhysX2} ${targetPhysY2}`);
  }

  public async hotkey(keyStr: string): Promise<boolean> {
    return this.sendCommand(`hotkey ${keyStr}`);
  }

  public async type(text: string): Promise<boolean> {
    const b64 = Buffer.from(text, 'utf8').toString('base64');
    return this.sendCommand(`type_b64 ${b64}`);
  }

  public async paste(text: string): Promise<boolean> {
    const b64 = Buffer.from(text, 'utf8').toString('base64');
    return this.sendCommand(`paste_b64 ${b64}`);
  }

  public async setClipboard(text: string): Promise<boolean> {
    const b64 = Buffer.from(text, 'utf8').toString('base64');
    return this.sendCommand(`paste_b64 ${b64}`);
  }

  public async minimizeAll(): Promise<boolean> {
    return this.sendCommand('minimize_all');
  }

  public async maximize(): Promise<boolean> {
    return this.sendCommand('maximize');
  }

  public async captureScreenshot(filePath: string): Promise<boolean> {
    return this.sendCommand(`screenshot ${filePath}`);
  }

  public async getActiveWindow(): Promise<WindowInfo | null> {
    const res = await this.queryCommand('active_window');
    if (!res || !res.startsWith('ACTIVE_WINDOW')) return null;

    try {
      const hwndMatch = res.match(/hwnd:(\d+)/);
      const procMatch = res.match(/proc:([^\s]+)/);
      const rectMatch = res.match(/rect:(-?\d+),(-?\d+),(-?\d+),(-?\d+)/);
      const titleMatch = res.match(/title:"(.*)"/);

      return {
        hwnd: hwndMatch ? parseInt(hwndMatch[1], 10) : 0,
        process: procMatch ? procMatch[1] : '',
        title: titleMatch ? titleMatch[1] : '',
        rect: rectMatch
          ? {
              x: parseInt(rectMatch[1], 10),
              y: parseInt(rectMatch[2], 10),
              width: parseInt(rectMatch[3], 10),
              height: parseInt(rectMatch[4], 10),
            }
          : { x: 0, y: 0, width: 0, height: 0 },
      };
    } catch {
      return null;
    }
  }

  public async getActiveApp(): Promise<ActiveAppInfo | null> {
    const win = await this.getActiveWindow();
    if (!win || !win.process) return null;

    const rawProc = win.process.trim();
    const baseName = rawProc.replace(/\.exe$/i, '').toLowerCase();
    const processName = baseName ? `${baseName}.exe` : rawProc;

    const isNativeAccessible = NATIVE_ACCESSIBLE_APPS.has(baseName);
    const category = APP_CATEGORIES[baseName] || (isNativeAccessible ? 'system' : 'unknown');

    return {
      processName,
      baseName,
      title: win.title,
      hwnd: win.hwnd,
      rect: win.rect,
      isNativeAccessible,
      category,
    };
  }

  public async isAppForeground(targetName: string): Promise<boolean> {
    const app = await this.getActiveApp();
    if (!app) return false;
    const cleanTarget = targetName.replace(/\.exe$/i, '').toLowerCase();
    return app.baseName === cleanTarget || app.title.toLowerCase().includes(cleanTarget);
  }

  public async focusWindow(filter: string): Promise<WindowInfo | null> {
    const res = await this.queryCommand(`focus_window ${filter}`);
    if (!res || !res.startsWith('FOCUSED')) return null;

    try {
      const hwndMatch = res.match(/hwnd:(\d+)/);
      const procMatch = res.match(/proc:([^\s]+)/);
      const rectMatch = res.match(/rect:(-?\d+),(-?\d+),(-?\d+),(-?\d+)/);
      const titleMatch = res.match(/title:"(.*)"/);

      return {
        hwnd: hwndMatch ? parseInt(hwndMatch[1], 10) : 0,
        process: procMatch ? procMatch[1] : '',
        title: titleMatch ? titleMatch[1] : '',
        rect: rectMatch
          ? {
              x: parseInt(rectMatch[1], 10),
              y: parseInt(rectMatch[2], 10),
              width: parseInt(rectMatch[3], 10),
              height: parseInt(rectMatch[4], 10),
            }
          : { x: 0, y: 0, width: 0, height: 0 },
      };
    } catch {
      return null;
    }
  }

  public async listWindows(): Promise<WindowItem[]> {
    const res = await this.queryCommand('list_windows');
    if (!res || !res.startsWith('WINDOW_LIST ')) return [];
    try {
      const jsonStr = res.substring('WINDOW_LIST '.length).trim();
      const rawList = JSON.parse(jsonStr) as Array<{
        hwnd: number;
        pid: number;
        proc: string;
        state: 'normal' | 'maximized' | 'minimized';
        title: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
      return rawList.map((w) => ({
        hwnd: w.hwnd,
        pid: w.pid,
        proc: w.proc,
        state: w.state,
        title: w.title,
        rect: {
          x: w.x,
          y: w.y,
          width: w.width,
          height: w.height,
        },
      }));
    } catch {
      return [];
    }
  }

  public async getFocusedInfo(): Promise<FocusedInfo | null> {
    const res = await this.queryCommand('get_focused_info');
    if (!res || !res.startsWith('FOCUSED_INFO ')) return null;
    try {
      const jsonStr = res.substring('FOCUSED_INFO '.length).trim();
      const raw = JSON.parse(jsonStr);
      return {
        hwnd: raw.hwnd,
        proc: raw.proc,
        state: raw.state,
        title: raw.title,
        rect: {
          x: raw.x,
          y: raw.y,
          width: raw.width,
          height: raw.height,
        },
        focusedControl: {
          name: raw.focusedName || '',
          type: raw.focusedType || '',
          id: raw.focusedId || '',
        },
      };
    } catch {
      return null;
    }
  }

  public async focusWindowByTitle(titlePattern: string): Promise<WindowInfo | null> {
    return this.focusWindow(titlePattern);
  }

  public async findElement(
    name: string,
    typeOrOptions?: string | { controlType?: string; windowFilter?: string; timeoutMs?: number },
    windowTitle?: string,
  ): Promise<ElementInfo | null> {
    let controlType: string | undefined;
    let windowFilter: string | undefined;
    let timeoutMs = 250;

    if (typeof typeOrOptions === 'object' && typeOrOptions !== null) {
      controlType = typeOrOptions.controlType;
      windowFilter = typeOrOptions.windowFilter;
      if (typeOrOptions.timeoutMs !== undefined) timeoutMs = typeOrOptions.timeoutMs;
    } else if (typeof typeOrOptions === 'string') {
      controlType = typeOrOptions;
      windowFilter = windowTitle;
    } else {
      windowFilter = windowTitle;
    }

    let cmd = 'find_element ';
    if (windowFilter) {
      cmd += `${windowFilter}|${name}|${controlType || ''}`;
    } else if (controlType) {
      cmd += `${name}|${controlType}`;
    } else {
      cmd += name;
    }

    const res = await this.queryCommand(cmd, timeoutMs);
    if (!res || !res.startsWith('FOUND')) return null;

    try {
      const xMatch = res.match(/x:(-?\d+)/);
      const yMatch = res.match(/y:(-?\d+)/);
      const wMatch = res.match(/w:(-?\d+)/);
      const hMatch = res.match(/h:(-?\d+)/);
      const cxMatch = res.match(/cx:(-?\d+)/);
      const cyMatch = res.match(/cy:(-?\d+)/);
      const nameMatch = res.match(/name:"(.*)" type:/);
      const typeMatch = res.match(/type:([^\s]+)/);
      const idMatch = res.match(/id:"(.*)"/);

      return {
        name: nameMatch ? nameMatch[1] : name,
        type: typeMatch ? typeMatch[1] : '',
        id: idMatch ? idMatch[1] : '',
        x: xMatch ? parseInt(xMatch[1], 10) : 0,
        y: yMatch ? parseInt(yMatch[1], 10) : 0,
        width: wMatch ? parseInt(wMatch[1], 10) : 0,
        height: hMatch ? parseInt(hMatch[1], 10) : 0,
        centerX: cxMatch ? parseInt(cxMatch[1], 10) : 0,
        centerY: cyMatch ? parseInt(cyMatch[1], 10) : 0,
      };
    } catch {
      return null;
    }
  }

  public async clickElement(
    name: string,
    typeOrOptions?: string | { controlType?: string; windowFilter?: string; timeoutMs?: number },
    windowTitle?: string,
  ): Promise<ElementInfo | null> {
    let controlType: string | undefined;
    let windowFilter: string | undefined;
    let timeoutMs = 250;

    if (typeof typeOrOptions === 'object' && typeOrOptions !== null) {
      controlType = typeOrOptions.controlType;
      windowFilter = typeOrOptions.windowFilter;
      if (typeOrOptions.timeoutMs !== undefined) timeoutMs = typeOrOptions.timeoutMs;
    } else if (typeof typeOrOptions === 'string') {
      controlType = typeOrOptions;
      windowFilter = windowTitle;
    } else {
      windowFilter = windowTitle;
    }

    let cmd = 'click_element ';
    if (windowFilter) {
      cmd += `${windowFilter}|${name}|${controlType || ''}`;
    } else if (controlType) {
      cmd += `${name}|${controlType}`;
    } else {
      cmd += name;
    }

    const res = await this.queryCommand(cmd, timeoutMs);
    if (!res || !res.startsWith('CLICKED')) return null;

    try {
      const xMatch = res.match(/x:(-?\d+)/);
      const yMatch = res.match(/y:(-?\d+)/);
      const wMatch = res.match(/w:(-?\d+)/);
      const hMatch = res.match(/h:(-?\d+)/);
      const cxMatch = res.match(/cx:(-?\d+)/);
      const cyMatch = res.match(/cy:(-?\d+)/);
      const nameMatch = res.match(/name:"(.*)" type:/);
      const typeMatch = res.match(/type:([^\s]+)/);
      const idMatch = res.match(/id:"(.*)"/);

      return {
        name: nameMatch ? nameMatch[1] : name,
        type: typeMatch ? typeMatch[1] : '',
        id: idMatch ? idMatch[1] : '',
        x: xMatch ? parseInt(xMatch[1], 10) : 0,
        y: yMatch ? parseInt(yMatch[1], 10) : 0,
        width: wMatch ? parseInt(wMatch[1], 10) : 0,
        height: hMatch ? parseInt(hMatch[1], 10) : 0,
        centerX: cxMatch ? parseInt(cxMatch[1], 10) : 0,
        centerY: cyMatch ? parseInt(cyMatch[1], 10) : 0,
      };
    } catch {
      return null;
    }
  }

  public async doubleClickElement(
    name: string,
    typeOrOptions?: string | { controlType?: string; windowFilter?: string; timeoutMs?: number },
    windowTitle?: string,
  ): Promise<ElementInfo | null> {
    let controlType: string | undefined;
    let windowFilter: string | undefined;
    let timeoutMs = 250;

    if (typeof typeOrOptions === 'object' && typeOrOptions !== null) {
      controlType = typeOrOptions.controlType;
      windowFilter = typeOrOptions.windowFilter;
      if (typeOrOptions.timeoutMs !== undefined) timeoutMs = typeOrOptions.timeoutMs;
    } else if (typeof typeOrOptions === 'string') {
      controlType = typeOrOptions;
      windowFilter = windowTitle;
    } else {
      windowFilter = windowTitle;
    }

    let cmd = 'double_click_element ';
    if (windowFilter) {
      cmd += `${windowFilter}|${name}|${controlType || ''}`;
    } else if (controlType) {
      cmd += `${name}|${controlType}`;
    } else {
      cmd += name;
    }

    const res = await this.queryCommand(cmd, timeoutMs);
    if (!res || !res.startsWith('DOUBLE_CLICKED')) return null;

    try {
      const xMatch = res.match(/x:(-?\d+)/);
      const yMatch = res.match(/y:(-?\d+)/);
      const wMatch = res.match(/w:(-?\d+)/);
      const hMatch = res.match(/h:(-?\d+)/);
      const cxMatch = res.match(/cx:(-?\d+)/);
      const cyMatch = res.match(/cy:(-?\d+)/);
      const nameMatch = res.match(/name:"(.*)" type:/);
      const typeMatch = res.match(/type:([^\s]+)/);
      const idMatch = res.match(/id:"(.*)"/);

      return {
        name: nameMatch ? nameMatch[1] : name,
        type: typeMatch ? typeMatch[1] : '',
        id: idMatch ? idMatch[1] : '',
        x: xMatch ? parseInt(xMatch[1], 10) : 0,
        y: yMatch ? parseInt(yMatch[1], 10) : 0,
        width: wMatch ? parseInt(wMatch[1], 10) : 0,
        height: hMatch ? parseInt(hMatch[1], 10) : 0,
        centerX: cxMatch ? parseInt(cxMatch[1], 10) : 0,
        centerY: cyMatch ? parseInt(cyMatch[1], 10) : 0,
      };
    } catch {
      return null;
    }
  }

  public async setElementText(
    name: string,
    text: string,
    typeOrOptions?: string | { controlType?: string; windowFilter?: string; timeoutMs?: number },
    windowTitle?: string,
  ): Promise<boolean> {
    let controlType: string | undefined;
    let windowFilter: string | undefined;
    let timeoutMs = 250;

    if (typeof typeOrOptions === 'object' && typeOrOptions !== null) {
      controlType = typeOrOptions.controlType;
      windowFilter = typeOrOptions.windowFilter;
      if (typeOrOptions.timeoutMs !== undefined) timeoutMs = typeOrOptions.timeoutMs;
    } else if (typeof typeOrOptions === 'string') {
      controlType = typeOrOptions;
      windowFilter = windowTitle;
    } else {
      windowFilter = windowTitle;
    }

    const b64 = Buffer.from(text, 'utf8').toString('base64');
    let targetSpec = '';
    if (windowFilter) {
      targetSpec = `${windowFilter}|${name}|${controlType || 'edit'}`;
    } else if (controlType) {
      targetSpec = `${name}|${controlType}`;
    } else {
      targetSpec = name;
    }

    const res = await this.queryCommand(`set_element_text_b64 ${targetSpec}|${b64}`, timeoutMs);
    return Boolean(res && res.startsWith('TEXT_SET') && res.includes('success:true'));
  }
}

export interface WindowInfo {
  hwnd: number;
  process: string;
  title: string;
  rect: { x: number; y: number; width: number; height: number };
}

export interface WindowItem {
  hwnd: number;
  pid: number;
  proc: string;
  state: 'normal' | 'maximized' | 'minimized';
  title: string;
  rect: { x: number; y: number; width: number; height: number };
}

export interface FocusedInfo {
  hwnd: number;
  proc: string;
  state: string;
  title: string;
  rect: { x: number; y: number; width: number; height: number };
  focusedControl: {
    name: string;
    type: string;
    id: string;
  };
}

export interface ElementInfo {
  name: string;
  type: string;
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface ActiveAppInfo {
  processName: string;
  baseName: string;
  title: string;
  hwnd: number;
  rect: { x: number; y: number; width: number; height: number };
  isNativeAccessible: boolean;
  category: 'editor' | 'browser' | 'system' | 'calc' | 'terminal' | 'file_manager' | 'unknown';
}

export const NATIVE_ACCESSIBLE_APPS = new Set([
  'calc',
  'calculator',
  'calculatorapp',
  'notepad',
  'explorer',
  'cmd',
  'powershell',
  'pwsh',
  'windowsterminal',
  'mspaint',
  'paint',
  'wordpad',
  'taskmgr',
  'regedit',
  'mmc',
  'systemsettings',
  'applicationframehost',
  'control',
]);

export const APP_CATEGORIES: Record<
  string,
  'editor' | 'browser' | 'system' | 'calc' | 'terminal' | 'file_manager'
> = {
  notepad: 'editor',
  wordpad: 'editor',
  code: 'editor',
  calc: 'calc',
  calculator: 'calc',
  calculatorapp: 'calc',
  explorer: 'file_manager',
  cmd: 'terminal',
  powershell: 'terminal',
  pwsh: 'terminal',
  windowsterminal: 'terminal',
  chrome: 'browser',
  msedge: 'browser',
  brave: 'browser',
  firefox: 'browser',
  taskmgr: 'system',
  regedit: 'system',
  systemsettings: 'system',
  control: 'system',
};

export const fastInput = FastInputManager.getInstance();



