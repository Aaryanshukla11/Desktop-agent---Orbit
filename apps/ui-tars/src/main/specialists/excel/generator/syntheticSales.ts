import { GeneratorGroundTruth, SalesRecord } from '../types';

/**
 * Deterministic Seeded PRNG (Mulberry32)
 */
function createPrng(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2d79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SyntheticDataset {
  headers: string[];
  rawRows: Array<Array<string | number>>;
  groundTruth: GeneratorGroundTruth;
}

export class SyntheticSalesGenerator {
  private categories = ['Electronics', 'Furniture', 'Office Supplies', 'Apparel', 'Hardware'];
  private regions = ['North', 'South', 'East', 'West', 'Central'];

  /**
   * Generates a deterministic sales dataset with injected data-quality defects.
   */
  public generate(rowCount: number = 550, seed: number = 42): SyntheticDataset {
    if (rowCount < 500) {
      throw new Error(`Row count must be at least 500. Received: ${rowCount}`);
    }

    const rand = createPrng(seed);
    const records: SalesRecord[] = [];
    const headers = ['OrderID', 'Date', 'Category', 'Region', 'Units', 'UnitPrice', 'Total'];

    let injectedWhitespaceCount = 0;
    let injectedCasingCount = 0;
    let injectedInvalidTotalCount = 0;
    let injectedDuplicateCount = 0;

    const baseYear = 2024;

    for (let i = 1; i <= rowCount; i++) {
      const orderNum = 10000 + i;
      const orderId = `ORD-${orderNum}`;

      const day = 1 + Math.floor(rand() * 28);
      const month = 1 + Math.floor(rand() * 12);
      const dateStr = `${baseYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const catIdx = Math.floor(rand() * this.categories.length);
      let category = this.categories[catIdx];

      const regIdx = Math.floor(rand() * this.regions.length);
      const region = this.regions[regIdx];

      const units = 1 + Math.floor(rand() * 50);
      const unitPrice = parseFloat((10 + rand() * 190).toFixed(2));
      let total = parseFloat((units * unitPrice).toFixed(2));

      // Inject Defect 1: Whitespace in Category (~5% of rows)
      if (rand() < 0.05) {
        if (rand() > 0.5) {
          category = `  ${category}`;
        } else {
          category = `${category}   `;
        }
        injectedWhitespaceCount++;
      }

      // Inject Defect 2: Casing inconsistency (~5% of rows)
      if (rand() < 0.05) {
        category = rand() > 0.5 ? category.toLowerCase() : category.toUpperCase();
        injectedCasingCount++;
      }

      // Inject Defect 3: Invalid Total (~4% of rows)
      if (rand() < 0.04) {
        total = rand() > 0.5 ? 0 : parseFloat((total + 555.55).toFixed(2));
        injectedInvalidTotalCount++;
      }

      records.push({
        orderId,
        date: dateStr,
        category,
        region,
        units,
        unitPrice,
        total,
      });
    }

    // Inject Defect 4: Deliberate duplicates (~3% of rows duplicated from earlier rows)
    const duplicateTargetCount = Math.max(5, Math.floor(rowCount * 0.03));
    for (let d = 0; d < duplicateTargetCount; d++) {
      const sourceIdx = Math.floor(rand() * (records.length - 10));
      const dup = { ...records[sourceIdx] };
      records.push(dup);
      injectedDuplicateCount++;
    }

    // Convert to 2D array representation
    const rawRows = records.map((r) => [
      r.orderId,
      r.date,
      r.category,
      r.region,
      r.units,
      r.unitPrice,
      r.total,
    ]);

    const groundTruth: GeneratorGroundTruth = {
      seed,
      totalRowsGenerated: records.length,
      cleanRowCountExpected: records.length - injectedDuplicateCount,
      injectedWhitespaceCount,
      injectedCasingCount,
      injectedInvalidTotalCount,
      injectedDuplicateCount,
      uniqueCategories: [...this.categories].sort(),
    };

    return {
      headers,
      rawRows,
      groundTruth,
    };
  }
}
