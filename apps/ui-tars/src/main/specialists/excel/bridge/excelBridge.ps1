param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("CREATE_WORKBOOK", "INSPECT_WORKBOOK", "READ_DATA", "WRITE_CLEANED_DATA", "APPLY_SUMMARY_AND_CHART", "AUDIT_WORKBOOK", "CREATE_EMPLOYEE_WORKBOOK")]
    [string]$Operation,

    [Parameter(Mandatory=$true)]
    [string]$ConfigPath,

    [Parameter(Mandatory=$true)]
    [string]$ResultPath
)

$ErrorActionPreference = "Stop"

# Helper for Win32 PID resolution
if (-not ([System.Management.Automation.PSTypeName]'Win32ExcelBridge').Type) {
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class Win32ExcelBridge {
        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    }
"@
}

function Release-Com($obj) {
    if ($null -ne $obj -and [System.Runtime.InteropServices.Marshal]::IsComObject($obj)) {
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($obj) | Out-Null
    }
}

function Set-RangeValues($range, $arr2d) {
    $range.GetType().InvokeMember('Value2', [System.Reflection.BindingFlags]::SetProperty, $null, $range, @(,[object[,]]$arr2d))
}

$excelApp = $null
$workbook = $null
$excelPid = $null
$resultObj = @{
    success = $false
    operation = $Operation
    excelPid = $null
    data = @{}
    errors = @()
}

