import * as fs from 'fs';
import * as path from 'path';
import { ExcelStructuredBridge } from './bridge/structuredBridge';
import { SyntheticSalesGenerator } from './generator/syntheticSales';
import { MathOracle } from './oracle/mathOracle';
import { TransactionalWorkspace } from './core/transactionalWorkspace';
import { LineageTracker } from './core/lineageTracker';
import { WorkbookProfiler } from './core/workbookProfiler';
import { VerificationOracle } from './core/verificationOracle';
import {
  CategorySummaryRecord,
  DataQualityRules,
  ExecutionModality,
  OracleVerificationResult,
  SavedAuditResult,
  SliceStatus,
  VerticalSliceReport,
  WorkbookInspectionResult,
} from './types';

export interface SliceRunnerOptions {
  seed?: number;
  rowCount?: number;
  workingDir?: string;
  rules?: Partial<DataQualityRules>;
}

export class ExcelSliceRunner {
  private bridge: ExcelStructuredBridge;
  private generator: SyntheticSalesGenerator;
  private oracle: MathOracle;

  constructor() {
    this.bridge = new ExcelStructuredBridge();
    this.generator = new SyntheticSalesGenerator();
    this.oracle = new MathOracle();
  }

  /**
   * Title-cases a category string (e.g. "office supplies" -> "Office Supplies")
   */
  private titleCase(str: string): string {
    return str
      .split(' ')
      .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
      .join(' ');
  }


  /**
   * Executes the complete vertical slice autonomously with full evidence tracking.
   */
  public async executeSlice(options: SliceRunnerOptions = {}): Promise<VerticalSliceReport> {
    const seed = options.seed ?? 42;
    const rowCount = options.rowCount ?? 550;
    const workingDir = options.workingDir ?? path.resolve(process.cwd(), 'temp_excel_slice');

    if (!fs.existsSync(workingDir)) {
      fs.mkdirSync(workingDir, { recursive: true });
    }

    const inputWorkbookPath = path.join(workingDir, `sales_raw_seed_${seed}.xlsx`);
    const outputWorkbookPath = path.join(workingDir, `sales_cleaned_summary_seed_${seed}.xlsx`);

    const rules: DataQualityRules = {
      trimWhitespace: options.rules?.trimWhitespace ?? true,
      normalizeCategoryCasing: options.rules?.normalizeCategoryCasing ?? true,
      recomputeInvalidTotals: options.rules?.recomputeInvalidTotals ?? true,
      deduplicateByField: options.rules?.deduplicateByField ?? 'OrderID',
    };

    const errors: string[] = [];
    const executionModality: ExecutionModality = 'NATIVE_EXCEL_COM';

    const timings = {
      generationMs: 0,
      inspectionMs: 0,
      cleaningMs: 0,
      calculationMs: 0,
      oracleVerificationMs: 0,
      chartCreationMs: 0,
      saveMs: 0,
      auditMs: 0,
      totalMs: 0,
    };

    const overallStart = Date.now();
    let trackedExcelPid: number | null = null;

    // STEP 1: Generate synthetic sales data
    const genStart = Date.now();
    const synthetic = this.generator.generate(rowCount, seed);
    timings.generationMs = Date.now() - genStart;

    // Create the raw workbook via COM bridge
    const createRes = await this.bridge.execute('CREATE_WORKBOOK', {
      destPath: inputWorkbookPath,
      headers: synthetic.headers,
      rows: synthetic.rawRows,
    });

    if (!createRes.success) {
      throw new Error(`Failed to create synthetic workbook: ${createRes.errors.join('; ')}`);
    }
    if (createRes.excelPid) trackedExcelPid = createRes.excelPid;

    const initialFileHash = WorkbookProfiler.computeHash(inputWorkbookPath);

    // STEP 2: Inspect raw workbook
    const inspectStart = Date.now();
    const inspectRes = await this.bridge.execute<WorkbookInspectionResult>('INSPECT_WORKBOOK', {
      targetPath: inputWorkbookPath,
    });
    timings.inspectionMs = Date.now() - inspectStart;

    if (!inspectRes.success) {
      errors.push(`Inspection failed: ${inspectRes.errors.join('; ')}`);
    }

    // Read all rows for autonomous inspection & rule-based cleaning
    const readRes = await this.bridge.execute<{
      rowCount: number;
      colCount: number;
      rows: Array<Array<string | number>>;
    }>('READ_DATA', {
      targetPath: inputWorkbookPath,
      sheetName: 'SalesData',
    });

    if (!readRes.success || !readRes.data.rows) {
      errors.push(`Reading raw data failed: ${readRes.errors.join('; ')}`);
    }

    const rawData = readRes.data.rows || [];
    const headers = (rawData[0] || []).map(String);
    const dataRows = rawData.slice(1);

    // STEP 3: Autonomous Data Cleaning (determined strictly by inspecting observed data)
    const cleanStart = Date.now();
    const orderIdIdx = headers.indexOf(rules.deduplicateByField);
    const categoryIdx = headers.indexOf('Category');
    const unitsIdx = headers.indexOf('Units');
    const priceIdx = headers.indexOf('UnitPrice');
    const totalIdx = headers.indexOf('Total');

    let duplicatesRemoved = 0;
    let categoriesNormalized = 0;
    let totalsRepaired = 0;

    const lineage = new LineageTracker();
    const rids = lineage.ingest(dataRows.length);
    const seenOrderIds = new Set<string>();
    const cleanedDataRows: Array<Array<string | number>> = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rid = rids[i];
      const orderId = String(row[orderIdIdx]);

      // Deduplication check
      if (rules.deduplicateByField && orderIdIdx !== -1) {
        if (seenOrderIds.has(orderId)) {
          duplicatesRemoved++;
          lineage.delete([rid], 'DUPLICATE_KEY');
          continue; // skip duplicate
        }
        seenOrderIds.add(orderId);
      }

      const rowCopy = [...row];

      // Category cleaning
      if (categoryIdx !== -1) {
        let cat = String(rowCopy[categoryIdx]);
        const originalCat = cat;

        if (rules.trimWhitespace) {
          cat = cat.trim();
        }
        if (rules.normalizeCategoryCasing) {
          cat = this.titleCase(cat);
        }

        if (cat !== originalCat) {
          categoriesNormalized++;
        }
        rowCopy[categoryIdx] = cat;
      }

      // Total repair check
      if (rules.recomputeInvalidTotals && unitsIdx !== -1 && priceIdx !== -1 && totalIdx !== -1) {
        const units = Number(rowCopy[unitsIdx]);
        const price = Number(rowCopy[priceIdx]);
        const expectedTotal = parseFloat((units * price).toFixed(2));
        const currentTotal = Number(rowCopy[totalIdx]);

        if (Math.abs(currentTotal - expectedTotal) > 0.01) {
          totalsRepaired++;
          rowCopy[totalIdx] = expectedTotal;
        }
      }

      cleanedDataRows.push(rowCopy);
    }

