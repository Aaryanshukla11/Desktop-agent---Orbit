import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.0', getPath: () => '', on: vi.fn() },
  BrowserWindow: vi.fn(),
  dialog: vi.fn(),
  shell: vi.fn(),
}));

vi.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdates: vi.fn(),
    on: vi.fn(),
  },
}));

vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
import { isExcelTask } from '../excelChatRouter';
import { ExcelSessionManager, ActiveExcelSession } from '../excelSessionManager';

describe('Stage 08: Multi-Turn Excel Continuation & Conversational Context', () => {
  const dummyFilePath = path.resolve(process.cwd(), 'scratch', 'test_dummy_employee.xlsx');

  beforeEach(() => {
    // Ensure scratch dir
    const dir = path.dirname(dummyFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dummyFilePath, 'dummy excel content', 'utf8');

    ExcelSessionManager.autoDiscoveryEnabled = false;
    ExcelSessionManager.clearActiveSession();
  });

  afterEach(() => {
    ExcelSessionManager.clearActiveSession();
    ExcelSessionManager.autoDiscoveryEnabled = true;
    try { fs.unlinkSync(dummyFilePath); } catch {}
  });

  it('correctly rejects follow-up without active session or excel keywords', () => {
    // When no active session exists, vague continuation without excel should return false
    expect(isExcelTask('ab isme bonus column add kar do')).toBe(false);
    expect(isExcelTask('salary ke hisaab se sort kardo')).toBe(false);
  });

  it('correctly accepts standalone initial Excel task', () => {
    expect(isExcelTask('open excel and make a dummy data of 200 employee')).toBe(true);
    expect(isExcelTask('create a dummy sales sheet')).toBe(true);
  });

  it('recognizes multi-turn continuation tasks once active session is established', () => {
    const session: ActiveExcelSession = {
      filePath: dummyFilePath,
      fileName: 'employee_records.xlsx',
      mainSheetName: 'EmployeeData',
      headers: ['Employee ID', 'Full Name', 'Department', 'Monthly Salary ($)'],
      rowCount: 200,
      lastUpdated: Date.now(),
      domainName: 'Employee HR Records',
    };

    ExcelSessionManager.setActiveSession(session);
    expect(ExcelSessionManager.hasActiveSession()).toBe(true);

    // Hindi & Hinglish continuation requests
    expect(isExcelTask('ab isme bonus column add kar do')).toBe(true);
    expect(isExcelTask('salary ke hisaab se sort kardo')).toBe(true);
    expect(isExcelTask('isme 10% bonus add karo')).toBe(true);
    expect(isExcelTask('ye data clean kardo')).toBe(true);
    expect(isExcelTask('calculate average salary')).toBe(true);
    expect(isExcelTask('make a pie chart for departments')).toBe(true);
    expect(isExcelTask('total monthly payroll kitna hai')).toBe(true);

    // Unrelated task should NOT be hijacked even if active session exists
    expect(isExcelTask('open chrome and search for weather')).toBe(false);
    expect(isExcelTask('open youtube and play music')).toBe(false);
  });

  it('persists and restores active session across serialization', () => {
    const session: ActiveExcelSession = {
      filePath: dummyFilePath,
      fileName: 'test_persist.xlsx',
      mainSheetName: 'Sheet1',
      headers: ['ID', 'Name', 'Salary'],
      rowCount: 50,
      lastUpdated: Date.now(),
    };

    ExcelSessionManager.setActiveSession(session);
    const retrieved = ExcelSessionManager.getActiveSession();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.filePath).toBe(dummyFilePath);
    expect(retrieved?.rowCount).toBe(50);

    ExcelSessionManager.updateHeaders(['ID', 'Name', 'Salary', 'Bonus (10%)']);
    const updated = ExcelSessionManager.getActiveSession();
    expect(updated?.headers).toContain('Bonus (10%)');
  });
});
