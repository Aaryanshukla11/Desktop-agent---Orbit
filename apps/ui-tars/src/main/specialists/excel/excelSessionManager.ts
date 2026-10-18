import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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

    // 3. Fallback discovery: Look for the most recent Excel file on Desktop created in the last 2 hours
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
   * Auto-discovers recently modified .xlsx files on Desktop (OneDrive Desktop or User Desktop)
   */
  private static discoverRecentDesktopWorkbook(): ActiveExcelSession | null {
    const candidateDirs = [
      path.join(os.homedir(), 'OneDrive', 'Desktop'),
      path.join(os.homedir(), 'Desktop'),
      path.resolve(process.cwd(), 'runs'),
    ];

    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    let newestFile: { fullPath: string; mtimeMs: number } | null = null;

    for (const dir of candidateDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (!f.endsWith('.xlsx')) continue;
          const fullPath = path.join(dir, f);
          const stat = fs.statSync(fullPath);
          if (stat.mtimeMs > twoHoursAgo) {
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
        mainSheetName: 'EmployeeData',
        headers: ['Employee ID', 'Full Name', 'Department', 'Job Title', 'Hourly Rate ($)', 'Monthly Salary ($)', 'Status'],
        rowCount: 200,
        lastUpdated: newestFile.mtimeMs,
        domainName: 'Discovered Dataset',
      };
    }

    return null;
  }
}
