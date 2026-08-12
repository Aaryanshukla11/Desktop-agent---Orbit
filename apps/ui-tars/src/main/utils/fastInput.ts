import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { screen } from 'electron';
import { logger } from '@main/logger';

class FastInputManager {
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

  public async sendCommand(cmd: string): Promise<boolean> {
    if (!this.process || !this.process.stdin || this.process.killed) {
      this.initProcess();
      // Wait up to 500ms for ready
      let waited = 0;
      while (!this.isReady && waited < 500) {
        await new Promise((r) => setTimeout(r, 50));
        waited += 50;
      }
    }

    if (!this.process || !this.process.stdin) {
      logger.warn('[FastInputManager] FastInputServer not available, returning false');
      return false;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // remove waiter on timeout
        const idx = this.responseWaiters.indexOf(waiter);
        if (idx !== -1) this.responseWaiters.splice(idx, 1);
        resolve(false);
      }, 2000);

      const waiter = (res: string) => {
        clearTimeout(timeout);
        resolve(res.startsWith('OK'));
      };

      this.responseWaiters.push(waiter);
      try {
        this.process!.stdin!.write(cmd.trim() + '\n');
      } catch (err) {
        clearTimeout(timeout);
        const idx = this.responseWaiters.indexOf(waiter);
        if (idx !== -1) this.responseWaiters.splice(idx, 1);
        resolve(false);
      }
    });
  }

  private getScaleFactor(): number {
    try {
      return screen.getPrimaryDisplay()?.scaleFactor || 1;
    } catch {
      return 1;
    }
  }

  public async humanGlide(targetX: number, targetY: number): Promise<void> {
    try {
      const start = screen.getCursorScreenPoint();
      const dx = targetX - start.x;
      const dy = targetY - start.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 20) {
        await this.move(targetX, targetY);
        return;
      }

      // Smooth micro-glide: 3 rapid awaited steps (~25ms total) with no IPC pipe congestion
      const steps = 3;
      for (let i = 1; i < steps; i++) {
        const progress = i / steps;
        const t = 1 - Math.pow(1 - progress, 2.0);
        const curX = Math.round(start.x + dx * t);
        const curY = Math.round(start.y + dy * t);
        await this.move(curX, curY);
      }
      await this.move(targetX, targetY);
    } catch (e) {
      await this.move(targetX, targetY);
    }
  }

  public async smoothClick(
    x: number,
    y: number,
    hint?: string,
    physX?: number,
    physY?: number,
  ): Promise<boolean> {
    await this.humanGlide(x, y);
    return this.click(x, y, hint, physX, physY);
  }

  public async smoothDoubleClick(
    x: number,
    y: number,
    hint?: string,
    physX?: number,
    physY?: number,
  ): Promise<boolean> {
    await this.humanGlide(x, y);
    return this.doubleClick(x, y, hint, physX, physY);
  }

  public async smoothRightClick(
    x: number,
    y: number,
    hint?: string,
    physX?: number,
    physY?: number,
  ): Promise<boolean> {
    await this.humanGlide(x, y);
    return this.rightClick(x, y, hint, physX, physY);
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
    await this.humanGlide(x1, y1);
    return this.drag(x1, y1, x2, y2, physX1, physY1, physX2, physY2);
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

  public async captureScreenshot(filePath: string): Promise<boolean> {
    return this.sendCommand(`screenshot ${filePath}`);
  }
}

export const fastInput = FastInputManager.getInstance();

