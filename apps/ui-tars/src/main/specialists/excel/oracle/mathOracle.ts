import { CategorySummaryRecord, OracleVerificationResult } from '../types';

export class MathOracle {
  private tolerance: number = 0.001;

  /**
   * Independently computes expected summary aggregations directly from cleaned data rows.
   */
  public computeExpectedSummary(
    headers: string[],
    dataRows: Array<Array<string | number>>,
  ): Map<string, { totalSales: number; averageUnits: number; count: number }> {
    const categoryIdx = headers.indexOf('Category');
    const unitsIdx = headers.indexOf('Units');
    const totalIdx = headers.indexOf('Total');

    if (categoryIdx === -1 || unitsIdx === -1 || totalIdx === -1) {
      throw new Error(
        `MathOracle: Missing required columns in headers. Found: ${headers.join(', ')}`,
      );
    }

    const aggregations = new Map<
      string,
      { totalSales: number; totalUnits: number; count: number }
    >();

    for (const row of dataRows) {
      const cat = String(row[categoryIdx]).trim();
      const units = Number(row[unitsIdx]);
      const total = Number(row[totalIdx]);

      if (!aggregations.has(cat)) {
        aggregations.set(cat, { totalSales: 0, totalUnits: 0, count: 0 });
      }

      const current = aggregations.get(cat)!;
      current.totalSales += total;
      current.totalUnits += units;
      current.count += 1;
    }

    const expected = new Map<string, { totalSales: number; averageUnits: number; count: number }>();
    for (const [cat, agg] of aggregations.entries()) {
      expected.set(cat, {
        totalSales: parseFloat(agg.totalSales.toFixed(2)),
        averageUnits: parseFloat((agg.totalUnits / agg.count).toFixed(4)),
        count: agg.count,
      });
    }

    return expected;
  }

  /**
   * Verifies Excel COM calculated values against the independent oracle.
   */
  public verify(
    headers: string[],
    dataRows: Array<Array<string | number>>,
    excelSummary: CategorySummaryRecord[],
  ): OracleVerificationResult {
    const expected = this.computeExpectedSummary(headers, dataRows);
    const discrepancies: OracleVerificationResult['discrepancies'] = [];

    let categoryCountMatch = expected.size === excelSummary.length;

    for (const row of excelSummary) {
      const oracleData = expected.get(row.category);
      if (!oracleData) {
        discrepancies.push({
          category: row.category,
          field: 'CategoryExistence',
          excelValue: 1,
          oracleValue: 0,
          diff: 1,
        });
        continue;
      }

      // Check Total Sales
      const salesDiff = Math.abs(row.totalSales - oracleData.totalSales);
      if (salesDiff > this.tolerance) {
        discrepancies.push({
          category: row.category,
          field: 'TotalSales',
          excelValue: row.totalSales,
          oracleValue: oracleData.totalSales,
          diff: salesDiff,
        });
      }

      // Check Average Units
      const avgDiff = Math.abs(row.averageUnits - oracleData.averageUnits);
      if (avgDiff > this.tolerance) {
        discrepancies.push({
          category: row.category,
          field: 'AverageUnits',
          excelValue: row.averageUnits,
          oracleValue: oracleData.averageUnits,
          diff: avgDiff,
        });
      }

      // Verify Formula Semantics (must start with '=' and contain SUMIFS / AVERAGEIFS)
      if (!row.totalSalesFormula.toUpperCase().startsWith('=SUMIFS')) {
        discrepancies.push({
          category: row.category,
          field: 'TotalSalesFormulaSemantics',
          excelValue: 0,
          oracleValue: 1,
          diff: 1,
        });
      }
      if (!row.averageUnitsFormula.toUpperCase().startsWith('=AVERAGEIFS')) {
        discrepancies.push({
          category: row.category,
          field: 'AverageUnitsFormulaSemantics',
          excelValue: 0,
          oracleValue: 1,
          diff: 1,
        });
      }
    }

    return {
      allMatch: discrepancies.length === 0 && categoryCountMatch,
      categoryCountMatch,
      toleranceUsed: this.tolerance,
      discrepancies,
    };
  }
}
