/**
 * ORBIT Excel Specialist - Core Types & Schemas
 * Strictly schema-validated, typed contracts for Excel operations.
 */

export type ExecutionModality = 'NATIVE_EXCEL_COM' | 'HEADLESS_LIBRARY' | 'MULTIMODAL_GUI';

export type SliceStatus = 'PASS' | 'PARTIAL' | 'FAIL';

export interface DataQualityRules {
  trimWhitespace: boolean;
  normalizeCategoryCasing: boolean;
  recomputeInvalidTotals: boolean;
  deduplicateByField: string;
}

export interface SyntheticDefectConfig {
  whitespaceCategoryCount: number;
  casingCategoryCount: number;
  invalidTotalCount: number;
  duplicateOrderCount: number;
}

export interface SalesRecord {
  orderId: string;
  date: string;
  category: string;
  region: string;
  units: number;
  unitPrice: number;
  total: number;
}

export interface GeneratorGroundTruth {
  seed: number;
  totalRowsGenerated: number;
  cleanRowCountExpected: number;
  injectedWhitespaceCount: number;
  injectedCasingCount: number;
  injectedInvalidTotalCount: number;
  injectedDuplicateCount: number;
  uniqueCategories: string[];
}

export interface WorkbookInspectionResult {
  filePath: string;
  sheetNames: string[];
  activeSheet: string;
  usedRangeAddress: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  formulaErrorCount: number;
  isLocked: boolean;
}

export interface CategorySummaryRecord {
  category: string;
  totalSales: number;
  averageUnits: number;
  totalSalesFormula: string;
  averageUnitsFormula: string;
}

export interface OracleVerificationResult {
  allMatch: boolean;
  categoryCountMatch: boolean;
  toleranceUsed: number;
  discrepancies: Array<{
    category: string;
    field: string;
    excelValue: number;
    oracleValue: number;
    diff: number;
  }>;
}

export interface SavedAuditResult {
  savedFilePath: string;
  fileSizeBytes: number;
  rowCount: number;
  headersPreserved: boolean;
  unrelatedDataPreserved: boolean;
  formulasPreserved: boolean;
  chartPresent: boolean;
  chartTitle: string;
  chartSeriesCount: number;
  errors: string[];
}

export interface VerticalSliceReport {
  status: SliceStatus;
  seed: number;
  executionModality: ExecutionModality;
  timingsMs: {
    generationMs: number;
    inspectionMs: number;
    cleaningMs: number;
    calculationMs: number;
    oracleVerificationMs: number;
    chartCreationMs: number;
    saveMs: number;
    auditMs: number;
    totalMs: number;
  };
  metrics: {
    rawRows: number;
    cleanedRows: number;
    duplicatesRemoved: number;
    categoriesNormalized: number;
    totalsRepaired: number;
    summaryCategoriesCount: number;
  };
  oracleVerification: OracleVerificationResult;
  savedAudit: SavedAuditResult;
  originalFilePreserved: boolean;
  excelPid: number | null;
  cleanupSuccessful: boolean;
  errors: string[];
}
