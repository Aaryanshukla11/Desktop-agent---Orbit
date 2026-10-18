/**
 * ORBIT Excel Specialist — Formula AST Analyzer & Guarded Repair Engine (Level 3)
 * Tokenizes Excel formulas, traces dependency references, detects broken references (#REF!, #VALUE!),
 * and enforces the 5-Guard Policy before applying deterministic repairs.
 */

export interface FormulaToken {
  type: 'FUNCTION' | 'RANGE' | 'CELL_REF' | 'ERROR_REF' | 'OPERATOR' | 'LITERAL' | 'PAREN';
  value: string;
}

export interface FormulaParseResult {
  rawFormula: string;
  tokens: FormulaToken[];
  functionsUsed: string[];
  referencedCells: string[];
  referencedRanges: string[];
  errorTokens: string[];
  hasExternalReferences: boolean;
  isSyntacticallyValid: boolean;
}

export interface RepairGuardContext {
  isTaskScopeAuthorized: boolean;
  isCellProtected: boolean;
  adjacentFormulas: string[]; // At least 3 contiguous formulas from neighboring rows
  sheetName: string;
  cellAddress: string;
}

export interface FormulaRepairDecision {
  canRepair: boolean;
  repairedFormula?: string;
  decisionReason: string;
  requiresReview: boolean;
  guardViolations: string[];
}

export class FormulaAstAnalyzer {
  private supportedFunctions = new Set([
    'SUM',
    'AVERAGE',
    'COUNT',
    'COUNTA',
    'COUNTIF',
    'COUNTIFS',
    'SUMIF',
    'SUMIFS',
    'AVERAGEIF',
    'AVERAGEIFS',
    'IF',
    'IFS',
    'VLOOKUP',
    'XLOOKUP',
    'INDEX',
    'MATCH',
    'MAX',
    'MIN',
    'ROUND',
    'SUBTOTAL',
  ]);

  /**
   * Tokenizes an Excel formula string into typed AST tokens.
   */
  public parse(formula: string): FormulaParseResult {
    const raw = formula.trim().startsWith('=') ? formula.trim().slice(1) : formula.trim();
    const tokens: FormulaToken[] = [];
    const functionsUsed: string[] = [];
    const referencedCells: string[] = [];
    const referencedRanges: string[] = [];
    const errorTokens: string[] = [];
    let hasExternalReferences = false;

    // Regex token patterns
    const externalPattern = /\[[^\]]+\.xlsx?\]/i;
    if (externalPattern.test(raw)) {
      hasExternalReferences = true;
    }

