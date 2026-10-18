import { describe, it, expect } from 'vitest';
import { ScenarioModeller } from '../financial/scenarioModeller';
import { CommissionCalculator } from '../financial/commissionCalculator';

describe('ORBIT Excel Specialist — Stage 06 (Level 4 Financial Workflows & Modelling)', () => {
  const modeller = new ScenarioModeller();
  const commissionCalc = new CommissionCalculator();

  it('1. ScenarioModeller generates reactive 3-statement model rows with =CHOOSE formulas', () => {
    const historicalRevenue = 1000000; // $1,000,000
    const scenarios = {
      BASE: { revenueGrowthRate: 0.08, cogsPercentage: 0.60, opexPercentage: 0.20, taxRate: 0.21 },
      BULL: { revenueGrowthRate: 0.15, cogsPercentage: 0.55, opexPercentage: 0.18, taxRate: 0.21 },
      BEAR: { revenueGrowthRate: -0.05, cogsPercentage: 0.68, opexPercentage: 0.25, taxRate: 0.21 },
    };

    const rows = modeller.generateProjectionRows({
      historicalRevenue,
      scenarios,
      toggleCell: '$B$2',
    });

    expect(rows.length).toBe(5);

    // Revenue line item checks
    const revRow = rows[0];
    expect(revRow.lineItem).toBe('Gross Revenue');
    expect(revRow.projectedBase).toBe(1080000); // 8% growth
    expect(revRow.projectedBull).toBe(1150000); // 15% growth
    expect(revRow.projectedBear).toBe(950000);  // -5% growth
    expect(revRow.dynamicFormula).toBe('=CHOOSE($B$2, 1080000, 1150000, 950000)');

    // Operating Income EBITDA checks
    const ebitdaRow = rows[4];
    expect(ebitdaRow.lineItem).toBe('Operating Income (EBITDA)');
    expect(ebitdaRow.projectedBase).toBe(216000); // 1080000 * (1 - 0.60 - 0.20) = 216,000
    expect(ebitdaRow.dynamicFormula).toBe('=C7 - C8');
  });

  it('2. ScenarioModeller detects material budget variances and flags favorable/unfavorable correctly', () => {
    const lineItems = [
      { item: 'Software Subscription Expense', budgeted: 10000, actual: 12500 }, // +25% cost -> UNFAVORABLE
      { item: 'Consulting Fees Expense', budgeted: 20000, actual: 18000 },       // -10% cost -> FAVORABLE
      { item: 'Enterprise Sales Revenue', budgeted: 50000, actual: 58000 },      // +16% revenue -> FAVORABLE
      { item: 'Office Supplies Expense', budgeted: 5000, actual: 5100 },         // +2% cost -> ON_TRACK (< 10%)
    ];

    const results = modeller.investigateVariance(lineItems, 0.10);

    expect(results.length).toBe(4);

    // Item 1: Material cost overrun
    expect(results[0].isMaterial).toBe(true);
    expect(results[0].flag).toBe('UNFAVORABLE');
    expect(results[0].varianceAmount).toBe(2500);

    // Item 2: Cost savings
    expect(results[1].isMaterial).toBe(true);
    expect(results[1].flag).toBe('FAVORABLE');

    // Item 3: Revenue upside
    expect(results[2].isMaterial).toBe(true);
    expect(results[2].flag).toBe('FAVORABLE');

    // Item 4: Below materiality threshold
    expect(results[3].isMaterial).toBe(false);
    expect(results[3].flag).toBe('ON_TRACK');
  });

  it('3. CommissionCalculator calculates marginal tiered commission and quota accelerator', () => {
    // Rep 1: Total Sales $120,000 with $100,000 Quota (Attainment = 120% -> Accelerator Applied!)
    // Tier 1 ($0 - $50k) @ 5% = $2,500
    // Tier 2 ($50k - $100k) @ 8% = $4,000
    // Tier 3 ($100k - $120k) = $20k @ (12% * 1.25 = 15%) = $3,000
    // Total = $2,500 + $4,000 + $3,000 = $9,500

    const repResult = commissionCalc.calculateRepCommission({
      repId: 'REP-001',
      repName: 'Aaryan Shukla',
      totalSales: 120000,
      quota: 100000,
      acceleratorMultiplier: 1.25,
    });

    expect(repResult.attainmentPercentage).toBe(120.0);
    expect(repResult.acceleratorApplied).toBe(true);
    expect(repResult.totalCommission).toBe(9500.0);

    expect(repResult.tierBreakdown.length).toBe(3);
    expect(repResult.tierBreakdown[0].commissionGenerated).toBe(2500);
    expect(repResult.tierBreakdown[1].commissionGenerated).toBe(4000);
    expect(repResult.tierBreakdown[2].effectiveRate).toBe(0.15); // accelerated!
    expect(repResult.tierBreakdown[2].commissionGenerated).toBe(3000);
  });
});
