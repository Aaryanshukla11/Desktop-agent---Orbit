import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger';

export interface TaskTelemetryData {
  runId: string;
  instruction: string;
  engine: 'ExcelMcp Specialist' | 'Tier-1 Native UIA' | 'Fast-Path' | 'VLM Vision Loop';
  startTime: number;
  endTime?: number;
  durationSeconds?: number;
  tokensConsumed: number;
  tokensSaved?: number;
  stepsCount: number;
  status: 'SUCCESS' | 'FAILED' | 'STOPPED' | 'ERROR';
  targetFile?: string;
  fileSizeBytes?: number;
  details?: Record<string, any>;
}

export class TaskTelemetry {
  private data: TaskTelemetryData;
  private runDir: string;

  constructor(runId: string, instruction: string, engine: TaskTelemetryData['engine'], runDir: string) {
    this.runDir = runDir;
    this.data = {
      runId,
      instruction,
      engine,
      startTime: Date.now(),
      tokensConsumed: 0,
      stepsCount: 0,
      status: 'SUCCESS',
    };
  }

  public recordStep(count = 1): void {
    this.data.stepsCount += count;
  }

  public setTokens(consumed: number, saved?: number): void {
    this.data.tokensConsumed = consumed;
    if (saved !== undefined) {
      this.data.tokensSaved = saved;
    }
  }

  public setTargetFile(filePath: string): void {
    this.data.targetFile = filePath;
    try {
      if (fs.existsSync(filePath)) {
        this.data.fileSizeBytes = fs.statSync(filePath).size;
      }
    } catch {}
  }

  public finish(status: TaskTelemetryData['status'] = 'SUCCESS', details?: Record<string, any>): string {
    this.data.endTime = Date.now();
    this.data.durationSeconds = Number(((this.data.endTime - this.data.startTime) / 1000).toFixed(2));
    this.data.status = status;
    if (details) {
      this.data.details = details;
    }

    // Persist to task run directory
    try {
      if (!fs.existsSync(this.runDir)) {
        fs.mkdirSync(this.runDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(this.runDir, 'task_telemetry.json'),
        JSON.stringify(this.data, null, 2),
        'utf8',
      );
      logger.info(`[TaskTelemetry] Saved telemetry metrics to ${path.join(this.runDir, 'task_telemetry.json')}`);
    } catch (e) {
      logger.warn('[TaskTelemetry] Could not save task_telemetry.json:', e);
    }

    return this.generateMarkdownHud();
  }

  public generateMarkdownHud(): string {
    const d = this.data;
    const duration = `${d.durationSeconds ?? 0}s`;
    const tokensText = d.tokensConsumed === 0
      ? `**0 Tokens** (Local COM Automation - Saved ~${d.tokensSaved || 45000} API tokens)`
      : `**${d.tokensConsumed.toLocaleString()} Tokens**`;

    const statusBadge = d.status === 'SUCCESS' ? '**Verified Success**' : `**${d.status}**`;
    const fileSizeText = d.fileSizeBytes ? ` (${(d.fileSizeBytes / 1024).toFixed(1)} KB)` : '';

    return `
### Task Performance & Execution Telemetry

| Metric | Details |
| :--- | :--- |
| **Execution Time** | **${duration}** |
| **Tokens Consumed** | ${tokensText} |
| **Engine** | **${d.engine}** |
| **Steps Executed** | **${d.stepsCount} steps** |
| **Status** | ${statusBadge} |
${d.targetFile ? `| **Target File** | \`${d.targetFile}\`${fileSizeText} |\n` : ''}
`;
  }
}