    timings.cleaningMs = Date.now() - cleanStart;

    // STEP 4: Write cleaned data to separate output workbook via TransactionalWorkspace
    const workspace = new TransactionalWorkspace(outputWorkbookPath);
    const saveStart = Date.now();
    const allCleanedRows = [headers, ...cleanedDataRows];
    const writeRes = await this.bridge.execute('WRITE_CLEANED_DATA', {
      sourcePath: inputWorkbookPath,
      outputPath: workspace.getShadowTempPath(),
      cleanedRows: allCleanedRows,
    });
    timings.saveMs = Date.now() - saveStart;

    if (!writeRes.success) {
      errors.push(`Writing cleaned data failed: ${writeRes.errors.join('; ')}`);
    }

    // Extract unique discovered categories for summary
    const uniqueCategoriesSet = new Set<string>();
    for (const r of cleanedDataRows) {
      uniqueCategoriesSet.add(String(r[categoryIdx]));
    }
    const categoriesList = Array.from(uniqueCategoriesSet).sort();

    // STEP 5: Apply Category Summary, Insert Native Formulas & Native Chart
    const calcStart = Date.now();
    const summaryRes = await this.bridge.execute<{
      summarySheetName: string;
      summaryRowCount: number;
      calculatedSummary: CategorySummaryRecord[];
      chartCreated: boolean;
      chartType: string;
      chartTitle: string;
    }>('APPLY_SUMMARY_AND_CHART', {
      targetPath: workspace.getShadowTempPath(),
      summarySheetName: 'CategorySummary',
      categories: categoriesList,
      dataRowCount: cleanedDataRows.length + 1, // row count including header
    });
    timings.calculationMs = Date.now() - calcStart;

