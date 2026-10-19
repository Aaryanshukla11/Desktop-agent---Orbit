import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { logger } from '../../logger';

export interface ActiveExcelSession {
  filePath: string;
  fileName: string;
  mainSheetName: string;
  headers: string[];
  rowCount: number;
  lastUpdated: number;
  summarySheetName?: string;
  chartTitle?: string;
  chartType?: string;
  domainName?: string;
}

export class ExcelSessionManager {
  public static autoDiscoveryEnabled: boolean = true;
  public static mockExcelRunning: boolean | null = null;
  private static session: ActiveExcelSession | null = null;
  private static sessionFile = path.resolve(process.cwd(), 'runs', 'active_excel_session.json');

  public static setActiveSession(session: ActiveExcelSession): void {
    this.session = { ...session, lastUpdated: Date.now() };
    try {
      const runsDir = path.dirname(this.sessionFile);
      if (!fs.existsSync(runsDir)) {
        fs.mkdirSync(runsDir, { recursive: true });
      }
      fs.writeFileSync(this.sessionFile, JSON.stringify(this.session, null, 2), 'utf8');
      logger.info(`[ExcelSessionManager] Active Excel session saved for "${session.fileName}" at ${session.filePath}`);
    } catch (err) {
      logger.warn('[ExcelSessionManager] Failed to persist active session to disk:', err);
    }
  }

  /**
   * Fast check if Microsoft Excel process is running on the system
   */
  public static isExcelRunning(): boolean {
    if (this.mockExcelRunning !== null) return this.mockExcelRunning;
    if (process.platform !== 'win32') return false;
    try {
      const tasklistCmd = process.env.SystemRoot
        ? path.join(process.env.SystemRoot, 'System32', 'tasklist.exe')
        : 'tasklist.exe';
      const stdout = execSync(`"${tasklistCmd}" /FI "IMAGENAME eq excel.exe" /NH`, {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 2000,
      });
      if (stdout.toLowerCase().includes('excel.exe')) return true;
    } catch {}

    try {
      const out = execSync('powershell.exe -NoProfile -Command "[bool](Get-Process excel -ErrorAction SilentlyContinue)"', {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 2000,
      });
      if (out.trim().toLowerCase() === 'true') return true;
    } catch {}

    return false;
  }

  /**
   * Directly queries the running Excel instance for its currently open active workbook
   */
  public static getActiveWorkbookFromRunningExcel(): { filePath: string; sheetName: string } | null {
    if (!this.isExcelRunning()) return null;
    try {
      const cmd = `powershell -NoProfile -Command "try { $e = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application'); if ($e.ActiveWorkbook) { Write-Output ('ORBIT_ACTIVE_WB:' + $e.ActiveWorkbook.FullName + '::' + $e.ActiveSheet.Name) } } catch {}"`;
      const out = execSync(cmd, {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 2500,
      });
      for (const line of out.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('ORBIT_ACTIVE_WB:')) {
          const rest = trimmed.replace('ORBIT_ACTIVE_WB:', '');
          const [fullPath, sheetName] = rest.split('::');
          if (fullPath && fs.existsSync(fullPath)) {
            logger.info(`[ExcelSessionManager] Connected directly to running Excel workbook: ${fullPath} (Sheet: ${sheetName})`);
            return { filePath: fullPath, sheetName: sheetName || 'Sheet1' };
          }
        }
      }
    } catch (err) {
      logger.debug('[ExcelSessionManager] Active COM workbook query returned no result:', err);
    }
    return null;
  }

  public static getActiveSession(): ActiveExcelSession | null {
    // 1. Check in-memory session
    if (this.session && fs.existsSync(this.session.filePath)) {
      return this.session;
    }

    // 2. Check persistent file on disk
    if (fs.existsSync(this.sessionFile)) {
      try {
        const raw = fs.readFileSync(this.sessionFile, 'utf8');
        const parsed: ActiveExcelSession = JSON.parse(raw);
        if (parsed.filePath && fs.existsSync(parsed.filePath)) {
          this.session = parsed;
          return this.session;
        }
      } catch (err) {
        logger.warn('[ExcelSessionManager] Failed to read active session file:', err);
      }
    }

    // 3. Fallback discovery: Look for the most recent Excel file on Desktop created or running in Excel
    if (this.autoDiscoveryEnabled) {
      const recentDesktopFile = this.discoverRecentDesktopWorkbook();
      if (recentDesktopFile) {
        this.session = recentDesktopFile;
        return this.session;
      }
    }

    return null;
  }

  public static hasActiveSession(): boolean {
    return this.getActiveSession() !== null;
  }

  public static clearActiveSession(): void {
    this.session = null;
    try {
      if (fs.existsSync(this.sessionFile)) {
        fs.unlinkSync(this.sessionFile);
      }
    } catch {}
    logger.info('[ExcelSessionManager] Active session cleared.');
  }

  public static updateHeaders(newHeaders: string[]): void {
    if (this.session) {
      this.session.headers = newHeaders;
      this.session.lastUpdated = Date.now();
      this.setActiveSession(this.session);
    }
  }

  public static updateRowCount(count: number): void {
    if (this.session) {
      this.session.rowCount = count;
      this.session.lastUpdated = Date.now();
      this.setActiveSession(this.session);
    }
  }

  /**
   * Auto-discovers active workbook via running Excel COM or recently modified .xlsx files on Desktop
   */
  private static discoverRecentDesktopWorkbook(): ActiveExcelSession | null {
    // Priority 1: If Excel is currently open, query active workbook directly
    const runningWb = this.getActiveWorkbookFromRunningExcel();
    if (runningWb) {
      return {
        filePath: runningWb.filePath,
        fileName: path.basename(runningWb.filePath),
        mainSheetName: runningWb.sheetName,
        headers: [],
        rowCount: 100,
        lastUpdated: Date.now(),
        domainName: 'Active Excel Workbook',
      };
    }

    // Priority 2: Scan Desktop & runs for recently modified .xlsx files (up to 24h old)
    const candidateDirs = [
      path.join(os.homedir(), 'OneDrive', 'Desktop'),
      path.join(os.homedir(), 'Desktop'),
      path.resolve(process.cwd(), 'runs'),
    ];

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let newestFile: { fullPath: string; mtimeMs: number } | null = null;

    for (const dir of candidateDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (!f.endsWith('.xlsx')) continue;
          if (f.startsWith('~') || f.startsWith('.')) continue; // ignore lock and temporary hidden files
          const fullPath = path.join(dir, f);
          const stat = fs.statSync(fullPath);
          if (stat.mtimeMs > thirtyDaysAgo) {
            if (!newestFile || stat.mtimeMs > newestFile.mtimeMs) {
              newestFile = { fullPath, mtimeMs: stat.mtimeMs };
            }
          }
        }
      } catch {}
    }

    if (newestFile) {
      const fileName = path.basename(newestFile.fullPath);
      logger.info(`[ExcelSessionManager] Discovered recently active workbook on Desktop: ${newestFile.fullPath}`);
      return {
        filePath: newestFile.fullPath,
        fileName,
        mainSheetName: 'Sheet1',
        headers: [],
        rowCount: 100,
        lastUpdated: newestFile.mtimeMs,
        domainName: 'Discovered Dataset',
      };
    }

    return null;
  }
}
