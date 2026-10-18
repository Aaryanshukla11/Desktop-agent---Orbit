export type RowLineageStatus = 'ACTIVE' | 'DELETED' | 'SPLIT' | 'MERGED';

export interface RowLineageRecord {
  rid: number;
  status: RowLineageStatus;
  originalIndex: number;
  currentIndex: number;
  parentRids?: number[];
  childRids?: number[];
  deletionReason?: string;
}

export interface BaselineErrorRecord {
  errorType: '#REF!' | '#VALUE!' | '#N/A' | '#DIV/0!' | '#NAME?' | '#NUM!' | string;
  sourceRid: number;
  sheetName: string;
  columnName: string;
  originalAddress: string;
}

export type ErrorClassification =
  | 'BASELINE_INTACT'
  | 'BASELINE_MOVED'
  | 'BASELINE_PRUNED'
  | 'BASELINE_REPAIRED'
  | 'NEW_INTRODUCED';

/**
 * In-Memory Lineage & Operational Error Tracker.
 * Tracks record lifecycle across sorting, deletion, splits, and merges without leaking IDs into Excel cells.
 */
export class LineageTracker {
  private records: Map<number, RowLineageRecord> = new Map();
  private nextRid: number = 1;
  private baselineErrors: BaselineErrorRecord[] = [];

  /**
   * Initializes lineage from raw rows.
   */
  public ingest(rowCount: number): number[] {
    this.records.clear();
    const assignedRids: number[] = [];
    for (let i = 0; i < rowCount; i++) {
      const rid = this.nextRid++;
      this.records.set(rid, {
        rid,
        status: 'ACTIVE',
        originalIndex: i,
        currentIndex: i,
      });
      assignedRids.push(rid);
    }
    return assignedRids;
  }

  public getRecord(rid: number): RowLineageRecord | undefined {
    return this.records.get(rid);
  }

  public getAllActiveRecords(): RowLineageRecord[] {
    return Array.from(this.records.values()).filter((r) => r.status === 'ACTIVE');
  }

  /**
   * Reorders active records (e.g. following a sort).
   */
  public reorder(orderedRids: number[]): void {
    orderedRids.forEach((rid, newIdx) => {
      const rec = this.records.get(rid);
      if (rec && rec.status === 'ACTIVE') {
        rec.currentIndex = newIdx;
      }
    });
  }

  /**
   * Marks records as deleted (e.g. deduplication or rejection).
   */
  public delete(rids: number[], reason: string): void {
    for (const rid of rids) {
      const rec = this.records.get(rid);
      if (rec) {
        rec.status = 'DELETED';
        rec.deletionReason = reason;
      }
    }
  }

  /**
   * Splits a single record into multiple children.
   */
  public split(parentRid: number, childCount: number): number[] {
    const parent = this.records.get(parentRid);
    if (!parent) return [];

    parent.status = 'SPLIT';
    parent.childRids = [];

    const newChildren: number[] = [];
    for (let i = 0; i < childCount; i++) {
      const childRid = this.nextRid++;
      this.records.set(childRid, {
        rid: childRid,
        status: 'ACTIVE',
        originalIndex: parent.originalIndex,
        currentIndex: parent.currentIndex + i,
        parentRids: [parentRid],
      });
      parent.childRids.push(childRid);
      newChildren.push(childRid);
    }
    return newChildren;
  }

  /**
   * Merges multiple records into a single consolidated record.
   */
  public merge(sourceRids: number[]): number {
    const newRid = this.nextRid++;
    for (const rid of sourceRids) {
      const rec = this.records.get(rid);
      if (rec) {
        rec.status = 'MERGED';
      }
    }

    this.records.set(newRid, {
      rid: newRid,
      status: 'ACTIVE',
      originalIndex: this.records.get(sourceRids[0])?.originalIndex ?? 0,
      currentIndex: this.records.get(sourceRids[0])?.currentIndex ?? 0,
      parentRids: [...sourceRids],
    });

    return newRid;
  }

  /**
   * Registers a baseline error observed in the source file.
   */
  public registerBaselineError(error: BaselineErrorRecord): void {
    this.baselineErrors.push(error);
  }

  public getBaselineErrors(): BaselineErrorRecord[] {
    return [...this.baselineErrors];
  }

  /**
   * Compares final observed errors against lineage to classify them accurately.
   */
  public classifyErrors(
    finalObservedErrors: Array<{
      sheetName: string;
      columnName: string;
      errorType: string;
      currentRid?: number;
      address: string;
    }>,
  ): {
    intact: BaselineErrorRecord[];
    moved: Array<{ baseline: BaselineErrorRecord; newAddress: string }>;
    pruned: BaselineErrorRecord[];
    repaired: BaselineErrorRecord[];
    introduced: Array<{ sheetName: string; columnName: string; errorType: string; address: string }>;
  } {
    const intact: BaselineErrorRecord[] = [];
    const moved: Array<{ baseline: BaselineErrorRecord; newAddress: string }> = [];
    const pruned: BaselineErrorRecord[] = [];
    const repaired: BaselineErrorRecord[] = [];
    const introduced: Array<{ sheetName: string; columnName: string; errorType: string; address: string }> = [];

    // Map final errors by (currentRid, columnName, errorType)
    const finalMatched = new Set<number>();

    for (const baseErr of this.baselineErrors) {
      const rec = this.records.get(baseErr.sourceRid);

      // If record was deleted, baseline error was pruned with it
      if (!rec || rec.status === 'DELETED') {
        pruned.push(baseErr);
        continue;
      }

      // Check if this error is still observed in the final output
      const matchIdx = finalObservedErrors.findIndex(
        (f, idx) =>
          !finalMatched.has(idx) &&
          f.sheetName === baseErr.sheetName &&
          f.columnName === baseErr.columnName &&
          f.errorType === baseErr.errorType &&
          (f.currentRid === undefined || f.currentRid === baseErr.sourceRid),
      );

      if (matchIdx !== -1) {
        finalMatched.add(matchIdx);
        const finalMatch = finalObservedErrors[matchIdx];
        if (finalMatch.address === baseErr.originalAddress) {
          intact.push(baseErr);
        } else {
          moved.push({ baseline: baseErr, newAddress: finalMatch.address });
        }
      } else {
        // Not observed in final output and record is still active -> repaired!
        repaired.push(baseErr);
      }
    }

    // Any final error that wasn't matched to a baseline error is NEW (introduced)
    finalObservedErrors.forEach((f, idx) => {
      if (!finalMatched.has(idx)) {
        introduced.push({
          sheetName: f.sheetName,
          columnName: f.columnName,
          errorType: f.errorType,
          address: f.address,
        });
      }
    });

    return { intact, moved, pruned, repaired, introduced };
  }
}
