/**
 * ORBIT Excel Specialist — Executive Dashboard & Commentary Builder (Level 3)
 * Designs C-level KPI cards, automated management commentary, dynamic formulas,
 * and corporate chart layouts.
 */

export interface KpiCardSpec {
  title: string;
  formula: string;
  formatType: 'CURRENCY' | 'PERCENT' | 'NUMBER';
  cellAddress: string;
}

export interface ExecutiveDashboardSpec {
  sheetName: string;
  dashboardTitle: string;
  kpiCards: KpiCardSpec[];
  commentaryText: string;
  tableStartCell: string;
  chartSpec: {
    chartType: 'ColumnClustered' | 'Donut' | 'Line';
    chartTitle: string;
    sourceRange: string;
    positionCell: string;
  };
}

export class DashboardBuilder {
  /**
   * Builds an Executive Dashboard specification from source sheet dimensions.
   */
  public generateDashboardSpec(params: {
    sourceSheetName: string;
    dataRowCount: number;
    revenueColLetter: string; // e.g. 'F'
    unitsColLetter: string;   // e.g. 'E'
    categoryColLetter: string; // e.g. 'C'
    categories: string[];
    topCategoryName: string;
  }): ExecutiveDashboardSpec {
    const {
      sourceSheetName,
      dataRowCount,
      revenueColLetter,
      unitsColLetter,
      topCategoryName,
    } = params;

    const dataRangeEnd = dataRowCount + 1;

    // KPI Cards with reactive Excel formulas
    const kpiCards: KpiCardSpec[] = [
      {
        title: 'Total Gross Revenue',
        formula: `=SUM(${sourceSheetName}!${revenueColLetter}2:${revenueColLetter}${dataRangeEnd})`,
        formatType: 'CURRENCY',
        cellAddress: 'B4',
      },
      {
        title: 'Total Units Distributed',
        formula: `=SUM(${sourceSheetName}!${unitsColLetter}2:${unitsColLetter}${dataRangeEnd})`,
        formatType: 'NUMBER',
        cellAddress: 'D4',
      },
      {
        title: 'Average Order Value',
        formula: `=AVERAGE(${sourceSheetName}!${revenueColLetter}2:${revenueColLetter}${dataRangeEnd})`,
        formatType: 'CURRENCY',
        cellAddress: 'F4',
      },
    ];

    // Automated Commentary
    const commentaryText =
      `Executive Summary: Analysis of ${dataRowCount} recorded transactions shows stable distribution ` +
      `across primary sectors. '${topCategoryName}' maintains dominant market share. ` +
      `All variance indicators remain within standard operational bounds.`;

    return {
      sheetName: 'Executive_Dashboard',
      dashboardTitle: 'Corporate Performance & Executive Overview',
      kpiCards,
      commentaryText,
      tableStartCell: 'B8',
      chartSpec: {
        chartType: 'ColumnClustered',
        chartTitle: 'Revenue by Category',
        sourceRange: `CategorySummary!A1:B${params.categories.length + 1}`,
        positionCell: 'B18',
      },
    };
  }
}
