import { describe, it, expect } from 'vitest';
import { FormulaAstAnalyzer } from '../formulas/formulaAstAnalyzer';
import { DashboardBuilder } from '../reporting/dashboardBuilder';

describe('ORBIT Excel Specialist — Stage 05 (Level 3 Formulas, AST Analysis & Reporting)', () => {
  const analyzer = new FormulaAstAnalyzer();
  const dashboard = new DashboardBuilder();

  it('1. FormulaAstAnalyzer tokenizes complex formula into typed AST tokens', () => {
    const formula = '=SUM(C2:C10) * (1 - D2) + XLOOKUP(A2, Products!A:A, Products!B:B)';
    const parsed = analyzer.parse(formula);

    expect(parsed.isSyntacticallyValid).toBe(true);
    expect(parsed.functionsUsed).toEqual(['SUM', 'XLOOKUP']);
    expect(parsed.referencedCells).toContain('D2');
    expect(parsed.referencedCells).toContain('A2');
    expect(parsed.referencedRanges).toContain('C2:C10');
    expect(parsed.hasExternalReferences).toBe(false);
    expect(parsed.errorTokens.length).toBe(0);
  });

  it('2. FormulaAstAnalyzer detects broken references (#REF! and #VALUE!)', () => {
    const brokenFormula = '=C5 * #REF! + #VALUE!';
    const parsed = analyzer.parse(brokenFormula);

    expect(parsed.errorTokens).toEqual(['#REF!', '#VALUE!']);
    expect(parsed.referencedCells).toContain('C5');
  });

  it('3. FormulaAstAnalyzer 5-Guard Policy blocks unauthorized, protected, or external repairs', () => {
    const brokenFormula = '=#REF! * 1.18';

    // Test Guard 1: Task scope not authorized -> BLOCKED
    const guard1Res = analyzer.evaluateGuards(
      brokenFormula,
      {
        isTaskScopeAuthorized: false,
        isCellProtected: false,
        adjacentFormulas: ['=D3 * 1.18', '=D4 * 1.18', '=D5 * 1.18'],
        sheetName: 'Invoices',
        cellAddress: 'E6',
      },
      6,
    );
    expect(guard1Res.canRepair).toBe(false);
    expect(guard1Res.guardViolations[0]).toContain('Guard 1 Violated');

    // Test Guard 2: Cell Protected -> BLOCKED
    const guard2Res = analyzer.evaluateGuards(
      brokenFormula,
      {
        isTaskScopeAuthorized: true,
        isCellProtected: true,
        adjacentFormulas: ['=D3 * 1.18', '=D4 * 1.18', '=D5 * 1.18'],
        sheetName: 'Invoices',
        cellAddress: 'E6',
      },
      6,
    );
    expect(guard2Res.canRepair).toBe(false);
    expect(guard2Res.guardViolations[0]).toContain('Guard 2 Violated');

    // Test Guard 3: External Reference -> BLOCKED
    const extFormula = '=[Budget2024.xlsx]Sheet1!#REF! * 1.18';
    const guard3Res = analyzer.evaluateGuards(
      extFormula,
      {
        isTaskScopeAuthorized: true,
        isCellProtected: false,
        adjacentFormulas: ['=D3 * 1.18', '=D4 * 1.18', '=D5 * 1.18'],
        sheetName: 'Invoices',
        cellAddress: 'E6',
      },
      6,
    );
    expect(guard3Res.canRepair).toBe(false);
    expect(guard3Res.guardViolations[0]).toContain('Guard 3 Violated');
  });

  it('4. FormulaAstAnalyzer deterministically repairs formula when all 5 guards pass', () => {
    const brokenFormula = '=#REF! * D6'; // target row is 6

    const repairRes = analyzer.evaluateGuards(
      brokenFormula,
      {
        isTaskScopeAuthorized: true,
        isCellProtected: false,
        adjacentFormulas: [
          '=C3 * D3',
          '=C4 * D4',
          '=C5 * D5', // 3 contiguous rows share identical pattern
        ],
        sheetName: 'Invoices',
        cellAddress: 'E6',
      },
      6, // target row index
    );

    expect(repairRes.canRepair).toBe(true);
    expect(repairRes.repairedFormula).toBe('=C6 * D6');
    expect(repairRes.requiresReview).toBe(false);
    expect(repairRes.guardViolations.length).toBe(0);
  });

  it('5. DashboardBuilder generates complete Executive Dashboard specification with KPI cards', () => {
    const spec = dashboard.generateDashboardSpec({
      sourceSheetName: 'SalesData',
      dataRowCount: 500,
      revenueColLetter: 'F',
      unitsColLetter: 'E',
      categoryColLetter: 'C',
      categories: ['Electronics', 'Furniture', 'Office Supplies'],
      topCategoryName: 'Electronics',
    });

    expect(spec.sheetName).toBe('Executive_Dashboard');
    expect(spec.kpiCards.length).toBe(3);
    expect(spec.kpiCards[0].title).toBe('Total Gross Revenue');
    expect(spec.kpiCards[0].formula).toBe('=SUM(SalesData!F2:F501)');
    expect(spec.chartSpec.chartType).toBe('ColumnClustered');
    expect(spec.commentaryText).toContain('Executive Summary');
  });
});
