$wb = "C:\Windows\Microsoft.NET\assembly\GAC_MSIL\WindowsBase\v4.0_4.0.0.0__31bf3856ad364e35\WindowsBase.dll"
$uac = "C:\Windows\Microsoft.NET\assembly\GAC_MSIL\UIAutomationClient\v4.0_4.0.0.0__31bf3856ad364e35\UIAutomationClient.dll"
$uat = "C:\Windows\Microsoft.NET\assembly\GAC_MSIL\UIAutomationTypes\v4.0_4.0.0.0__31bf3856ad364e35\UIAutomationTypes.dll"

$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$outExe = "$PSScriptRoot\FastInputServer.exe"
$srcCs = "$PSScriptRoot\FastInputServer.cs"

& $csc /nologo /platform:x64 /optimize+ /r:System.Drawing.dll "/r:$wb" "/r:$uac" "/r:$uat" "/out:$outExe" "$srcCs"
if ($LASTEXITCODE -eq 0) {
    Copy-Item $outExe "$PSScriptRoot\..\apps\ui-tars\resources\FastInputServer.exe" -Force
    Write-Host "FAST INPUT SERVER COMPILED SUCCESSFULLY!"
} else {
    Write-Host "COMPILATION FAILED WITH EXIT CODE: $LASTEXITCODE"
}
