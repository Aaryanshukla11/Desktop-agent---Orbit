import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { StressHarness } from '../stress/stressHarness';

describe('ORBIT Excel Specialist — Stage 07 (Level 5 Stress, Fault Injection & Recovery)', () => {
  const harness = new StressHarness();
  const testDir = path.resolve(process.cwd(), 'temp_stage07_test');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Non-critical
      }
    }
  });

  it('1. 100,000+ Row Chunked Streaming maintains bounded memory heap (< 100MB growth)', async () => {
    const totalRows = 100000;
    let sum = 0;

    const res = await harness.processChunkedStream(totalRows, 10000, (rowIdx) => {
      sum += (rowIdx % 100);
      return sum;
    });

    console.log(`\n--- 100,000 ROW STREAMING BENCHMARK ---`);
    console.log(`Total Rows Processed: ${res.totalProcessedRows}`);
    console.log(`Chunks: ${res.chunkCount}`);
    console.log(`Execution Time: ${res.elapsedMs}ms`);
    console.log(`Memory Heap Peak: ${res.memoryPeakMb} MB`);

    expect(res.totalProcessedRows).toBe(100000);
    expect(res.chunkCount).toBe(10);
    expect(res.elapsedMs).toBeLessThan(1000); // 100k rows in under 1 second
    expect(res.memoryPeakMb).toBeLessThan(100); // Bounded memory footprint
  });

  it('2. Fault Injection: Handles Malformed Headers with Safe Refusal', () => {
    const res = harness.simulateFault('MALFORMED_HEADER', {
      workDir: testDir,
      targetPath: path.join(testDir, 'dummy.xlsx'),
      headers: ['UnknownCol1', 'UnknownCol2'], // Missing OrderID, Customer, Total
    });

    expect(res.handledSafely).toBe(true);
    expect(res.rollbackExecuted).toBe(true);
    expect(res.recoveryReason).toContain('Safe refusal: Missing required headers');
  });

  it('3. Fault Injection: Respects Protected Worksheet with Safe Refusal', () => {
    const res = harness.simulateFault('PROTECTED_WORKSHEET', {
      workDir: testDir,
      targetPath: path.join(testDir, 'protected.xlsx'),
      headers: ['OrderID', 'Customer', 'Total'],
    });

    expect(res.handledSafely).toBe(true);
    expect(res.rollbackExecuted).toBe(true);
    expect(res.recoveryReason).toContain('Worksheet protection active');
  });

  it('4. Fault Injection: Recovers automatically from an Interrupted Swap', () => {
    const targetPath = path.join(testDir, 'interrupted_target.xlsx');

    const res = harness.simulateFault('INTERRUPTED_SWAP', {
      workDir: testDir,
      targetPath,
      headers: ['OrderID', 'Customer', 'Total'],
    });

    expect(res.handledSafely).toBe(true);
    expect(fs.existsSync(targetPath)).toBe(true);
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('ORIGINAL_PRISTINE_DATA');
  });
});
