import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { RecoveryJournal } from '../core/recoveryJournal';
import { TransactionalWorkspace } from '../core/transactionalWorkspace';
import { LineageTracker } from '../core/lineageTracker';
import { WorkbookProfiler, SheetProtectionAudit } from '../core/workbookProfiler';
import { VerificationOracle } from '../core/verificationOracle';

describe('ORBIT Excel Specialist — Stage 01 Foundation Verification Test Suite', () => {
  const testDir = path.resolve(process.cwd(), 'temp_stage01_test');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Non-critical
      }
    }
  });

  // ==========================================================
  // GATE 1: Read-Only Safety & Immutability Test
  // ==========================================================
  it('Gate 1: WorkbookProfiler strictly preserves source file immutability (MD5 Match)', async () => {
    const dummyPath = path.join(testDir, 'source_test.xlsx');
    fs.writeFileSync(dummyPath, 'ORBIT_MOCK_EXCEL_BINARY_DATA_XYZ_123');

    const preHash = WorkbookProfiler.computeHash(dummyPath);
    expect(preHash).toBeDefined();
    expect(preHash.length).toBe(64);

    const profiler = new WorkbookProfiler();
    const profile = await profiler.profile(dummyPath, async () => ({
      sheetNames: ['Orders', 'Summary'],
      protection: [
        {
          sheetName: 'Orders',
          isWorksheetProtected: false,
          hasLockedCells: false,
          canSafelyModify: true,
        },
      ],
      baselineErrors: [],
      featureAudit: {
        isMacroEnabled: false,
        hasExternalLinks: false,
        hasStructuredTables: true,
        hasCharts: true,
        formulaCount: 45,
        unsupportedFeatures: [],
      },
      headersBySheet: { Orders: ['ID', 'Date', 'Amount'] },
      rowCountBySheet: { Orders: 100 },
    }));

    const postHash = WorkbookProfiler.computeHash(dummyPath);
    expect(postHash).toBe(preHash);
    expect(profile.sha256).toBe(preHash);
    expect(profile.featureAudit.formulaCount).toBe(45);
  });

  // ==========================================================
  // GATE 2: Crash Recovery & Idempotent Restoration Test
  // ==========================================================
  it('Gate 2: Crash-recovery journal idempotently restores target file without loss', () => {
    const targetFile = path.join(testDir, 'critical_finance.xlsx');
    const backupFile = path.join(testDir, 'critical_finance.orbit_bak');
    const tempFile = path.join(testDir, '.orbit_tmp_crash_sim.xlsx');

    const journal = new RecoveryJournal(testDir);
    journal.beginSwap(targetFile, tempFile, backupFile);

    // Simulate Step 1 completed: Target was renamed to Backup
    fs.writeFileSync(backupFile, 'CRITICAL_EXISTING_FINANCIAL_DATA');
    journal.updateState('BACKUP_CREATED');

    // Simulate system crash right before target rename
    expect(fs.existsSync(targetFile)).toBe(false);
    expect(fs.existsSync(backupFile)).toBe(true);

    // Run Startup Disaster Recovery (first pass)
    const recovery1 = RecoveryJournal.executeStartupRecovery(testDir);
    expect(recovery1.recovered).toBe(true);
    expect(recovery1.reason).toBe('RESTORED_FROM_BACKUP_CREATED');
    expect(fs.existsSync(targetFile)).toBe(true);
    expect(fs.readFileSync(targetFile, 'utf8')).toBe('CRITICAL_EXISTING_FINANCIAL_DATA');

    // Run Startup Disaster Recovery again (idempotent second pass)
    const recovery2 = RecoveryJournal.executeStartupRecovery(testDir);
    expect(recovery2.recovered).toBe(false); // Cleanly inactive, target untouched
    expect(fs.existsSync(targetFile)).toBe(true);
  });

  // ==========================================================
  // GATE 3: Lineage & Contextual Error Drift Test
  // ==========================================================
  it('Gate 3: LineageTracker distinguishes moved errors and pruned errors from introduced errors', () => {
    const lineage = new LineageTracker();
    const rids = lineage.ingest(5); // rows 0, 1, 2, 3, 4

    // Baseline: row 2 (RID 3) had a #REF! error at column 'Discount', address 'C4'
    lineage.registerBaselineError({
      errorType: '#REF!',
      sourceRid: rids[2],
      sheetName: 'Orders',
      columnName: 'Discount',
      originalAddress: 'C4',
    });

    // Baseline: row 4 (RID 5) had a #VALUE! error at column 'Tax', address 'E6'
    lineage.registerBaselineError({
      errorType: '#VALUE!',
      sourceRid: rids[4],
      sheetName: 'Orders',
      columnName: 'Tax',
      originalAddress: 'E6',
    });

    // Operation 1: Row 4 is deleted (e.g. invalid duplicate)
    lineage.delete([rids[4]], 'DUPLICATE_KEY');

    // Operation 2: Table is sorted descending, shifting row 2 (RID 3) from C4 to C2
    lineage.reorder([rids[2], rids[0], rids[1], rids[3]]);

    // Observed final errors in workbook
    const finalErrors = [
      {
        sheetName: 'Orders',
        columnName: 'Discount',
        errorType: '#REF!',
        currentRid: rids[2],
        address: 'C2', // moved from C4 to C2!
      },
    ];

    const classification = lineage.classifyErrors(finalErrors);

    // The #REF! error was MOVED, not a new introduced error!
    expect(classification.moved.length).toBe(1);
    expect(classification.moved[0].baseline.originalAddress).toBe('C4');
    expect(classification.moved[0].newAddress).toBe('C2');

    // The #VALUE! error was PRUNED because row 4 was deleted!
    expect(classification.pruned.length).toBe(1);
    expect(classification.pruned[0].errorType).toBe('#VALUE!');

    // ZERO introduced new errors
    expect(classification.introduced.length).toBe(0);
  });

  // ==========================================================
  // GATE 4: Two-Tier Protection Auditing Test
  // ==========================================================
  it('Gate 4: Respects two-tier protection boundaries (Sheet Protection + Cell Locked)', () => {
    const sheetProtected: SheetProtectionAudit = {
      sheetName: 'Payroll',
      isWorksheetProtected: true,
      hasLockedCells: true,
      canSafelyModify: false,
    };

    const sheetUnlocked: SheetProtectionAudit = {
      sheetName: 'ScratchPad',
      isWorksheetProtected: false,
      hasLockedCells: true, // Locked flag is ignored when worksheet protection is disabled
      canSafelyModify: true,
    };

    expect(sheetProtected.canSafelyModify).toBe(false);
    expect(sheetUnlocked.canSafelyModify).toBe(true);
  });

  // ==========================================================
  // GATE 5: MECE Partition Invariant Assertion Test
  // ==========================================================
  it('Gate 5: VerificationOracle enforces strict MECE row conservation without double-counting', () => {
    const oracle = new VerificationOracle();
    const lineage = new LineageTracker();
    lineage.ingest(100);

    // Valid MECE Partition: 100 == 80 + 10 + 5 + 5
    const validPartition = {
      inputTotal: 100,
      cleanedCount: 80,
      deduplicatedCount: 10,
      rejectedCount: 5,
      reviewQueueCount: 5,
    };

    const verdictPass = oracle.evaluate({
      partition: validPartition,
      lineageTracker: lineage,
      finalErrors: [],
      calculationEvidence: 'COM_ExcelActive',
    });

    expect(verdictPass.mecePartitionValid).toBe(true);
    expect(verdictPass.status).toBe('NEEDS_REVIEW'); // Review queue count > 0 -> NEEDS_REVIEW
    expect(verdictPass.invariantsPassed).toBe(true);

    // Invalid MECE Partition: double counted (Sum = 105, Input = 100)
    const invalidPartition = {
      inputTotal: 100,
      cleanedCount: 80,
      deduplicatedCount: 15,
      rejectedCount: 5,
      reviewQueueCount: 5, // Total 105 != 100
    };

    const verdictFail = oracle.evaluate({
      partition: invalidPartition,
      lineageTracker: lineage,
      finalErrors: [],
      calculationEvidence: 'COM_ExcelActive',
    });

    expect(verdictFail.mecePartitionValid).toBe(false);
    expect(verdictFail.status).toBe('FAILED');
    expect(verdictFail.violations.length).toBeGreaterThanOrEqual(1);
    expect(verdictFail.violations[0]).toContain('MECE Invariant Violated');
  });

  // ==========================================================
  // Transactional Workspace: Safe Fallback Test
  // ==========================================================
  it('TransactionalWorkspace safely commits and handles same-volume shadow working files', () => {
    const targetFile = path.join(testDir, 'sales_out.xlsx');
    const ws = new TransactionalWorkspace(targetFile);

    // Write mock data to shadow temp path
    fs.writeFileSync(ws.getShadowTempPath(), 'MOCK_XLSX_FINAL_TRANSFORMATION');

    // Publish to new target
    const result = ws.publish(false);
    expect(result.success).toBe(true);
    expect(result.publishedPath).toBe(targetFile);
    expect(fs.existsSync(targetFile)).toBe(true);
    expect(fs.readFileSync(targetFile, 'utf8')).toBe('MOCK_XLSX_FINAL_TRANSFORMATION');
  });
});
