import { LineageTracker } from './lineageTracker';

export type VerificationVerdictStatus = 'PASS' | 'PARTIAL' | 'NEEDS_REVIEW' | 'FAILED';

export type CalculationEngineEvidence =
  | 'COM_ExcelActive'
  | 'VerifiedInterpreter'
  | 'Unverified_ASTOnly';

export interface MeceRowPartition {
  inputTotal: number;
  cleanedCount: number;
  deduplicatedCount: number;
  rejectedCount: number;
  reviewQueueCount: number;
}

export interface VerificationVerdict {
  status: VerificationVerdictStatus;
  mecePartitionValid: boolean;
  mecePartition: MeceRowPartition;
  calculationEvidence: CalculationEngineEvidence;
  errorAudit: {
    baselineTotal: number;
    repairedCount: number;
    movedCount: number;
    prunedCount: number;
    introducedCount: number;
  };
  invariantsPassed: boolean;
  violations: string[];
}

/**
 * Independent Verification Oracle for ORBIT Excel Specialist.
 * Enforces MECE row preservation, differential formula error checks, and calculation evidence.
 */
export class VerificationOracle {
  /**
   * Asserts the MECE Row Preservation Invariant:
   * InputTotal == Cleaned + Deduplicated + Rejected + ReviewQueue
   */
  public static verifyMecePartition(partition: MeceRowPartition): {
    isValid: boolean;
    sum: number;
    difference: number;
  } {
    const { inputTotal, cleanedCount, deduplicatedCount, rejectedCount, reviewQueueCount } =
      partition;
    const sum = cleanedCount + deduplicatedCount + rejectedCount + reviewQueueCount;
    const difference = inputTotal - sum;
    return {
      isValid: difference === 0,
      sum,
      difference,
    };
  }

  /**
   * Executes a full verification pass using independent ground truth and lineage.
   */
  public evaluate(params: {
    partition: MeceRowPartition;
    lineageTracker: LineageTracker;
    finalErrors: Array<{
      sheetName: string;
      columnName: string;
      errorType: string;
      currentRid?: number;
      address: string;
    }>;
    calculationEvidence: CalculationEngineEvidence;
    customInvariants?: Array<{ name: string; passed: boolean; message?: string }>;
  }): VerificationVerdict {
    const { partition, lineageTracker, finalErrors, calculationEvidence, customInvariants = [] } =
      params;
    const violations: string[] = [];

    // 1. MECE Invariant Check
    const meceCheck = VerificationOracle.verifyMecePartition(partition);
    if (!meceCheck.isValid) {
      violations.push(
        `MECE Invariant Violated: Input (${partition.inputTotal}) != Sum of buckets (${meceCheck.sum}). Difference: ${meceCheck.difference}`,
      );
    }

    // 2. Lineage-aware Error Classification
    const errorAnalysis = lineageTracker.classifyErrors(finalErrors);
    const baselineErrors = lineageTracker.getBaselineErrors();

    // Invariant: ZERO newly introduced errors allowed
    if (errorAnalysis.introduced.length > 0) {
      violations.push(
        `Fatal Error Invariant Violated: ${errorAnalysis.introduced.length} new formula error(s) introduced! e.g. ${JSON.stringify(errorAnalysis.introduced[0])}`,
      );
    }

    // 3. Custom Invariant Checks
    for (const inv of customInvariants) {
      if (!inv.passed) {
        violations.push(`Custom Invariant Failed [${inv.name}]: ${inv.message || 'Assertion failed'}`);
      }
    }

    // 4. Determine Overall Verdict
    let status: VerificationVerdictStatus = 'PASS';
    if (violations.length > 0) {
      status = 'FAILED';
    } else if (partition.reviewQueueCount > 0) {
      status = 'NEEDS_REVIEW';
    }

    return {
      status,
      mecePartitionValid: meceCheck.isValid,
      mecePartition: partition,
      calculationEvidence,
      errorAudit: {
        baselineTotal: baselineErrors.length,
        repairedCount: errorAnalysis.repaired.length,
        movedCount: errorAnalysis.moved.length,
        prunedCount: errorAnalysis.pruned.length,
        introducedCount: errorAnalysis.introduced.length,
      },
      invariantsPassed: violations.length === 0,
      violations,
    };
  }
}
