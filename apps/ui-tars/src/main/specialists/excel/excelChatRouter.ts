import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { logger } from '../../logger';
import { ExcelMcpBridge } from './bridge/excelMcpBridge';
import { TaskTelemetry } from '../../services/taskTelemetry';
import { AiExcelPlanner } from './generator/aiExcelPlanner';
import { ExcelSessionManager } from './excelSessionManager';
import { ExcelContinuationEngine } from './excelContinuationEngine';

export function isExcelTask(instructions: string): boolean {
  if (!instructions || typeof instructions !== 'string') return false;
  const lower = instructions.toLowerCase();

  const mentionsExcelExplicit =
    lower.includes('excel') ||
    lower.includes('sheet') ||
    lower.includes('xlsx') ||
    lower.includes('workbook') ||
    lower.includes('csv') ||
    lower.includes('spreadsheet');

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

  // Case 1: Explicit standalone Excel task
  if (mentionsExcelExplicit && mentionsAction) {
    return true;
  }

  // Case 2: Multi-turn continuation task when an Excel session exists OR Excel process is currently active/running
  const hasSession = ExcelSessionManager.hasActiveSession();
  const excelIsRunning = ExcelSessionManager.isExcelRunning();

  if (hasSession || excelIsRunning) {
    // Exclude unrelated operations
    const isExplicitlyDifferent =
      (lower.includes('open chrome') ||
        lower.includes('open browser') ||
        lower.includes('youtube') ||
        lower.includes('google search') ||
        lower.includes('notepad')) &&
      !mentionsExcelExplicit;

    if (isExplicitlyDifferent) {
      return false;
    }

    const continuationKeywords = [
      'add',
      'column',
      'col',
      'bonus',
      'salary',
      'calculate',
      'sum',
      'total',
      'average',
      'avg',
      'mean',
      'highest',
      'lowest',
      'max',
      'min',
      'formula',
      'tax',
      'commission',
      'net',
      'gross',
      'deduct',
      'percent',
      'percentage',
      '%',
      'sort',
      'filter',
      'clean',
      'deduplicate',
      'duplicate',
      'trim',
      'normalize',
      'chart',
      'graph',
      'plot',
      'pie',
      'bar',
      'line',
      'distribution',
      'marks',
      'subject',
      'grade',
      'score',
      'attendance',
      'student',
      'update',
      'change',
      'replace',
      'insert',
      'delete',
      'remove',
      'append',
      'row',
      'record',
      'sheet',
      'table',
      // Hindi / Hinglish continuation patterns:
      'isme',
      'ismein',
      'usme',
      'usmein',
      'is sheet',
      'iss sheet',
      'is file',
      'ye data',
      'ab isme',
      'aur isme',
      'bhi add',
      'kardo',
      'kar do',
      'banao',
      'daalo',
      'dikhao',
      'badha do',
      'ghata do',
      'hata do',
      'rakho',
      'nikalo',
      'nikaalo',
    ];

    const hasContinuationKeyword = continuationKeywords.some((kw) => lower.includes(kw));
    if (hasContinuationKeyword) {
      logger.info(`[excelChatRouter] Contextual Excel continuation task detected for: "${instructions}"`);
      return true;
    }
  }

  return false;
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
  logger.info('[excelChatRouter] Executing autonomous Excel task for instructions:', instructions);

  const lower = instructions.toLowerCase();
  const activeSession = ExcelSessionManager.getActiveSession();

  // Check if this is a continuation on the active session
  const isExplicitNewCreation =
    (lower.includes('create a new') || lower.includes('create new') || lower.includes('fresh') || lower.includes('open new')) &&
    (lower.includes('sheet') || lower.includes('excel') || lower.includes('workbook') || lower.includes('file'));

  if (activeSession && !isExplicitNewCreation) {
    logger.info(`[excelChatRouter] Routing to ExcelContinuationEngine on active workbook: ${activeSession.filePath}`);
    try {
      const continuationEngine = new ExcelContinuationEngine();
      const res = await continuationEngine.executeContinuation(instructions, activeSession, onProgress);
      return {
        success: res.success,
        summaryMarkdown: res.summaryMarkdown,
        logMarkdown: res.logMarkdown,
        filePath: res.filePath,
      };
    } catch (contErr: any) {
      logger.warn('[excelChatRouter] Continuation engine encountered error, falling back to full planner:', contErr?.message || contErr);
    }
  }

  // Standard Creation Workflow
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

    const mcpBridge = new ExcelMcpBridge();
    await mcpBridge.createDynamicWorkbook({
      destPath,
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

    const finalPublishedPath = destPath;

    // Save active session for seamless continuation in subsequent chat turns
    ExcelSessionManager.setActiveSession({
      filePath: finalPublishedPath,
      fileName: plan.fileName,
      mainSheetName: plan.mainSheetName,
      headers: plan.headers,
      rowCount: plan.rows.length,
      lastUpdated: Date.now(),
      summarySheetName: plan.summarySheetName,
      chartTitle: plan.chartTitle,
      chartType: plan.chartType,
      domainName: plan.domainName,
    });

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
- **Active Session**: Session state preserved for follow-up continuation commands (e.g. *"ab isme bonus column add kar do"*, *"sort by salary"*, *"calculate average"*)

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
