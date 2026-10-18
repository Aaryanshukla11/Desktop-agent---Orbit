import fs from 'node:fs';
import { logger } from '../logger';
import { FastInputManager } from '../utils/fastInput';

export interface CheckpointVerification {
  isCheckpoint: boolean;
  verified: boolean;
  method: 'native_uia' | 'file_system' | 'visual_vlm' | 'none';
  details?: string;
  elapsedMs: number;
}

export class CheckpointVerifier {
  private static instance: CheckpointVerifier;
  private fastInput = FastInputManager.getInstance();

  public static getInstance(): CheckpointVerifier {
    if (!CheckpointVerifier.instance) {
      CheckpointVerifier.instance = new CheckpointVerifier();
    } 
    return CheckpointVerifier.instance;
  }

  /**
   * Determines if the given instruction or action represents a critical checkpoint
   * (e.g. Save, Compute/Equal, Submit, Delete, Create, Confirm).
   */
  public isCriticalCheckpoint(text: string): boolean {
    if (!text) return false;
    const lower = text.toLowerCase().trim();

    return (
      /\b(?:save|save\s+as|ctrl\s*\+\s*s|saved)\b/i.test(lower) ||
      /\b(?:calculate|compute|equals?|enter)\b/i.test(lower) ||
      lower.includes('=') ||
      /\b(?:submit|confirm|checkout|purchase|pay|send|publish)\b/i.test(lower) ||
      /\b(?:delete|remove|erase|format)\b/i.test(lower) ||
      /\b(?:create\s+folder|new\s+file|make\s+directory)\b/i.test(lower)
    );
  }

  /**
   * Fast Tier-1 Native Checkpoint Verification.
   * Verifies the state change using local Win32 / UIA / Filesystem inspection
   * without calling VLM Vision or consuming vision tokens.
   */
  public async verifyNative(
    instructionOrAction: string,
    options?: { windowTitle?: string; expectedFile?: string },
  ): Promise<CheckpointVerification> {
    const start = Date.now();
    const isCheckpoint = this.isCriticalCheckpoint(instructionOrAction);

    if (!isCheckpoint) {
      return {
        isCheckpoint: false,
        verified: true, // Non-checkpoint micro-steps pass through without delay
        method: 'none',
        elapsedMs: Date.now() - start,
      };
    }

    const lower = instructionOrAction.toLowerCase();

    // 1. Filesystem Verification: If expected file path is known or in text
    if (options?.expectedFile && fs.existsSync(options.expectedFile)) {
      logger.info(`[CheckpointVerifier] ✅ Verified file created on disk: ${options.expectedFile}`);
      return {
        isCheckpoint: true,
        verified: true,
        method: 'file_system',
        details: `File exists at ${options.expectedFile}`,
        elapsedMs: Date.now() - start,
      };
    }

    // Check for quoted filenames in the instruction: e.g. save as "notes.txt"
    const fileMatch = instructionOrAction.match(/["']([a-zA-Z0-9_\-\\/:.]+\.[a-zA-Z0-9]{2,5})["']/);
    if (fileMatch && fs.existsSync(fileMatch[1])) {
      logger.info(`[CheckpointVerifier] ✅ Verified file created on disk: ${fileMatch[1]}`);
      return {
        isCheckpoint: true,
        verified: true,
        method: 'file_system',
        details: `File exists at ${fileMatch[1]}`,
        elapsedMs: Date.now() - start,
      };
    }

    // 2. Calculator Computation Checkpoint: Verify result display element
    if (/\b(?:calculate|calc|compute|=|equals?)\b/i.test(lower)) {
      try {
        const resultEl = await this.fastInput.findElement('Result', {
          windowFilter: 'Calculator',
          timeoutMs: 150,
        });
        if (resultEl && resultEl.name) {
          logger.info(`[CheckpointVerifier] ✅ Calculator result verified natively: "${resultEl.name}"`);
          return {
            isCheckpoint: true,
            verified: true,
            method: 'native_uia',
            details: `Calculator display: ${resultEl.name}`,
            elapsedMs: Date.now() - start,
          };
        }
      } catch {}
    }

    // 3. Window State / Title Checkpoint: In Notepad, saved files change from "*Untitled" to clean title
    if (/\b(?:save|saved)\b/i.test(lower)) {
      try {
        const win = await this.fastInput.getActiveWindow();
        if (win && win.title && !win.title.startsWith('*')) {
          logger.info(`[CheckpointVerifier] ✅ Window title verified saved state: "${win.title}"`);
          return {
            isCheckpoint: true,
            verified: true,
            method: 'native_uia',
            details: `Active window clean title: ${win.title}`,
            elapsedMs: Date.now() - start,
          };
        }
      } catch {}
    }

    // 4. Modal Dialog Dismissal Checkpoint:
    // If Save/Cancel/OK was clicked, verify that no blocking dialog is open
    try {
      const focusedInfo = await this.fastInput.getFocusedInfo();
      if (focusedInfo && focusedInfo.state === 'normal') {
        return {
          isCheckpoint: true,
          verified: true,
          method: 'native_uia',
          details: `Active window in healthy focused state: ${focusedInfo.title}`,
          elapsedMs: Date.now() - start,
        };
      }
    } catch {}

    // Inconclusive native verification: requires visual VLM confirmation
    return {
      isCheckpoint: true,
      verified: false,
      method: 'visual_vlm',
      details: 'Native check inconclusive, visual verification recommended',
      elapsedMs: Date.now() - start,
    };
  }
}