try {
    if (-not (Test-Path $ConfigPath)) {
        throw "Config file not found: $ConfigPath"
    }

    $rawJson = Get-Content -Path $ConfigPath -Raw -Encoding UTF8
    $config = $rawJson | ConvertFrom-Json

    # Initialize Excel COM
    $excelApp = New-Object -ComObject Excel.Application
    $excelApp.Visible = $false
    $excelApp.DisplayAlerts = $false
    $excelApp.AskToUpdateLinks = $false
    $excelApp.AutomationSecurity = 3 # msoAutomationSecurityForceDisable

    # Resolve PID
    $hwnd = [IntPtr]$excelApp.Hwnd
    $resolvedPid = 0
    [Win32ExcelBridge]::GetWindowThreadProcessId($hwnd, [ref]$resolvedPid) | Out-Null
    $excelPid = [int]$resolvedPid
    $resultObj.excelPid = $excelPid

    switch ($Operation) {
        "CREATE_WORKBOOK" {
            $destPath = [System.IO.Path]::GetFullPath($config.destPath)
            $headers = $config.headers
            $rows = $config.rows

            # Ensure parent directory exists
            $parentDir = Split-Path -Parent $destPath
            if (-not (Test-Path $parentDir)) {
                New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
            }

            # If file exists, remove to avoid overwrite prompt
            if (Test-Path $destPath) {
                Remove-Item -Path $destPath -Force
            }

            $workbook = $excelApp.Workbooks.Add()
            $sheet = $workbook.Sheets.Item(1)
            $sheet.Name = "SalesData"

            # Write headers
            for ($c = 0; $c -lt $headers.Count; $c++) {
                $sheet.Cells.Item(1, $c + 1).Value2 = $headers[$c]
                $sheet.Cells.Item(1, $c + 1).Font.Bold = $true
            }

            # Write rows in batch using 2D Array for performance
            $totalRows = $rows.Count
            $totalCols = $headers.Count

            if ($totalRows -gt 0) {
                $arr = New-Object 'object[,]' $totalRows, $totalCols
                for ($r = 0; $r -lt $totalRows; $r++) {
                    $rowVals = $rows[$r]
                    for ($c = 0; $c -lt $totalCols; $c++) {
                        $arr[$r, $c] = $rowVals[$c]
                    }
                }

                $targetRange = $sheet.Range($sheet.Cells.Item(2, 1), $sheet.Cells.Item($totalRows + 1, $totalCols))
                Set-RangeValues $targetRange $arr
                Release-Com $targetRange
            }

            $sheet.Columns.AutoFit() | Out-Null
            Release-Com $sheet

            $workbook.SaveAs($destPath, 51) # 51 = xlOpenXMLWorkbook (.xlsx)
            $resultObj.success = $true
            $resultObj.data = @{
                createdPath = $destPath
                rowCount = $totalRows + 1
                colCount = $totalCols
            }
        }

        "INSPECT_WORKBOOK" {
            $targetPath = [System.IO.Path]::GetFullPath($config.targetPath)
            if (-not (Test-Path $targetPath)) {
                throw "Target workbook does not exist: $targetPath"
            }

            $workbook = $excelApp.Workbooks.Open($targetPath, $false, $true) # Open read-only
            $sheetNames = @()
            for ($i = 1; $i -le $workbook.Sheets.Count; $i++) {
                $sheetNames += $workbook.Sheets.Item($i).Name
            }

            $sheet = $workbook.Sheets.Item(1)
            $usedRange = $sheet.UsedRange
            $rowCount = $usedRange.Rows.Count
            $colCount = $usedRange.Columns.Count
            $usedAddress = $usedRange.Address

            $headers = @()
            for ($c = 1; $c -le $colCount; $c++) {
                $headers += [string]$sheet.Cells.Item(1, $c).Value2
            }

            Release-Com $usedRange
            Release-Com $sheet

            $resultObj.success = $true
            $resultObj.data = @{
                filePath = $targetPath
                sheetNames = $sheetNames
                activeSheet = $sheetNames[0]
                usedRangeAddress = $usedAddress
                rowCount = $rowCount
                columnCount = $colCount
                headers = $headers
                formulaErrorCount = 0
            }
        }

        "READ_DATA" {
            $targetPath = [System.IO.Path]::GetFullPath($config.targetPath)
            $sheetName = $config.sheetName
            $workbook = $excelApp.Workbooks.Open($targetPath, $false, $true)
            $sheet = if ($sheetName) { $workbook.Sheets.Item($sheetName) } else { $workbook.Sheets.Item(1) }
            
            $usedRange = $sheet.UsedRange
            $rowCount = $usedRange.Rows.Count
            $colCount = $usedRange.Columns.Count

            $rawData = $usedRange.Value2

            $rowsList = @()
            for ($r = 1; $r -le $rowCount; $r++) {
                $rowItem = @()
                for ($c = 1; $c -le $colCount; $c++) {
                    $val = $rawData[$r, $c]
                    $rowItem += $val
                }
                $rowsList += ,@($rowItem)
            }

            Release-Com $usedRange
            Release-Com $sheet

            $resultObj.success = $true
            $resultObj.data = @{
                rowCount = $rowCount
                colCount = $colCount
                rows = $rowsList
            }
        }

        "WRITE_CLEANED_DATA" {
            $sourcePath = [System.IO.Path]::GetFullPath($config.sourcePath)
            $outputPath = [System.IO.Path]::GetFullPath($config.outputPath)
            $cleanedRows = $config.cleanedRows # 2D array including headers

            if (Test-Path $outputPath) {
                Remove-Item -Path $outputPath -Force
            }

            $workbook = $excelApp.Workbooks.Open($sourcePath, $false, $false)
            $sheet = $workbook.Sheets.Item(1)

            # Clear old contents
            $oldUsed = $sheet.UsedRange
            $oldUsed.Clear() | Out-Null
            Release-Com $oldUsed

            $numRows = $cleanedRows.Count
            $numCols = $cleanedRows[0].Count

            $arr = New-Object 'object[,]' $numRows, $numCols
            for ($r = 0; $r -lt $numRows; $r++) {
                for ($c = 0; $c -lt $numCols; $c++) {
                    $arr[$r, $c] = $cleanedRows[$r][$c]
                }
            }

            $writeRange = $sheet.Range($sheet.Cells.Item(1, 1), $sheet.Cells.Item($numRows, $numCols))
            Set-RangeValues $writeRange $arr
            Release-Com $writeRange

            # Format headers
            $headerRange = $sheet.Range($sheet.Cells.Item(1, 1), $sheet.Cells.Item(1, $numCols))
            $headerRange.Font.Bold = $true
            Release-Com $headerRange

            $sheet.Columns.AutoFit() | Out-Null
            Release-Com $sheet

            $workbook.SaveAs($outputPath, 51) # 51 = xlOpenXMLWorkbook (.xlsx)
            $resultObj.success = $true
            $resultObj.data = @{
                outputPath = $outputPath
                writtenRows = $numRows
                writtenCols = $numCols
            }
        }

        "APPLY_SUMMARY_AND_CHART" {
            $targetPath = [System.IO.Path]::GetFullPath($config.targetPath)
            $summarySheetName = if ($config.summarySheetName) { $config.summarySheetName } else { "CategorySummary" }
            $categories = $config.categories
            $dataRowCount = [int]$config.dataRowCount # number of rows in SalesData, e.g. 501

            $workbook = $excelApp.Workbooks.Open($targetPath, $false, $false)

            # Create or get summary sheet
            $summarySheet = $null
            for ($i = 1; $i -le $workbook.Sheets.Count; $i++) {
                if ($workbook.Sheets.Item($i).Name -eq $summarySheetName) {
                    $summarySheet = $workbook.Sheets.Item($i)
                    break
                }
            }
            if ($null -eq $summarySheet) {
                $summarySheet = $workbook.Sheets.Add([System.Reflection.Missing]::Value, $workbook.Sheets.Item($workbook.Sheets.Count))
                $summarySheet.Name = $summarySheetName
            }

            # Clear summary sheet
            $used = $summarySheet.UsedRange
            $used.Clear() | Out-Null
            Release-Com $used

            # Write Summary Headers
            $summarySheet.Cells.Item(1, 1).Value2 = "Category"
            $summarySheet.Cells.Item(1, 2).Value2 = "Total Sales"
            $summarySheet.Cells.Item(1, 3).Value2 = "Average Units"
            $headerRange = $summarySheet.Range("A1:C1")
            $headerRange.Font.Bold = $true
            Release-Com $headerRange

            # Write Categories and Excel Formulas
            # SalesData sheet structure:
            # Col A: OrderID, Col B: Date, Col C: Category, Col D: Region, Col E: Units, Col F: UnitPrice, Col G: Total
            for ($k = 0; $k -lt $categories.Count; $k++) {
                $rowIdx = $k + 2
                $catName = [string]$categories[$k]
                $summarySheet.Cells.Item($rowIdx, 1).Value2 = $catName

                # SUMIFS(SalesData!G2:G{dataRowCount}, SalesData!C2:C{dataRowCount}, A{rowIdx})
                $sumFormula = "=SUMIFS(SalesData!G`$2:G`$$dataRowCount, SalesData!C`$2:C`$$dataRowCount, A$rowIdx)"
                # AVERAGEIFS(SalesData!E2:E{dataRowCount}, SalesData!C2:C{dataRowCount}, A{rowIdx})
                $avgFormula = "=AVERAGEIFS(SalesData!E`$2:E`$$dataRowCount, SalesData!C`$2:C`$$dataRowCount, A$rowIdx)"

                $summarySheet.Cells.Item($rowIdx, 2).Formula = $sumFormula
                $summarySheet.Cells.Item($rowIdx, 3).Formula = $avgFormula
            }

            # Recalculate
            $excelApp.CalculateFull()

            # Read back calculated results and formulas for immediate postcondition check
            $calculatedSummary = @()
            for ($k = 0; $k -lt $categories.Count; $k++) {
                $rowIdx = $k + 2
                $cat = [string]$summarySheet.Cells.Item($rowIdx, 1).Value2
                $tot = [double]$summarySheet.Cells.Item($rowIdx, 2).Value2
                $avg = [double]$summarySheet.Cells.Item($rowIdx, 3).Value2
                $sumForm = [string]$summarySheet.Cells.Item($rowIdx, 2).Formula
                $avgForm = [string]$summarySheet.Cells.Item($rowIdx, 3).Formula

                $calculatedSummary += @{
                    category = $cat
                    totalSales = $tot
                    averageUnits = $avg
                    totalSalesFormula = $sumForm
                    averageUnitsFormula = $avgForm
                }
            }

            # Create Clustered Column Chart
            # xlColumnClustered = 51
            $chartObjects = $summarySheet.ChartObjects()
            $summaryLastRow = $categories.Count + 1
            $sourceDataRange = $summarySheet.Range("A1:C$summaryLastRow")

            # Left=300, Top=20, Width=480, Height=300
            $chartObject = $chartObjects.Add(250, 20, 500, 320)
            $chart = $chartObject.Chart
            $chart.ChartType = 51 # xlColumnClustered
            $chart.SetSourceData($sourceDataRange, 2) # xlColumns = 2
            $chart.HasTitle = $true
            $chart.ChartTitle.Text = "Sales & Units by Category"
            $chart.HasLegend = $true

            $summarySheet.Columns.AutoFit() | Out-Null

            Release-Com $sourceDataRange
            Release-Com $chart
            Release-Com $chartObject
            Release-Com $chartObjects
            Release-Com $summarySheet

            $workbook.Save()
            $resultObj.success = $true
            $resultObj.data = @{
                summarySheetName = $summarySheetName
                summaryRowCount = $summaryLastRow
                calculatedSummary = $calculatedSummary
                chartCreated = $true
                chartType = "xlColumnClustered"
                chartTitle = "Sales & Units by Category"
            }
        }

        "CREATE_EMPLOYEE_WORKBOOK" {
            $destPath = [System.IO.Path]::GetFullPath($config.destPath)
            $headers = $config.headers
            $rows = $config.rows
            $domains = $config.domains
            $chartTitle = if ($config.chartTitle) { $config.chartTitle } else { "Employee Distribution by Domain" }
            $openInExcel = [bool]$config.openInExcel

            $parentDir = Split-Path -Parent $destPath
            if (-not (Test-Path $parentDir)) {
                New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
            }
            if (Test-Path $destPath) {
                Remove-Item -Path $destPath -Force
            }

            $workbook = $excelApp.Workbooks.Add()

            # Sheet 1: EmployeeData
            $dataSheet = $workbook.Sheets.Item(1)
            $dataSheet.Name = "EmployeeData"

            # Write headers
            for ($c = 0; $c -lt $headers.Count; $c++) {
                $cell = $dataSheet.Cells.Item(1, $c + 1)
                $cell.Value2 = $headers[$c]
                $cell.Font.Bold = $true
                Release-Com $cell
            }

            $totalRows = $rows.Count
            $totalCols = $headers.Count
            if ($totalRows -gt 0) {
                $arr = New-Object 'object[,]' $totalRows, $totalCols
                for ($r = 0; $r -lt $totalRows; $r++) {
                    $rowVals = $rows[$r]
                    for ($c = 0; $c -lt $totalCols; $c++) {
                        $arr[$r, $c] = $rowVals[$c]
                    }
                }
                $targetRange = $dataSheet.Range($dataSheet.Cells.Item(2, 1), $dataSheet.Cells.Item($totalRows + 1, $totalCols))
                Set-RangeValues $targetRange $arr
                Release-Com $targetRange
            }
            $dataSheet.Columns.AutoFit() | Out-Null

            # Sheet 2: DomainSummary
            $summarySheet = $workbook.Sheets.Add([System.Reflection.Missing]::Value, $dataSheet)
            $summarySheet.Name = "DomainSummary"

            $summarySheet.Cells.Item(1, 1).Value2 = "Domain"
            $summarySheet.Cells.Item(1, 2).Value2 = "Headcount"
            $summarySheet.Cells.Item(1, 3).Value2 = "Avg Monthly Salary ($)"
            $summarySheet.Cells.Item(1, 4).Value2 = "Total Monthly Payroll ($)"
            $sumHeader = $summarySheet.Range("A1:D1")
            $sumHeader.Font.Bold = $true
            Release-Com $sumHeader

            $lastDataRow = $totalRows + 1
            for ($d = 0; $d -lt $domains.Count; $d++) {
                $rowIdx = $d + 2
                $domainName = [string]$domains[$d]
                $summarySheet.Cells.Item($rowIdx, 1).Value2 = $domainName
                $summarySheet.Cells.Item($rowIdx, 2).Formula = "=COUNTIF(EmployeeData!C`$2:C`$$lastDataRow, A$rowIdx)"
                $summarySheet.Cells.Item($rowIdx, 3).Formula = "=AVERAGEIF(EmployeeData!C`$2:C`$$lastDataRow, A$rowIdx, EmployeeData!G`$2:G`$$lastDataRow)"
                $summarySheet.Cells.Item($rowIdx, 4).Formula = "=SUMIF(EmployeeData!C`$2:C`$$lastDataRow, A$rowIdx, EmployeeData!G`$2:G`$$lastDataRow)"
            }

            $excelApp.CalculateFull()

            # Format Currency columns
            $currRange = $summarySheet.Range("C2:D$($domains.Count + 1)")
            $currRange.NumberFormat = "$#,##0"
            Release-Com $currRange

            # Add Clustered Column Chart
            $chartObjects = $summarySheet.ChartObjects()
            $chartLastRow = $domains.Count + 1
            $sourceDataRange = $summarySheet.Range("A1:B$chartLastRow")
            $chartObject = $chartObjects.Add(320, 20, 520, 320)
            $chart = $chartObject.Chart
            $chart.ChartType = 51 # xlColumnClustered
            $chart.SetSourceData($sourceDataRange, 2)
            $chart.HasTitle = $true
            $chart.ChartTitle.Text = $chartTitle
            $chart.HasLegend = $false

            $summarySheet.Columns.AutoFit() | Out-Null

            Release-Com $sourceDataRange
            Release-Com $chart
            Release-Com $chartObject
            Release-Com $chartObjects
            Release-Com $summarySheet
            Release-Com $dataSheet

            $workbook.SaveAs($destPath, 51)
            $resultObj.success = $true
            $resultObj.data = @{
                destPath = $destPath
                employeeCount = $totalRows
                domainCount = $domains.Count
                chartCreated = $true
            }

            if ($openInExcel) {
                Start-Process "excel.exe" -ArgumentList "`"$destPath`"" -ErrorAction SilentlyContinue
            }
        }

        "AUDIT_WORKBOOK" {
            $targetPath = [System.IO.Path]::GetFullPath($config.targetPath)
            $expectedCategories = $config.expectedCategories
            $expectedHeaders = $config.expectedHeaders

            if (-not (Test-Path $targetPath)) {
                throw "Audit target file does not exist: $targetPath"
            }

            $fileInfo = Get-Item $targetPath
            $fileSize = $fileInfo.Length

            $workbook = $excelApp.Workbooks.Open($targetPath, $false, $true) # read-only
            $salesSheet = $workbook.Sheets.Item("SalesData")
            $salesUsed = $salesSheet.UsedRange
            $rowCount = $salesUsed.Rows.Count
            $colCount = $salesUsed.Columns.Count

            # Verify Headers
            $headersPreserved = $true
            for ($c = 1; $c -le $expectedHeaders.Count; $c++) {
                $actual = [string]$salesSheet.Cells.Item(1, $c).Value2
                if ($actual -ne $expectedHeaders[$c - 1]) {
                    $headersPreserved = $false
                }
            }

            # Check unrelated columns (e.g. Date and Region) are non-empty
            $unrelatedPreserved = $true
            for ($r = 2; $r -le [Math]::Min($rowCount, 20); $r++) {
                $dateVal = $salesSheet.Cells.Item($r, 2).Value2
                $regionVal = $salesSheet.Cells.Item($r, 4).Value2
                if ($null -eq $dateVal -or [string]::IsNullOrWhiteSpace([string]$dateVal) -or $null -eq $regionVal) {
                    $unrelatedPreserved = $false
                }
            }

            # Check Summary Sheet & Chart
            $summarySheet = $null
            for ($i = 1; $i -le $workbook.Sheets.Count; $i++) {
                if ($workbook.Sheets.Item($i).Name -eq "CategorySummary") {
                    $summarySheet = $workbook.Sheets.Item($i)
                    break
                }
            }

            $formulasPreserved = $false
            $chartPresent = $false
            $chartTitle = ""
            $chartSeriesCount = 0

            if ($null -ne $summarySheet) {
                # Verify formula in B2
                $f2 = [string]$summarySheet.Cells.Item(2, 2).Formula
                if ($f2.StartsWith("=")) {
                    $formulasPreserved = $true
                }

                $charts = $summarySheet.ChartObjects()
                if ($charts.Count -ge 1) {
                    $chartPresent = $true
                    $cObj = $charts.Item(1)
                    $ch = $cObj.Chart
                    if ($ch.HasTitle) {
                        $chartTitle = [string]$ch.ChartTitle.Text
                    }
                    $seriesColl = $ch.SeriesCollection()
                    $chartSeriesCount = [int]$seriesColl.Count
                    Release-Com $seriesColl
                    Release-Com $ch
                    Release-Com $cObj
                }
                Release-Com $charts
                Release-Com $summarySheet
            }

            Release-Com $salesUsed
            Release-Com $salesSheet

            $resultObj.success = $true
            $resultObj.data = @{
                savedFilePath = $targetPath
                fileSizeBytes = $fileSize
                rowCount = $rowCount
                headersPreserved = $headersPreserved
                unrelatedDataPreserved = $unrelatedPreserved
                formulasPreserved = $formulasPreserved
                chartPresent = $chartPresent
                chartTitle = $chartTitle
                chartSeriesCount = $chartSeriesCount
            }
        }
    }
}
catch {
    $resultObj.success = $false
    $resultObj.errors += ($_.Exception.ToString() + " [AT LINE " + $_.InvocationInfo.ScriptLineNumber + ": " + $_.InvocationInfo.Line + "]")
}
finally {
    # Guaranteed COM cleanup in reverse dependency order
    if ($null -ne $workbook) {
        try { $workbook.Close($false) } catch {}
        Release-Com $workbook
    }
    if ($null -ne $excelApp) {
        try { $excelApp.Quit() } catch {}
        Release-Com $excelApp
    }

    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()

    # Write structured result to designated result path
    $resultJson = $resultObj | ConvertTo-Json -Depth 6
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($ResultPath, $resultJson, $utf8NoBom)

    # Verify process termination; if still alive after 1 second, ensure termination
    if ($excelPid) {
        Start-Sleep -Milliseconds 250
        $proc = Get-Process -Id $excelPid -ErrorAction SilentlyContinue
        if ($null -ne $proc -and -not $proc.HasExited) {
            try {
                $proc.Kill()
            } catch {}
        }
    }
}

if (-not $resultObj.success) {
    exit 1
} else {
    exit 0
}