    const tokenRegex =
      /(#(?:REF!|VALUE!|DIV\/0!|N\/A|NAME\?|NUM!|NULL!))|([A-Za-z_][A-Za-z0-9_.]*(?=\())|('(?:[^']|'')*'![A-Za-z0-9_$:]+|[A-Za-z_0-9]+![A-Za-z0-9_$:]+|\$?[A-Za-z]+\$?[0-9]+:\$?[A-Za-z]+\$?[0-9]+)|(\$?[A-Za-z]+\$?[0-9]+)|([+\-*/^&=><]+)|([(),])|("[^"]*"|\d+(?:\.\d+)?)/g;

    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(raw)) !== null) {
      const [_full, errMatch, fnMatch, rangeMatch, cellMatch, opMatch, parenMatch, litMatch] = match;

      if (errMatch) {
        tokens.push({ type: 'ERROR_REF', value: errMatch.toUpperCase() });
        errorTokens.push(errMatch.toUpperCase());
      } else if (fnMatch) {
        const fnName = fnMatch.toUpperCase();
        tokens.push({ type: 'FUNCTION', value: fnName });
        functionsUsed.push(fnName);
      } else if (rangeMatch) {
        tokens.push({ type: 'RANGE', value: rangeMatch });
        referencedRanges.push(rangeMatch);
      } else if (cellMatch) {
        tokens.push({ type: 'CELL_REF', value: cellMatch });
        referencedCells.push(cellMatch);
      } else if (opMatch) {
        tokens.push({ type: 'OPERATOR', value: opMatch });
      } else if (parenMatch) {
        tokens.push({ type: 'PAREN', value: parenMatch });
      } else if (litMatch) {
        tokens.push({ type: 'LITERAL', value: litMatch });
      }
    }

    return {
      rawFormula: formula,
      tokens,
      functionsUsed,
      referencedCells,
      referencedRanges,
      errorTokens,
      hasExternalReferences,
      isSyntacticallyValid: tokens.length > 0,
    };
  }

  /**
   * Applies the 5-Guard Policy to decide whether a broken formula can be repaired deterministically.
   */
  public evaluateGuards(
    brokenFormula: string,
    context: RepairGuardContext,
    targetRowIndex: number,
  ): FormulaRepairDecision {
    const parsed = this.parse(brokenFormula);
    const guardViolations: string[] = [];

    // Guard 1: Task Scope Authorization
    if (!context.isTaskScopeAuthorized) {
      guardViolations.push('Guard 1 Violated: Formula repair not explicitly authorized in user task scope.');
    }

    // Guard 2: Cell Protection State
    if (context.isCellProtected) {
      guardViolations.push('Guard 2 Violated: Target cell or worksheet is protected/locked.');
    }

    // Guard 3: External Reference Exclusion
    if (parsed.hasExternalReferences) {
      guardViolations.push('Guard 3 Violated: Formula references external unopened workbooks.');
    }

    // Guard 4: Supported Function Set
    for (const fn of parsed.functionsUsed) {
      if (!this.supportedFunctions.has(fn)) {
        guardViolations.push(`Guard 4 Violated: Unsupported or custom function '${fn}' used.`);
      }
    }

    // Guard 5: Pattern Consistency across >= 3 adjacent formulas
    if (context.adjacentFormulas.length < 3) {
      guardViolations.push(
        `Guard 5 Violated: Insufficient adjacent formulas (found ${context.adjacentFormulas.length}, need >= 3).`,
      );
    }

    if (guardViolations.length > 0) {
      return {
        canRepair: false,
        decisionReason: guardViolations.join('; '),
        requiresReview: true,
        guardViolations,
      };
    }

    // Attempt Deterministic Pattern Translation:
    // Extract common pattern from adjacent formulas (e.g. "=C4*D4", "=C5*D5", "=C6*D6")
    const adjacentParsed = context.adjacentFormulas.map((f) => this.parse(f));
    const firstPattern = this.normalizeToPattern(adjacentParsed[0].rawFormula);

    const isConsistent = adjacentParsed.every(
      (p) => this.normalizeToPattern(p.rawFormula) === firstPattern,
    );

    if (!isConsistent) {
      return {
        canRepair: false,
        decisionReason: 'Adjacent formulas do not share an identical structural pattern.',
        requiresReview: true,
        guardViolations: ['Adjacent pattern drift detected.'],
      };
    }

    // Translate pattern to target row index
    const repaired = this.instantiatePattern(firstPattern, targetRowIndex);

    return {
      canRepair: true,
      repairedFormula: repaired,
      decisionReason: `Repaired via deterministic pattern consistency from ${context.adjacentFormulas.length} adjacent rows.`,
      requiresReview: false,
      guardViolations: [],
    };
  }

  /**
   * Replaces row numbers in cell references with a generic row token {ROW}.
   */
  private normalizeToPattern(formula: string): string {
    return formula.replace(/(\$?[A-Za-z]+)\$?(\d+)/g, '$1{ROW}');
  }

  /**
   * Re-instantiates formula pattern with target row index.
   */
  private instantiatePattern(pattern: string, rowIndex: number): string {
    return pattern.replace(/\{ROW\}/g, String(rowIndex));
  }
}
