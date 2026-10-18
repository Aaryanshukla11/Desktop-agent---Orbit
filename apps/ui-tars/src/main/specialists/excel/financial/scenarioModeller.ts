/**
 * ORBIT Excel Specialist — Financial Scenario Modeller & 3-Statement Builder (Level 4)
 * Generates dynamic 3-statement financial models with reactive interactive scenario toggles
 * (Base, Bull, Bear) and materiality variance drilldowns.
 */

export type ScenarioType = 'BASE' | 'BULL' | 'BEAR';

export interface FinancialAssumptions {
  revenueGrowthRate: number; // e.g. 0.08
  cogsPercentage: number;     // e.g. 0.60
  opexPercentage: number;     // e.g. 0.20
  taxRate: number;            // e.g. 0.21
}

export interface ScenarioModelSpec {
  scenarioToggleCell: string; // e.g. '$B$2'
  scenarios: Record<ScenarioType, FinancialAssumptions>;
  incomeStatementHeaders: string[];
  projectionYears: number[];
  balanceSheetInvariants: string[];
}

export interface StatementRow {
  lineItem: string;
  historicalValue: number;
  projectedBase: number;
  projectedBull: number;
  projectedBear: number;
  dynamicFormula: string;
}

export class ScenarioModeller {
  /**
   * Generates dynamic 3-statement model row definitions with Excel =CHOOSE formulas.
   */
  public generateProjectionRows(params: {
    historicalRevenue: number;
    scenarios: Record<ScenarioType, FinancialAssumptions>;
    toggleCell?: string;
  }): StatementRow[] {
    const { historicalRevenue, scenarios, toggleCell = '$B$2' } = params;

    const baseRev = Math.round(historicalRevenue * (1 + scenarios.BASE.revenueGrowthRate));
    const bullRev = Math.round(historicalRevenue * (1 + scenarios.BULL.revenueGrowthRate));
    const bearRev = Math.round(historicalRevenue * (1 + scenarios.BEAR.revenueGrowthRate));

    const rows: StatementRow[] = [
      {
        lineItem: 'Gross Revenue',
        historicalValue: historicalRevenue,
        projectedBase: baseRev,
        projectedBull: bullRev,
        projectedBear: bearRev,
        dynamicFormula: `=CHOOSE(${toggleCell}, ${baseRev}, ${bullRev}, ${bearRev})`,
      },
      {
        lineItem: 'Cost of Goods Sold (COGS)',
        historicalValue: Math.round(historicalRevenue * 0.62),
        projectedBase: Math.round(baseRev * scenarios.BASE.cogsPercentage),
        projectedBull: Math.round(bullRev * scenarios.BULL.cogsPercentage),
        projectedBear: Math.round(bearRev * scenarios.BEAR.cogsPercentage),
        dynamicFormula: `=CHOOSE(${toggleCell}, ${Math.round(baseRev * scenarios.BASE.cogsPercentage)}, ${Math.round(bullRev * scenarios.BULL.cogsPercentage)}, ${Math.round(bearRev * scenarios.BEAR.cogsPercentage)})`,
      },
      {
        lineItem: 'Gross Profit',
        historicalValue: Math.round(historicalRevenue * 0.38),
        projectedBase: Math.round(baseRev * (1 - scenarios.BASE.cogsPercentage)),
        projectedBull: Math.round(bullRev * (1 - scenarios.BULL.cogsPercentage)),
        projectedBear: Math.round(bearRev * (1 - scenarios.BEAR.cogsPercentage)),
        dynamicFormula: `=C5 - C6`, // Gross Revenue - COGS
      },
      {
        lineItem: 'Operating Expenses (OPEX)',
        historicalValue: Math.round(historicalRevenue * 0.22),
        projectedBase: Math.round(baseRev * scenarios.BASE.opexPercentage),
        projectedBull: Math.round(bullRev * scenarios.BULL.opexPercentage),
        projectedBear: Math.round(bearRev * scenarios.BEAR.opexPercentage),
        dynamicFormula: `=CHOOSE(${toggleCell}, ${Math.round(baseRev * scenarios.BASE.opexPercentage)}, ${Math.round(bullRev * scenarios.BULL.opexPercentage)}, ${Math.round(bearRev * scenarios.BEAR.opexPercentage)})`,
      },
      {
        lineItem: 'Operating Income (EBITDA)',
        historicalValue: Math.round(historicalRevenue * 0.16),
        projectedBase: Math.round(baseRev * (1 - scenarios.BASE.cogsPercentage - scenarios.BASE.opexPercentage)),
        projectedBull: Math.round(bullRev * (1 - scenarios.BULL.cogsPercentage - scenarios.BULL.opexPercentage)),
        projectedBear: Math.round(bearRev * (1 - scenarios.BEAR.cogsPercentage - scenarios.BEAR.opexPercentage)),
        dynamicFormula: `=C7 - C8`, // Gross Profit - OPEX
      },
    ];

    return rows;
  }

  /**
   * Budget vs Actual Variance Investigator:
   * Identifies material variances exceeding materiality threshold (e.g. 10% or $5,000).
   */
  public investigateVariance(lineItems: Array<{
    item: string;
    budgeted: number;
    actual: number;
  }>, thresholdPercentage: number = 0.10): Array<{
    item: string;
    budgeted: number;
    actual: number;
    varianceAmount: number;
    variancePercentage: number;
    isMaterial: boolean;
    flag: 'FAVORABLE' | 'UNFAVORABLE' | 'ON_TRACK';
  }> {
    return lineItems.map((li) => {
      const varianceAmount = parseFloat((li.actual - li.budgeted).toFixed(2));
      const variancePercentage = li.budgeted !== 0
        ? parseFloat((varianceAmount / li.budgeted).toFixed(4))
        : 0;

      const isMaterial = Math.abs(variancePercentage) >= thresholdPercentage;
      let flag: 'FAVORABLE' | 'UNFAVORABLE' | 'ON_TRACK' = 'ON_TRACK';

      if (isMaterial) {
        // For revenue line items: actual > budget is favorable; for costs: actual > budget is unfavorable
        const isCost = li.item.toLowerCase().includes('cost') || li.item.toLowerCase().includes('expense');
        if (isCost) {
          flag = varianceAmount > 0 ? 'UNFAVORABLE' : 'FAVORABLE';
        } else {
          flag = varianceAmount > 0 ? 'FAVORABLE' : 'UNFAVORABLE';
        }
      }

      return {
        item: li.item,
        budgeted: li.budgeted,
        actual: li.actual,
        varianceAmount,
        variancePercentage,
        isMaterial,
        flag,
      };
    });
  }
}
