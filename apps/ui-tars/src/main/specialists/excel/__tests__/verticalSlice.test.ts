import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { ExcelSliceRunner } from '../sliceRunner';
import { MathOracle } from '../oracle/mathOracle';

describe('ORBIT Excel Specialist — Vertical Slice Benchmark', () => {
  const testOutputDir = path.resolve(process.cwd(), 'temp_excel_slice_test');
  let runner: ExcelSliceRunner;

  beforeAll(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
    runner = new ExcelSliceRunner();
  });

  afterAll(() => {
    // Retain directory for inspection or clean up if needed
  });

  it('Step 1: Successfully executes single deterministic seed (Seed 42, 550 rows)', async () => {
    const report = await runner.executeSlice({
      seed: 42,
      rowCount: 550,
      workingDir: testOutputDir,
    });

    console.log('\n--- VERTICAL SLICE EVIDENCE REPORT (SEED 42) ---');
    console.log(`Status: ${report.status}`);
    console.log(`Execution Modality: ${report.executionModality}`);
    console.log(`Total Execution Time: ${report.timingsMs.totalMs}ms`);
    console.log(`Raw Rows: ${report.metrics.rawRows}, Cleaned Rows: ${report.metrics.cleanedRows}`);
    console.log(`Duplicates Removed: ${report.metrics.duplicatesRemoved}`);
    console.log(`Categories Normalized: ${report.metrics.categoriesNormalized}`);
    console.log(`Totals Repaired: ${report.metrics.totalsRepaired}`);
    console.log(`Oracle Verification Discrepancies: ${report.oracleVerification.discrepancies.length}`);
    console.log(`Chart Present: ${report.savedAudit.chartPresent} (${report.savedAudit.chartTitle})`);
    console.log(`Formulas Preserved: ${report.savedAudit.formulasPreserved}`);
    console.log(`Original File Preserved: ${report.originalFilePreserved}`);

    expect(report.status).toBe('PASS');
    expect(report.executionModality).toBe('NATIVE_EXCEL_COM');
    expect(report.originalFilePreserved).toBe(true);
    expect(report.oracleVerification.allMatch).toBe(true);
    expect(report.oracleVerification.discrepancies.length).toBe(0);
    expect(report.savedAudit.headersPreserved).toBe(true);
    expect(report.savedAudit.unrelatedDataPreserved).toBe(true);
    expect(report.savedAudit.formulasPreserved).toBe(true);
    expect(report.savedAudit.chartPresent).toBe(true);
    expect(report.savedAudit.chartSeriesCount).toBeGreaterThanOrEqual(1);
    expect(report.errors.length).toBe(0);
  }, 90000);

  it('Step 2: Independent Math Oracle rejects erroneous or corrupted calculations', () => {
    const oracle = new MathOracle();
    const headers = ['OrderID', 'Date', 'Category', 'Region', 'Units', 'UnitPrice', 'Total'];
    const dataRows = [
      ['ORD-1', '2024-01-01', 'Electronics', 'North', 10, 100, 1000],
      ['ORD-2', '2024-01-02', 'Electronics', 'South', 5, 100, 500],
      ['ORD-3', '2024-01-03', 'Furniture', 'East', 2, 250, 500],
    ];

    // Case A: Correct calculations and valid formulas
    const validSummary = [
      {
        category: 'Electronics',
        totalSales: 1500,
        averageUnits: 7.5,
        totalSalesFormula: '=SUMIFS(SalesData!G$2:G$4, SalesData!C$2:C$4, A2)',
        averageUnitsFormula: '=AVERAGEIFS(SalesData!E$2:E$4, SalesData!C$2:C$4, A2)',
      },
      {
        category: 'Furniture',
        totalSales: 500,
        averageUnits: 2,
        totalSalesFormula: '=SUMIFS(SalesData!G$2:G$4, SalesData!C$2:C$4, A3)',
        averageUnitsFormula: '=AVERAGEIFS(SalesData!E$2:E$4, SalesData!C$2:C$4, A3)',
      },
    ];

    const passRes = oracle.verify(headers, dataRows, validSummary);
    expect(passRes.allMatch).toBe(true);
    expect(passRes.discrepancies.length).toBe(0);

    // Case B: Corrupted value in calculation
    const corruptedValSummary = [
      {
        ...validSummary[0],
        totalSales: 99999, // incorrect value
      },
      validSummary[1],
    ];
    const failResVal = oracle.verify(headers, dataRows, corruptedValSummary);
    expect(failResVal.allMatch).toBe(false);
    expect(failResVal.discrepancies.some((d) => d.field === 'TotalSales')).toBe(true);

    // Case C: Missing formula semantics (static number instead of formula)
    const corruptedFormulaSummary = [
      {
        ...validSummary[0],
        totalSalesFormula: '1500', // not starting with =SUMIFS
      },
      validSummary[1],
    ];
    const failResForm = oracle.verify(headers, dataRows, corruptedFormulaSummary);
    expect(failResForm.allMatch).toBe(false);
    expect(
      failResForm.discrepancies.some((d) => d.field === 'TotalSalesFormulaSemantics'),
    ).toBe(true);
  });

  it('Step 3: Multi-seed benchmark across 5 varied datasets (500 to 2,000 rows)', async () => {
    const benchmarkConfigs = [
      { seed: 101, rowCount: 500 },
      { seed: 202, rowCount: 750 },
      { seed: 303, rowCount: 1000 },
      { seed: 404, rowCount: 1500 },
      { seed: 505, rowCount: 2000 },
    ];

    const results: Array<{
      seed: number;
      rowCount: number;
      status: string;
      timeMs: number;
    }> = [];

    for (const config of benchmarkConfigs) {
      console.log(`\nExecuting benchmark seed ${config.seed} (${config.rowCount} rows)...`);
      const report = await runner.executeSlice({
        seed: config.seed,
        rowCount: config.rowCount,
        workingDir: testOutputDir,
      });

      console.log(
        `Seed ${config.seed}: Status=${report.status}, OracleMatch=${report.oracleVerification.allMatch}, ChartPresent=${report.savedAudit.chartPresent}, Time=${report.timingsMs.totalMs}ms`,
      );

      expect(report.status).toBe('PASS');
      expect(report.oracleVerification.allMatch).toBe(true);
      expect(report.originalFilePreserved).toBe(true);
      expect(report.savedAudit.chartPresent).toBe(true);
      expect(report.savedAudit.formulasPreserved).toBe(true);

      results.push({
        seed: config.seed,
        rowCount: config.rowCount,
        status: report.status,
        timeMs: report.timingsMs.totalMs,
      });
    }

    console.log('\n--- 5-SEED BENCHMARK SUMMARY ---');
    console.table(results);
    expect(results.every((r) => r.status === 'PASS')).toBe(true);
  }, 300000);
});
