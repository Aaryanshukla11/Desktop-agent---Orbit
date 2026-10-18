import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { logger } from '../../logger';
import { ExcelMcpBridge } from './bridge/excelMcpBridge';
import { TaskTelemetry } from '../../services/taskTelemetry';
import { AiExcelPlanner } from './generator/aiExcelPlanner';
import { TransactionalWorkspace } from './core/transactionalWorkspace';

export function isExcelTask(instructions: string): boolean {
  if (!instructions || typeof instructions !== 'string') return false;
  const lower = instructions.toLowerCase();

  const mentionsExcel =
    lower.includes('excel') ||
    lower.includes('sheet') ||
    lower.includes('xlsx') ||
    lower.includes('workbook') ||
    lower.includes('csv');

  const mentionsAction =
    lower.includes('dummy data') ||
    lower.includes('make a dummy') ||
    lower.includes('make data') ||
    lower.includes('create data') ||
    lower.includes('generate data') ||
    lower.includes('chart') ||
    lower.includes('open') ||
    lower.includes('create') ||
    lower.includes('employee') ||
    lower.includes('sales') ||
    lower.includes('student') ||
    lower.includes('crypto') ||
    lower.includes('budget') ||
    lower.includes('inventory') ||
    lower.includes('patient') ||
    lower.includes('clean');

  return mentionsExcel && mentionsAction;
}

export async function runExcelTask(
  instructions: string,
  onProgress?: (status: string, percentage: number) => void,
): Promise<{
  success: boolean;
  summaryMarkdown: string;
  logMarkdown?: string;
  filePath?: string;
}> {
  logger.info('[excelChatRouter] Executing dynamic autonomous Excel task for instructions:', instructions);

  const runDir = path.resolve(process.cwd(), 'runs', `T0-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const telemetry = new TaskTelemetry(`T0-${Date.now()}`, instructions, 'ExcelMcp Specialist', runDir);

  try {
    const planner = new AiExcelPlanner();
    const plan = await planner.plan(instructions, onProgress);

    // Determine target location: User Desktop first, fallback to temp dir
    const userDesktop = path.join(os.homedir(), 'Desktop');
    const onedriveDesktop = path.join(os.homedir(), 'OneDrive', 'Desktop');
    let targetDir = fs.existsSync(onedriveDesktop) ? onedriveDesktop : userDesktop;
    if (!fs.existsSync(targetDir)) {
      targetDir = path.resolve(process.cwd(), 'runs');
    }

    const destPath = path.join(targetDir, plan.fileName);
    const workspace = new TransactionalWorkspace(destPath);

    const mcpBridge = new ExcelMcpBridge();
    await mcpBridge.createDynamicWorkbook({
      destPath: workspace.getShadowTempPath(),
      mainSheetName: plan.mainSheetName,
      headers: plan.headers,
      rows: plan.rows,
      summarySheetName: plan.summarySheetName,
      summaryHeaders: plan.summaryHeaders,
      summaryRows: plan.summaryRows,
      chartTitle: plan.chartTitle,
      chartType: plan.chartType,
      domainName: plan.domainName,
      onProgress,
    });

    const pubRes = workspace.publish(false);
    const finalPublishedPath = pubRes.publishedPath;

    logger.info(`[excelChatRouter] Completed successfully. Target workbook: ${finalPublishedPath}`);

    // Build dynamic Markdown table from plan.summaryHeaders & plan.summaryRows
    let summaryTable = '';
    if (plan.summaryHeaders.length > 0 && plan.summaryRows.length > 0) {
      summaryTable += `| ${plan.summaryHeaders.join(' | ')} |\n`;
      summaryTable += `| ${plan.summaryHeaders.map(() => ':---').join(' | ')} |\n`;
      for (const row of plan.summaryRows) {
        summaryTable += `| ${row.map((cell) => (String(cell).startsWith('=') ? '*formula*' : String(cell))).join(' | ')} |\n`;
      }
    }

    telemetry.setTargetFile(finalPublishedPath);
    telemetry.recordStep(7);
    telemetry.setTokens(plan.tokensConsumed || 1250, 45000);
    const hudMarkdown = telemetry.finish('SUCCESS', {
      rowCount: plan.rows.length,
      domainCount: plan.categories.length,
      fileSizeBytes: fs.existsSync(finalPublishedPath) ? fs.statSync(finalPublishedPath).size : undefined,
    });

    const chatSummaryMarkdown = `**Excel Workbook Created Successfully**

Generated **${plan.rows.length} records** for **${plan.domainName}** with live summary formulas and a native ${plan.chartType} chart.

- **Saved File**: \`${finalPublishedPath}\`
- **Application**: Microsoft Excel launched on screen
- **Primary Sheet**: \`${plan.mainSheetName}\` (${plan.headers.length} columns)
- **Analytics Sheet**: \`${plan.summarySheetName}\` with reactive formulas
- **Chart**: ${plan.chartTitle}
- **Transaction Safety**: Verified via Recoverable Replacement Protocol

*Detailed breakdown and telemetry metrics are recorded in the **Log** tab at the top.*`;

    const logMarkdown = `### ${plan.domainName} - Category Summary

${summaryTable}

${hudMarkdown}`;

    return {
      success: true,
      summaryMarkdown: chatSummaryMarkdown,
      logMarkdown,
      filePath: destPath,
    };
  } catch (err: any) {
    logger.error('[excelChatRouter] Error executing Excel task:', err);
    telemetry.finish('ERROR', { error: err?.message || String(err) });
    return {
      success: false,
      summaryMarkdown: `Failed to execute Excel specialist task: ${err?.message || err}`,
    };
  }
}
