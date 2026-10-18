import path from 'node:path';
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { logger } from '../../../logger';

export interface ExcelMcpBatchCommand {
  command: string;
  args: Record<string, any>;
}

export interface ExcelMcpExecutionResult {
  success: boolean;
  destPath: string;
  employeeCount: number;
  domainCount: number;
  chartCreated: boolean;
  error?: string;
}

export interface ExcelDynamicWorkbookParams {
  destPath: string;
  mainSheetName: string;
  headers: string[];
  rows: (string | number)[][];
  summarySheetName?: string;
  summaryHeaders?: string[];
  summaryRows?: (string | number)[][];
  chartTitle?: string;
  chartType?: string;
  domainName?: string;
  onProgress?: (status: string, percentage: number) => void;
}

export class ExcelMcpBridge {
  private cliPath: string;

  constructor() {
    this.cliPath = this.resolveCliPath();
  }

  private resolveCliPath(): string {
    const candidatePaths = [
      path.resolve(process.cwd(), 'tools/excel-mcp/excelcli.exe'),
      path.resolve(__dirname, '../../../../../../tools/excel-mcp/excelcli.exe'),
      path.resolve(__dirname, '../../../../tools/excel-mcp/excelcli.exe'),
      path.resolve(process.resourcesPath || '', 'bin/excelcli.exe'),
      path.resolve(process.resourcesPath || '', 'tools/excel-mcp/excelcli.exe'),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        logger.info(`[ExcelMcpBridge] Found excelcli executable at: ${p}`);
        return p;
      }
    }

