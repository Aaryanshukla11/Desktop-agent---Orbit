import * as fs from 'fs';
import * as path from 'path';

export type JournalState =
  | 'INITIALIZED'
  | 'PENDING_SWAP'
  | 'BACKUP_CREATED'
  | 'SWAP_COMPLETED'
  | 'ROLLED_BACK';

export interface JournalPayload {
  version: 1;
  state: JournalState;
  targetPath: string;
  tempPath: string;
  backupPath: string;
  timestamp: number;
}

/**
 * Durable, Idempotent Recovery Journal for ORBIT Excel File Swaps.
 * Ensures crash resilience during non-atomic file replacement operations on Windows.
 */
export class RecoveryJournal {
  private journalPath: string;

  constructor(targetDir: string) {
    this.journalPath = path.resolve(targetDir, '.orbit_journal.json');
  }

  public getJournalPath(): string {
    return this.journalPath;
  }

  /**
   * Writes the journal payload to disk with durability (fsync).
   */
  private writeDurable(payload: JournalPayload): void {
    const serialized = JSON.stringify(payload, null, 2);
    const fd = fs.openSync(this.journalPath, 'w');
    try {
      fs.writeSync(fd, serialized);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * Initializes a new swap transaction journal.
   */
  public beginSwap(targetPath: string, tempPath: string, backupPath: string): JournalPayload {
    const payload: JournalPayload = {
      version: 1,
      state: 'PENDING_SWAP',
      targetPath: path.resolve(targetPath),
      tempPath: path.resolve(tempPath),
      backupPath: path.resolve(backupPath),
      timestamp: Date.now(),
    };
    this.writeDurable(payload);
    return payload;
  }

  /**
   * Updates state with fsync guarantee.
   */
  public updateState(state: JournalState): JournalPayload | null {
    const current = this.readJournal();
    if (!current) return null;

    current.state = state;
    current.timestamp = Date.now();
    this.writeDurable(current);
    return current;
  }

  /**
   * Reads existing journal if present.
   */
  public readJournal(): JournalPayload | null {
    if (!fs.existsSync(this.journalPath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(this.journalPath, 'utf8');
      return JSON.parse(content) as JournalPayload;
    } catch {
      return null;
    }
  }

  /**
   * Successfully concludes transaction and deletes journal.
   */
  public finish(): void {
    if (fs.existsSync(this.journalPath)) {
      try {
        fs.unlinkSync(this.journalPath);
      } catch {
        // Ignored if already removed
      }
    }
  }

  /**
   * Idempotent Disaster Recovery Routine.
   * Can be executed repeatedly upon startup or crash without corrupting data.
   */
  public static executeStartupRecovery(targetDir: string): {
    recovered: boolean;
    reason?: string;
    targetPath?: string;
  } {
    const journalFile = path.resolve(targetDir, '.orbit_journal.json');
    if (!fs.existsSync(journalFile)) {
      return { recovered: false, reason: 'NO_JOURNAL_FOUND' };
    }

    let payload: JournalPayload;
    try {
      const raw = fs.readFileSync(journalFile, 'utf8');
      payload = JSON.parse(raw);
    } catch (err: any) {
      return { recovered: false, reason: `CORRUPT_JOURNAL: ${err?.message || err}` };
    }

    const { targetPath, backupPath, tempPath, state } = payload;

    // Idempotent recovery logic:
    // If state is BACKUP_CREATED, target was renamed to backup, but swap did not complete.
    // If target does not exist and backup exists, restore backup -> target.
    if (state === 'BACKUP_CREATED') {
      if (!fs.existsSync(targetPath) && fs.existsSync(backupPath)) {
        try {
          fs.renameSync(backupPath, targetPath);
        } catch {
          // Fallback copy if cross-drive
          fs.copyFileSync(backupPath, targetPath);
          fs.unlinkSync(backupPath);
        }
      }
    }

    // Clean up temporary files safely
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Ignore
      }
    }

    // Clean up backup file if target exists and is valid
    if (fs.existsSync(targetPath) && fs.existsSync(backupPath)) {
      try {
        fs.unlinkSync(backupPath);
      } catch {
        // Ignore
      }
    }

    // Remove journal
    try {
      fs.unlinkSync(journalFile);
    } catch {
      // Ignore
    }

    return {
      recovered: true,
      reason: `RESTORED_FROM_${state}`,
      targetPath,
    };
  }
}