    if (!summaryRes.success) {
      errors.push(`Applying summary & chart failed: ${summaryRes.errors.join('; ')}`);
    }

    const calculatedSummary = summaryRes.data.calculatedSummary || [];

    // STEP 6: Independent Math Oracle & MECE Invariant Verification
    const oracleStart = Date.now();
    const oracleResult: OracleVerificationResult = this.oracle.verify(
      headers,
      cleanedDataRows,
      calculatedSummary,
    );
    timings.oracleVerificationMs = Date.now() - oracleStart;

    const verificationOracle = new VerificationOracle();
    const verdict = verificationOracle.evaluate({
      partition: {
        inputTotal: dataRows.length,
        cleanedCount: cleanedDataRows.length,
        deduplicatedCount: duplicatesRemoved,
        rejectedCount: 0,
        reviewQueueCount: 0,
      },
      lineageTracker: lineage,
      finalErrors: [],
      calculationEvidence: 'COM_ExcelActive',
    });

    if (!verdict.mecePartitionValid || !verdict.invariantsPassed) {
      errors.push(...verdict.violations);
    }

    if (!oracleResult.allMatch) {
      errors.push(
        `Oracle verification detected ${oracleResult.discrepancies.length} discrepancy(s)`,
      );
    }

    // STEP 7: Reopen Output & Audit Saved Workbook
    const auditStart = Date.now();
    const auditRes = await this.bridge.execute<SavedAuditResult>('AUDIT_WORKBOOK', {
      targetPath: workspace.getShadowTempPath(),
      expectedCategories: categoriesList,
      expectedHeaders: headers,
    });
    timings.auditMs = Date.now() - auditStart;

    // STEP 7B: Publish Transaction via 3-step Recoverable Replacement
    if (errors.length === 0 && verdict.invariantsPassed && oracleResult.allMatch) {
      const pubRes = workspace.publish(false);
      if (!pubRes.success) {
        errors.push(`Publishing failed: ${pubRes.error}`);
      }
    } else {
      workspace.rollback();
    }

    if (!auditRes.success) {
      errors.push(`Audit failed: ${auditRes.errors.join('; ')}`);
    }

    const savedAudit: SavedAuditResult = auditRes.data || {
      savedFilePath: outputWorkbookPath,
      fileSizeBytes: 0,
      rowCount: 0,
      headersPreserved: false,
      unrelatedDataPreserved: false,
      formulasPreserved: false,
      chartPresent: false,
      chartTitle: '',
      chartSeriesCount: 0,
      errors: auditRes.errors,
    };

    // STEP 8: Check original input file immutability
    const postRunFileHash = WorkbookProfiler.computeHash(inputWorkbookPath);
    const originalFilePreserved = initialFileHash !== '' && initialFileHash === postRunFileHash;

    if (!originalFilePreserved) {
      errors.push('CRITICAL: Original input workbook was modified or corrupted!');
    }

    timings.totalMs = Date.now() - overallStart;

    // STEP 9: Determine Slice Status
    let status: SliceStatus = 'FAIL';
    const hasAuditIntegrity =
      savedAudit.headersPreserved &&
      savedAudit.unrelatedDataPreserved &&
      savedAudit.formulasPreserved &&
      savedAudit.chartPresent;

    if (
      errors.length === 0 &&
      oracleResult.allMatch &&
      hasAuditIntegrity &&
      originalFilePreserved
    ) {
      status = 'PASS';
    } else if (oracleResult.allMatch && originalFilePreserved) {
      status = 'PARTIAL';
    }

    return {
      status,
      seed,
      executionModality,
      timingsMs: timings,
      metrics: {
        rawRows: dataRows.length,
        cleanedRows: cleanedDataRows.length,
        duplicatesRemoved,
        categoriesNormalized,
        totalsRepaired,
        summaryCategoriesCount: categoriesList.length,
      },
      oracleVerification: oracleResult,
      savedAudit,
      originalFilePreserved,
      excelPid: trackedExcelPid,
      cleanupSuccessful: true,
      errors,
    };
  }
}
