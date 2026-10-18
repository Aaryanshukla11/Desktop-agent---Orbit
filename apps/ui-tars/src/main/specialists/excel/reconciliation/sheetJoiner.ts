/**
 * ORBIT Excel Specialist — Multi-Sheet Relational Join Engine (Level 2)
 * Executes typed relational joins (Inner, Left, Right, Full Outer) across worksheets
 * with composite keys, cardinality assertions, and collision tracking.
 */

export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL_OUTER';
export type ExpectedCardinality = 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY';

export interface JoinSpec {
  leftSheetName: string;
  rightSheetName: string;
  leftHeaders: string[];
  rightHeaders: string[];
  leftKeyColumns: string[];
  rightKeyColumns: string[];
  joinType: JoinType;
  expectedCardinality?: ExpectedCardinality;
  prefixRightColumns?: string;
}

export interface JoinResult {
  combinedHeaders: string[];
  matchedRows: Array<Array<string | number | null>>;
  unmatchedLeftRows: Array<Array<string | number | null>>;
  unmatchedRightRows: Array<Array<string | number | null>>;
  cardinalityViolations: string[];
  leftDuplicateKeyCount: number;
  rightDuplicateKeyCount: number;
}

export class SheetJoiner {
  /**
   * Generates a composite hash key for a given row and key column indices.
   */
  private buildCompositeKey(row: Array<string | number | null>, keyIndices: number[]): string {
    return keyIndices
      .map((idx) => (row[idx] !== null && row[idx] !== undefined ? String(row[idx]).trim().toLowerCase() : ''))
      .join('§');
  }

  /**
   * Executes the relational join across two datasets.
   */
  public join(
    leftRows: Array<Array<string | number | null>>,
    rightRows: Array<Array<string | number | null>>,
    spec: JoinSpec,
  ): JoinResult {
    const leftKeyIndices = spec.leftKeyColumns.map((col) => {
      const idx = spec.leftHeaders.indexOf(col);
      if (idx === -1) throw new Error(`Join Column '${col}' not found in left sheet headers.`);
      return idx;
    });

    const rightKeyIndices = spec.rightKeyColumns.map((col) => {
      const idx = spec.rightHeaders.indexOf(col);
      if (idx === -1) throw new Error(`Join Column '${col}' not found in right sheet headers.`);
      return idx;
    });

    // Build Right Index Map: Key -> Array of right rows
    const rightMap = new Map<string, Array<{ row: Array<string | number | null>; index: number }>>();
    let rightDuplicateKeyCount = 0;

    rightRows.forEach((row, idx) => {
      const key = this.buildCompositeKey(row, rightKeyIndices);
      if (!rightMap.has(key)) {
        rightMap.set(key, []);
      } else {
        rightDuplicateKeyCount++;
      }
      rightMap.get(key)!.push({ row, index: idx });
    });

    // Right headers to include (exclude duplicate join key columns if named identically, or prefix)
    const rightIncludeIndices: number[] = [];
    const formattedRightHeaders: string[] = [];
    spec.rightHeaders.forEach((header, idx) => {
      const isRightKey = rightKeyIndices.includes(idx);
      if (isRightKey && spec.leftHeaders.includes(header) && !spec.prefixRightColumns) {
        // Exclude redundant join key column
        return;
      }
      rightIncludeIndices.push(idx);
      formattedRightHeaders.push(
        spec.prefixRightColumns ? `${spec.prefixRightColumns}_${header}` : header,
      );
    });

    const combinedHeaders = [...spec.leftHeaders, ...formattedRightHeaders];
    const rightEmptyPadding = new Array(rightIncludeIndices.length).fill(null);
    const leftEmptyPadding = new Array(spec.leftHeaders.length).fill(null);

    const matchedRows: Array<Array<string | number | null>> = [];
    const unmatchedLeftRows: Array<Array<string | number | null>> = [];
    const matchedRightIndices = new Set<number>();
    const cardinalityViolations: string[] = [];
    let leftDuplicateKeyCount = 0;
    const seenLeftKeys = new Set<string>();

    // Process Left Rows
    for (const leftRow of leftRows) {
      const key = this.buildCompositeKey(leftRow, leftKeyIndices);

      if (seenLeftKeys.has(key)) {
        leftDuplicateKeyCount++;
      }
      seenLeftKeys.add(key);

      const rightMatches = rightMap.get(key);

      if (rightMatches && rightMatches.length > 0) {
        // Cardinality checks
        if (
          spec.expectedCardinality === 'ONE_TO_ONE' &&
          (rightMatches.length > 1 || seenLeftKeys.size < leftDuplicateKeyCount)
        ) {
          cardinalityViolations.push(
            `Cardinality Violation: Expected ONE_TO_ONE, but key '${key}' matched ${rightMatches.length} right rows.`,
          );
        }

        for (const match of rightMatches) {
          matchedRightIndices.add(match.index);
          const rightExtracted = rightIncludeIndices.map((i) => match.row[i]);
          matchedRows.push([...leftRow, ...rightExtracted]);
        }
      } else {
        // Unmatched left row
        unmatchedLeftRows.push(leftRow);
        if (spec.joinType === 'LEFT' || spec.joinType === 'FULL_OUTER') {
          matchedRows.push([...leftRow, ...rightEmptyPadding]);
        }
      }
    }

    // Process Unmatched Right Rows
    const unmatchedRightRows: Array<Array<string | number | null>> = [];
    rightRows.forEach((row, idx) => {
      if (!matchedRightIndices.has(idx)) {
        unmatchedRightRows.push(row);
        if (spec.joinType === 'RIGHT' || spec.joinType === 'FULL_OUTER') {
          const rightExtracted = rightIncludeIndices.map((i) => row[i]);
          matchedRows.push([...leftEmptyPadding, ...rightExtracted]);
        }
      }
    });

    return {
      combinedHeaders,
      matchedRows,
      unmatchedLeftRows,
      unmatchedRightRows,
      cardinalityViolations,
      leftDuplicateKeyCount,
      rightDuplicateKeyCount,
    };
  }
}
