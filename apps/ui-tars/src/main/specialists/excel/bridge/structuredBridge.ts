import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface BridgeExecutionResult<T = any> {
  success: boolean;
  operation: string;
  excelPid: number | null;
  data: T;
  errors: string[];
  executionTimeMs: number;
}

export class ExcelStructuredBridge {
  private scriptPath: string;

  constructor() {
    this.scriptPath = path.resolve(__dirname, 'excelBridge.ps1');
    if (!fs.existsSync(this.scriptPath)) {
      throw new Error(`Excel bridge script not found at: ${this.scriptPath}`);
    }
  }

  /**
   * Check for temporary Excel lock file (~$filename.xlsx)
   */
  public isFileLocked(filePath: string): boolean {
    if (!fs.existsSync(filePath)) return false;
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    const lockPath = path.join(dir, `~$${base}`);
    return fs.existsSync(lockPath);
  }

  /**
   * Execute an allowlisted operation with structured JSON parameters.
   */
  public async execute<T = any>(
    operation: string,
    config: Record<string, any>,
    timeoutMs: number = 60000,
  ): Promise<BridgeExecutionResult<T>> {
    const tempDir = os.tmpdir();
    const nonce = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const configPath = path.join(tempDir, `orbit_bridge_cfg_${nonce}.json`);
    const resultPath = path.join(tempDir, `orbit_bridge_res_${nonce}.json`);

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { encoding: 'utf8' });

    const startTime = Date.now();

    return new Promise<BridgeExecutionResult<T>>((resolve, reject) => {
      const args = [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        this.scriptPath,
        '-Operation',
        operation,
        '-ConfigPath',
        configPath,
        '-ResultPath',
        resultPath,
      ];

      const child = spawn('powershell.exe', args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {}
        cleanupTempFiles();
        reject(
          new Error(
            `ExcelStructuredBridge: Operation '${operation}' timed out after ${timeoutMs}ms. Stderr: ${stderr}`,
          ),
        );
      }, timeoutMs);

      const cleanupTempFiles = () => {
        clearTimeout(timer);
        try {
          if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
        } catch {}
        try {
          if (fs.existsSync(resultPath)) fs.unlinkSync(resultPath);
        } catch {}
      };

      child.on('close', (code) => {
        clearTimeout(timer);
        const executionTimeMs = Date.now() - startTime;

        let resultData: BridgeExecutionResult<T> = {
          success: code === 0,
          operation,
          excelPid: null,
          data: {} as T,
          errors: [],
          executionTimeMs,
        };

        if (fs.existsSync(resultPath)) {
          try {
            const raw = fs.readFileSync(resultPath, { encoding: 'utf8' }).replace(/^\uFEFF/, '');
            const parsed = JSON.parse(raw);
            resultData.success = Boolean(parsed.success);
            resultData.excelPid = parsed.excelPid || null;
            resultData.data = parsed.data || {};
            if (Array.isArray(parsed.errors)) {
              resultData.errors = parsed.errors;
            }
          } catch (e: any) {
            resultData.success = false;
            resultData.errors.push(`Failed to parse result json: ${e.message}`);
          }
        } else {
          resultData.success = false;
          resultData.errors.push(`Bridge did not write result file. Exit code: ${code}. Stderr: ${stderr}`);
        }

        cleanupTempFiles();
        resolve(resultData);
      });

      child.on('error', (err) => {
        cleanupTempFiles();
        reject(new Error(`Failed to spawn powershell bridge: ${err.message}`));
      });
    });
  }
}
