import * as fs from 'fs';
import * as path from 'path';
import { RecoveryJournal } from './recoveryJournal';

export interface PublishResult {
  success: boolean;
  publishedPath: string;
  isFallbackName: boolean;
  backupPath?: string;
  error?: string;
}

/**
 * Transactional Workspace for Excel Operations.
 * Enforces same-volume shadow working files and recoverable replacements.
 */
export class TransactionalWorkspace {
  private targetPath: string;
  private targetDir: string;
  private shadowTempPath: string;
  private backupPath: string;
  private journal: RecoveryJournal;

  constructor(targetFilePath: string) {
    this.targetPath = path.resolve(targetFilePath);
    this.targetDir = path.dirname(this.targetPath);

    if (!fs.existsSync(this.targetDir)) {
      fs.mkdirSync(this.targetDir, { recursive: true });
    }

    const rand = Math.floor(Math.random() * 1000000);
    const ext = path.extname(this.targetPath) || '.xlsx';
    const base = path.basename(this.targetPath, ext);

    // Guaranteed same volume as target (same directory)
    this.shadowTempPath = path.join(this.targetDir, `.orbit_tmp_${Date.now()}_${rand}${ext}`);
    this.backupPath = path.join(this.targetDir, `${base}.orbit_bak`);
    this.journal = new RecoveryJournal(this.targetDir);
  }

  public getTargetPath(): string {
    return this.targetPath;
  }

  public getShadowTempPath(): string {
    return this.shadowTempPath;
  }

  public getBackupPath(): string {
    return this.backupPath;
  }

  /**
   * Safe Publish Routine:
   * 1. Uses RecoveryJournal to track swap state durably.
   * 2. Executes 3-step replacement if target exists, or direct atomic rename if new.
   * 3. Catches file-locks (EBUSY / EPERM) and falls back to a non-colliding timestamped name.
   */
  public publish(retainBackup: boolean = false): PublishResult {
    if (!fs.existsSync(this.shadowTempPath)) {
      return {
        success: false,
        publishedPath: this.targetPath,
        isFallbackName: false,
        error: `Shadow temporary file not found: ${this.shadowTempPath}`,
      };
    }

    this.journal.beginSwap(this.targetPath, this.shadowTempPath, this.backupPath);

    // Case A: Target does not exist yet -> Direct rename
    if (!fs.existsSync(this.targetPath)) {
      try {
        fs.renameSync(this.shadowTempPath, this.targetPath);
        this.journal.finish();
        return {
          success: true,
          publishedPath: this.targetPath,
          isFallbackName: false,
        };
      } catch (err: any) {
        // If rename fails (e.g. permission/lock), try fallback name
        return this.publishWithFallbackName(err?.message || String(err));
      }
    }

    // Case B: Target exists -> 3-Step Recoverable Replacement
    try {
      // Step 1: Target -> Backup
      if (fs.existsSync(this.backupPath)) {
        try {
          fs.unlinkSync(this.backupPath);
        } catch {
          // Ignore
        }
      }
      fs.renameSync(this.targetPath, this.backupPath);
      this.journal.updateState('BACKUP_CREATED');

      // Step 2: ShadowTemp -> Target
      fs.renameSync(this.shadowTempPath, this.targetPath);
      this.journal.updateState('SWAP_COMPLETED');

      // Step 3: Unlink or retain backup
      if (!retainBackup) {
        try {
          fs.unlinkSync(this.backupPath);
        } catch {
          // Non-critical
        }
      }

      this.journal.finish();
      return {
        success: true,
        publishedPath: this.targetPath,
        isFallbackName: false,
        backupPath: retainBackup ? this.backupPath : undefined,
      };
    } catch (swapErr: any) {
      // Rollback Step 1: Restore backup -> Target if needed
      if (!fs.existsSync(this.targetPath) && fs.existsSync(this.backupPath)) {
        try {
          fs.renameSync(this.backupPath, this.targetPath);
        } catch {
          // Force recovery
          RecoveryJournal.executeStartupRecovery(this.targetDir);
        }
      }

      // Safe Fallback: Save to unique non-colliding path
      return this.publishWithFallbackName(swapErr?.message || String(swapErr));
    }
  }

  /**
   * Resilient fallback if target is locked by Windows or Excel.
   */
  private publishWithFallbackName(originalError: string): PublishResult {
    const ext = path.extname(this.targetPath) || '.xlsx';
    const base = path.basename(this.targetPath, ext);
    const fallbackPath = path.join(this.targetDir, `${base}_(AutoSaved_${Date.now()})${ext}`);

    try {
      if (fs.existsSync(this.shadowTempPath)) {
        fs.renameSync(this.shadowTempPath, fallbackPath);
      }
      this.journal.finish();
      return {
        success: true,
        publishedPath: fallbackPath,
        isFallbackName: true,
        error: `Original target was locked (${originalError}). Published to safe fallback name.`,
      };
    } catch (fallbackErr: any) {
      this.journal.finish();
      return {
        success: false,
        publishedPath: this.targetPath,
        isFallbackName: false,
        error: `Fatal publish failure: ${fallbackErr?.message || fallbackErr}`,
      };
    }
  }

  /**
   * Transaction Rollback on Verification Failure.
   * Cleans up shadow working files, leaving target file 100% untouched.
   */
  public rollback(): void {
    if (fs.existsSync(this.shadowTempPath)) {
      try {
        fs.unlinkSync(this.shadowTempPath);
      } catch {
        // Ignore
      }
    }
    this.journal.finish();
  }
}
