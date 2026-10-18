/**
 * ORBIT Excel Specialist — Tiered Commission Calculator & Compensation Engine (Level 4)
 * Calculates marginal tiered sales commission with quota attainment accelerators
 * and transaction-level audit trails.
 */

export interface CommissionTier {
  tierName: string;
  minSales: number;
  maxSales: number | null; // null represents unbounded upper limit
  rate: number; // e.g. 0.05 for 5%
}

export interface CommissionCalculationResult {
  repId: string;
  repName: string;
  totalSales: number;
  quota: number;
  attainmentPercentage: number;
  acceleratorApplied: boolean;
  totalCommission: number;
  tierBreakdown: Array<{
    tierName: string;
    taxableInTier: number;
    effectiveRate: number;
    commissionGenerated: number;
  }>;
}

export class CommissionCalculator {
  private defaultTiers: CommissionTier[] = [
    { tierName: 'Tier 1 (Base)', minSales: 0, maxSales: 50000, rate: 0.05 },
    { tierName: 'Tier 2 (Growth)', minSales: 50000, maxSales: 100000, rate: 0.08 },
    { tierName: 'Tier 3 (President Club)', minSales: 100000, maxSales: null, rate: 0.12 },
  ];

  /**
   * Computes marginal commission across tiers with optional quota accelerator.
   */
  public calculateRepCommission(params: {
    repId: string;
    repName: string;
    totalSales: number;
    quota: number;
    customTiers?: CommissionTier[];
    acceleratorMultiplier?: number; // e.g. 1.25 if attainment >= 1.0
  }): CommissionCalculationResult {
    const {
      repId,
      repName,
      totalSales,
      quota,
      customTiers = this.defaultTiers,
      acceleratorMultiplier = 1.25,
    } = params;

    const attainment = quota > 0 ? totalSales / quota : 1.0;
    const isAccelerated = attainment >= 1.0;

    let remainingSales = totalSales;
    let totalCommission = 0;
    const tierBreakdown: CommissionCalculationResult['tierBreakdown'] = [];

    for (const tier of customTiers) {
      if (remainingSales <= 0) break;

      const tierCapacity =
        tier.maxSales !== null ? tier.maxSales - tier.minSales : Infinity;

      const salesInThisTier = Math.min(remainingSales, tierCapacity);

      let effectiveRate = tier.rate;
      // Apply accelerator to Tier 3 if quota attained
      if (isAccelerated && tier.maxSales === null) {
        effectiveRate = parseFloat((tier.rate * acceleratorMultiplier).toFixed(4));
      }

      const commissionGenerated = parseFloat((salesInThisTier * effectiveRate).toFixed(2));
      totalCommission += commissionGenerated;

      tierBreakdown.push({
        tierName: tier.tierName,
        taxableInTier: salesInThisTier,
        effectiveRate,
        commissionGenerated,
      });

      remainingSales -= salesInThisTier;
    }

    return {
      repId,
      repName,
      totalSales,
      quota,
      attainmentPercentage: parseFloat((attainment * 100).toFixed(2)),
      acceleratorApplied: isAccelerated,
      totalCommission: parseFloat(totalCommission.toFixed(2)),
      tierBreakdown,
    };
  }
}