    throw new Error(
      `excelcli.exe not found. Searched paths:\n${candidatePaths.join('\n')}`,
    );
  }

  public async createDynamicWorkbook(params: ExcelDynamicWorkbookParams): Promise<ExcelMcpExecutionResult> {
    try {
      logger.info(`[ExcelMcpBridge] Starting Live Foreground Paced Automation for "${params.domainName || params.mainSheetName}"...`);
      return await this.executeLivePacedAutomation(params);
    } catch (liveErr: any) {
      logger.warn('[ExcelMcpBridge] Live automation encountered issue, falling back to batch execution:', liveErr?.message || liveErr);
      return await this.executeBatchAutomation(params);
    }
  }

  // Backward compatibility alias
  public async createEmployeeWorkbook(params: {
    destPath: string;
    headers: string[];
    rows: (string | number)[][];
    domains: string[];
    chartTitle?: string;
    onProgress?: (status: string, percentage: number) => void;
  }): Promise<ExcelMcpExecutionResult> {
    const rowCount = params.rows.length;
    const summaryHeaders = ['Department', 'Headcount', 'Avg Hourly Rate ($)', 'Total Monthly Payroll ($)'];
    const summaryRows: (string | number)[][] = [];
    for (const dom of params.domains) {
      summaryRows.push([
        dom,
        `=COUNTIF(EmployeeData!C2:C${rowCount + 1}, "${dom}")`,
        `=AVERAGEIF(EmployeeData!C2:C${rowCount + 1}, "${dom}", EmployeeData!F2:F${rowCount + 1})`,
        `=SUMIF(EmployeeData!C2:C${rowCount + 1}, "${dom}", EmployeeData!G2:G${rowCount + 1})`,
      ]);
    }
    return this.createDynamicWorkbook({
      destPath: params.destPath,
      mainSheetName: 'EmployeeData',
      headers: params.headers,
      rows: params.rows,
      summarySheetName: 'DomainSummary',
      summaryHeaders,
      summaryRows,
      chartTitle: params.chartTitle || 'Headcount by Department',
      domainName: 'Employee HR Records',
      onProgress: params.onProgress,
    });
  }

  private async executeLivePacedAutomation(params: ExcelDynamicWorkbookParams): Promise<ExcelMcpExecutionResult> {
    const {
      destPath,
      mainSheetName,
      headers,
      rows,
      summarySheetName = 'SummaryAnalytics',
      summaryHeaders = [],
      summaryRows = [],
      chartTitle = 'Overview Chart',
      domainName = 'Structured Dataset',
      onProgress,
    } = params;
    const rowCount = rows.length;

    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const scratchDir = path.resolve(process.cwd(), 'scratch');
    fs.mkdirSync(scratchDir, { recursive: true });

    // 1. Write TSV file for high-speed multi-column population
    const tsvFile = path.join(scratchDir, `data_${Date.now()}.tsv`);
    const allRows = [headers, ...rows];
    const tsvContent = allRows.map((r) => r.map((c) => String(c).replace(/\t/g, ' ')).join('\t')).join('\r\n');
    fs.writeFileSync(tsvFile, tsvContent, 'utf8');

    // 2. Write summary TSV if summary rows exist
    const hasSummary = summaryHeaders.length > 0 && summaryRows.length > 0;
    const summaryTsvFile = path.join(scratchDir, `summary_${Date.now()}.tsv`);
    if (hasSummary) {
      const allSummaryRows = [summaryHeaders, ...summaryRows];
      const summaryTsvContent = allSummaryRows.map((r) => r.map((c) => String(c).replace(/\t/g, ' ')).join('\t')).join('\r\n');
      fs.writeFileSync(summaryTsvFile, summaryTsvContent, 'utf8');
    }

    // 3. Build live PowerShell automation script
    const psFile = path.join(scratchDir, `live_run_${Date.now()}.ps1`);

    const psScript = `
$ErrorActionPreference = 'Stop'

function Emit-Progress($msg, $pct) {
    $payload = @{ status = $msg; percentage = $pct }
    Write-Output "ORBIT_EVENT:$(ConvertTo-Json $payload -Compress)"
}

try {
    Emit-Progress "Launching Microsoft Excel on screen..." 15

    # Kill old locks
    try {
        Get-Process excel -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-Sleep -Milliseconds 400
    } catch {}

    if (Test-Path '${destPath.replace(/'/g, "''")}') {
        Remove-Item '${destPath.replace(/'/g, "''")}' -Force -ErrorAction SilentlyContinue
    }

    # Step 1: Launch Excel in Foreground & Maximize
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $true
    $excel.DisplayAlerts = $false
    try { $excel.WindowState = -4137 } catch {} # xlMaximized

    $w = New-Object -ComObject WScript.Shell
    $w.AppActivate($excel.Caption)

    Emit-Progress "Microsoft Excel launched and maximized on desktop." 25
    Start-Sleep -Milliseconds 1200

    # Step 2: Create workbook and rename primary sheet
    $wb = $excel.Workbooks.Add()
    $sheet1 = $wb.Sheets.Item(1)
    $sheet1.Name = "${mainSheetName.replace(/"/g, '`"')}"

    Emit-Progress "Worksheet '${mainSheetName.replace(/"/g, '`"')}' initialized. Injecting ${rowCount} records..." 45
    Start-Sleep -Milliseconds 1000

    # Step 3: Fast range injection via 2D SafeArray
    $lines = [System.IO.File]::ReadAllLines('${tsvFile.replace(/'/g, "''")}', [System.Text.Encoding]::UTF8)
    $totalRows = $lines.Count
    $totalCols = $lines[0].Split("\`t").Count
    $arr = New-Object "object[,]" $totalRows, $totalCols

    for ($r = 0; $r -lt $totalRows; $r++) {
        $cols = $lines[$r].Split("\`t")
        for ($c = 0; $c -lt $cols.Count; $c++) {
            $arr[$r, $c] = $cols[$c]
        }
    }

    $range = $sheet1.Range("A1").Resize($totalRows, $totalCols)
    $range.Value2 = $arr
    $range.Columns.AutoFit()

    Emit-Progress "Populated ${rowCount} ${domainName.replace(/"/g, '`"')} records across $totalCols columns." 65
    Start-Sleep -Milliseconds 1200

    # Step 4: Summary Sheet & Reactive Formulas
    if (Test-Path '${summaryTsvFile.replace(/'/g, "''")}') {
        $sheet2 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $sheet1)
        $sheet2.Name = "${summarySheetName.replace(/"/g, '`"')}"
        $sheet2.Activate()

        $sumLines = [System.IO.File]::ReadAllLines('${summaryTsvFile.replace(/'/g, "''")}', [System.Text.Encoding]::UTF8)
        $sRows = $sumLines.Count
        $sCols = $sumLines[0].Split("\`t").Count

        for ($r = 0; $r -lt $sRows; $r++) {
            $cols = $sumLines[$r].Split("\`t")
            for ($c = 0; $c -lt $cols.Count; $c++) {
                $val = $cols[$c]
                $cell = $sheet2.Cells.Item($r + 1, $c + 1)
                if ($r -eq 0) {
                    $cell.Value2 = $val
                    $cell.Font.Bold = $true
                } elseif ($val.StartsWith("=")) {
                    $cell.Formula = $val
                } else {
                    $cell.Value2 = $val
                }
            }
        }
        $sheet2.Columns.AutoFit()

        Emit-Progress "Generated '${summarySheetName.replace(/"/g, '`"')}' with live calculation formulas." 80
        Start-Sleep -Milliseconds 1200

        # Step 5: Clustered Column Chart
        $chartShape = $sheet2.Shapes.AddChart2(201, 280, 20, 520, 320)
        $chart = $chartShape.Chart
        $chart.SetSourceData($sheet2.Range("A1:B$sRows"))
        $chart.HasTitle = $true
        $chart.ChartTitle.Text = "${chartTitle.replace(/"/g, '`"')}"

        Emit-Progress "Native Clustered Column Chart drawn and formatted." 92
        Start-Sleep -Milliseconds 1200
    }

    # Step 6: Save workbook directly to Desktop
    $wb.SaveAs('${destPath.replace(/'/g, "''")}')
    Emit-Progress "Workbook saved successfully to Desktop. Excel active on screen." 100

    $w.AppActivate($excel.Caption)

    Write-Output "ORBIT_RESULT:SUCCESS"
} catch {
    Write-Output "ORBIT_RESULT:ERROR:$($_.Exception.Message)"
}
`;
    fs.writeFileSync(psFile, psScript, 'utf8');

    return new Promise((resolve, reject) => {
      logger.info(`[ExcelMcpBridge] Executing Live Paced Script: ${psFile}`);
      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let scriptError = '';

      child.stdout.on('data', (d) => {
        const text = d.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('ORBIT_EVENT:')) {
            try {
              const event = JSON.parse(trimmed.replace('ORBIT_EVENT:', ''));
              logger.info(`[ExcelMcpBridge Live] ${event.status} (${event.percentage}%)`);
              onProgress?.(event.status, event.percentage);
            } catch {}
          } else if (trimmed.startsWith('ORBIT_RESULT:SUCCESS')) {
            logger.info('[ExcelMcpBridge Live] Task completed successfully on screen!');
          } else if (trimmed.startsWith('ORBIT_RESULT:ERROR:')) {
            scriptError = trimmed.replace('ORBIT_RESULT:ERROR:', '');
            logger.error(`[ExcelMcpBridge Live] Script error: ${scriptError}`);
          }
        }
      });

      child.stderr.on('data', (d) => {
        scriptError += d.toString();
      });

      child.on('close', (code) => {
        try { fs.unlinkSync(tsvFile); } catch {}
        try { fs.unlinkSync(summaryTsvFile); } catch {}
        try { fs.unlinkSync(psFile); } catch {}

        if (code === 0 && !scriptError) {
          resolve({
            success: true,
            destPath,
            employeeCount: rowCount,
            domainCount: summaryRows.length,
            chartCreated: hasSummary,
          });
        } else {
          reject(new Error(scriptError || `Live automation exited with code ${code}`));
        }
      });
    });
  }

  private async executeBatchAutomation(params: ExcelDynamicWorkbookParams): Promise<ExcelMcpExecutionResult> {
    const {
      destPath,
      mainSheetName,
      headers,
      rows,
      summarySheetName = 'SummaryAnalytics',
      summaryHeaders = [],
      summaryRows = [],
      chartTitle = 'Overview Chart',
      onProgress,
    } = params;
    const rowCount = rows.length;

    logger.info(`[ExcelMcpBridge Batch] Fallback batch execution at: ${destPath}`);
    onProgress?.('Executing via ExcelMcp CLI Batch...', 20);

    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    try {
      execSync('powershell -Command "Get-Process excel -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Milliseconds 400"');
    } catch {}

    if (fs.existsSync(destPath)) {
      try { fs.unlinkSync(destPath); } catch {}
    }

    const allDataRows: (string | number)[][] = [headers, ...rows];
    const hasSummary = summaryHeaders.length > 0 && summaryRows.length > 0;
    const allSummaryRows: (string | number)[][] = hasSummary ? [summaryHeaders, ...summaryRows] : [];

    const batchCommands: ExcelMcpBatchCommand[] = [
      {
        command: 'session.create',
        args: { filePath: destPath, show: true },
      },
      {
        command: 'sheet.rename',
        args: { oldName: 'Sheet1', newName: mainSheetName },
      },
      {
        command: 'range.set-values',
        args: { sheetName: mainSheetName, rangeAddress: `A1:${this.colLetter(headers.length)}${allDataRows.length}`, values: allDataRows },
      },
    ];

    if (hasSummary) {
      batchCommands.push(
        {
          command: 'sheet.create',
          args: { sheetName: summarySheetName },
        },
        {
          command: 'range.set-values',
          args: { sheetName: summarySheetName, rangeAddress: `A1:${this.colLetter(summaryHeaders.length)}${allSummaryRows.length}`, values: allSummaryRows },
        },
        {
          command: 'chart.create-from-range',
          args: {
            sheetName: summarySheetName,
            chartType: 'ColumnClustered',
            sourceRangeAddress: `A1:B${allSummaryRows.length}`,
            targetRange: 'F2:N18',
            chartName: chartTitle.replace(/[^a-zA-Z0-9]/g, ''),
          },
        },
      );
    }

    batchCommands.push({
      command: 'session.close',
      args: { save: true },
    });

    const scratchDir = path.resolve(process.cwd(), 'scratch');
    fs.mkdirSync(scratchDir, { recursive: true });
    const batchFile = path.join(scratchDir, `batch_${Date.now()}.json`);
    fs.writeFileSync(batchFile, JSON.stringify(batchCommands, null, 2), 'utf8');

    return new Promise((resolve, reject) => {
      const child = spawn(this.cliPath, ['batch', '-i', batchFile, '--stop-on-error'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderrOutput = '';

      child.stdout.on('data', (data) => {
        const text = data.toString();
        const lines = text.split('\n').filter((l: string) => l.trim().length > 0);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.command === 'session.create' && parsed.success) {
              onProgress?.('Microsoft Excel launched on screen.', 25);
            } else if (parsed.command === 'sheet.rename' && parsed.success) {
              onProgress?.(`Worksheet initialized ("${mainSheetName}").`, 45);
            } else if (parsed.command === 'range.set-values' && parsed.index === 2 && parsed.success) {
              onProgress?.(`Populated ${rowCount} records across ${headers.length} columns.`, 65);
            } else if (parsed.command === 'sheet.create' && parsed.success) {
              onProgress?.(`Created "${summarySheetName}" analytics dashboard.`, 75);
            } else if (parsed.command === 'range.set-values' && parsed.index === 4 && parsed.success) {
              onProgress?.('Applied calculation formulas.', 85);
            } else if (parsed.command === 'chart.create-from-range' && parsed.success) {
              onProgress?.('Native Clustered Column Chart drawn & positioned.', 95);
            } else if (parsed.command === 'session.close' && parsed.success) {
              onProgress?.('Workbook saved successfully to Desktop.', 100);
            }
          } catch {}
        }
      });

      child.stderr.on('data', (d) => { stderrOutput += d.toString(); });

      child.on('close', (code) => {
        try { fs.unlinkSync(batchFile); } catch {}
        if (code === 0) {
          try {
            execSync(`powershell -Command "Start-Process excel.exe -ArgumentList '\\"${destPath}\\"'"`);
          } catch {}
          resolve({
            success: true,
            destPath,
            employeeCount: rowCount,
            domainCount: summaryRows.length,
            chartCreated: hasSummary,
          });
        } else {
          reject(new Error(`excelcli batch exited with code ${code}. Stderr: ${stderrOutput}`));
        }
      });
    });
  }

  private colLetter(colIdx: number): string {
    let letter = '';
    let temp = colIdx;
    while (temp > 0) {
      const mod = (temp - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      temp = Math.floor((temp - mod) / 26);
    }
    return letter || 'A';
  }
}
